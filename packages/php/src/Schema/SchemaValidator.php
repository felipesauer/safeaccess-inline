<?php

declare(strict_types=1);

namespace SafeAccess\Inline\Schema;

use SafeAccess\Inline\Exceptions\AccessorException;

/**
 * Validates data shape against a schema of `path => rule` entries.
 *
 * A rule is one or more pipe-separated parts. The first is the base type
 * (`string`, `int`, `float`, `number`, `bool`, `array`, `object`, `null`,
 * `any`); the rest are constraints applied once the type matches: `min:N`,
 * `max:N`, `enum:a,b,c`, `pattern:REGEX`, `email`, `url`, `uuid`. A trailing
 * `?` on the whole rule marks the path optional.
 *
 * Validation runs against already-parsed values, so a CSV/TOML string field
 * validated as `int` fails — those formats carry no numeric type.
 *
 * Behaviour is mirrored in the JS implementation for parity.
 *
 * @internal
 */
final class SchemaValidator
{
    /** @var list<string> Recognised base type names. */
    private const KNOWN_TYPES = [
        'string',
        'int',
        'float',
        'number',
        'bool',
        'array',
        'object',
        'null',
        'any',
    ];

    /** @var list<string> Recognised constraint names. */
    private const CONSTRAINT_NAMES = ['min', 'max', 'enum', 'pattern', 'email', 'url', 'uuid'];

    private const EMAIL_RE = '/^[^\s@]+@[^\s@]+\.[^\s@]+$/';
    private const URL_RE = '#^https?://[^\s/$.?\#].[^\s]*$#i';
    private const UUID_RE = '/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i';

    /**
     * @param \Closure(string): bool         $has A predicate testing whether a dot-notation path exists.
     * @param \Closure(string, mixed): mixed $get A resolver returning the value at a path, or the fallback when absent.
     */
    public function __construct(
        private readonly \Closure $has,
        private readonly \Closure $get,
    ) {
    }

    /**
     * Validate the data against the schema.
     *
     * @param array<string, string> $schema Map of dot-notation path to rule.
     *
     * @return SchemaResult The validation outcome (never throws for data failures).
     *
     * @throws \SafeAccess\Inline\Exceptions\AccessorException When a rule is malformed (a programming error).
     */
    public function validate(array $schema): SchemaResult
    {
        $sentinel = new \stdClass();
        $errors = [];

        foreach ($schema as $path => $raw) {
            $parsed = $this->parseRule($raw, $path);

            if (!($this->has)($path)) {
                if (!$parsed['optional']) {
                    $errors[] = new SchemaError(
                        $path,
                        $raw,
                        'missing',
                        "Missing required path \"{$path}\" (expected {$parsed['type']})."
                    );
                }
                continue;
            }

            $value = ($this->get)($path, $sentinel);
            if (!$this->matchesType($parsed['type'], $value)) {
                $actual = $this->typeName($value);
                $errors[] = new SchemaError(
                    $path,
                    $raw,
                    $actual,
                    "Path \"{$path}\" expected {$parsed['type']}, got {$actual}."
                );
                continue;
            }

            $message = $this->checkConstraints($parsed['constraints'], $value, $path);
            if ($message !== null) {
                $errors[] = new SchemaError($path, $raw, $this->describe($value), $message);
            }
        }

        return new SchemaResult($errors);
    }

    /**
     * Parse a raw rule string into its optional flag, type, and constraints.
     *
     * @param string $raw  Rule string, e.g. `int|min:1|max:10?`.
     * @param string $path Path the rule belongs to (for error messages).
     *
     * @return array{optional: bool, type: string, constraints: list<array{name: string, arg: string}>}
     *
     * @throws \SafeAccess\Inline\Exceptions\AccessorException When the type or a constraint is unrecognised or malformed.
     */
    private function parseRule(string $raw, string $path): array
    {
        $optional = str_ends_with($raw, '?');
        $body = $optional ? substr($raw, 0, -1) : $raw;
        $parts = explode('|', $body);
        $type = $parts[0];

        if (!in_array($type, self::KNOWN_TYPES, true)) {
            throw new AccessorException("Unknown schema rule \"{$type}\" for path \"{$path}\".");
        }

        $constraints = [];
        $count = count($parts);
        for ($i = 1; $i < $count; $i++) {
            $part = $parts[$i];
            $colon = strpos($part, ':');
            $name = $colon === false ? $part : substr($part, 0, $colon);
            $arg = $colon === false ? '' : substr($part, $colon + 1);

            if (!in_array($name, self::CONSTRAINT_NAMES, true)) {
                throw new AccessorException("Unknown schema constraint \"{$name}\" for path \"{$path}\".");
            }
            $this->assertConstraintArg($name, $arg, $path);
            $constraints[] = ['name' => $name, 'arg' => $arg];
        }

        return ['optional' => $optional, 'type' => $type, 'constraints' => $constraints];
    }

    /**
     * Validate that a constraint's argument is well-formed at parse time.
     *
     * @param string $name Constraint name.
     * @param string $arg  Raw argument text.
     * @param string $path Path for error messages.
     *
     * @throws \SafeAccess\Inline\Exceptions\AccessorException When the argument is missing or malformed.
     */
    private function assertConstraintArg(string $name, string $arg, string $path): void
    {
        if ($name === 'min' || $name === 'max') {
            if (preg_match('/^-?\d+(?:\.\d+)?$/', $arg) !== 1) {
                throw new AccessorException(
                    "Schema constraint \"{$name}\" needs a numeric argument for path \"{$path}\"."
                );
            }
        } elseif ($name === 'enum') {
            if ($arg === '') {
                throw new AccessorException("Schema constraint \"enum\" is empty for path \"{$path}\".");
            }
        } elseif ($name === 'pattern') {
            if (!$this->isValidRegex($this->toRegex($arg))) {
                throw new AccessorException(
                    "Schema constraint \"pattern\" has an invalid regex for path \"{$path}\"."
                );
            }
        }
    }

    /**
     * Test whether a delimited PCRE pattern compiles, swallowing the warning
     * an invalid pattern would otherwise emit (test frameworks promote it).
     *
     * @param string $pattern Delimited PCRE pattern.
     *
     * @return bool True when the pattern compiles.
     */
    private function isValidRegex(string $pattern): bool
    {
        set_error_handler(static fn (): bool => true);
        try {
            return preg_match($pattern, '') !== false;
        } finally {
            restore_error_handler();
        }
    }

    /**
     * Apply every constraint to a value, returning the first failure message.
     *
     * @param list<array{name: string, arg: string}> $constraints Parsed constraints.
     * @param mixed                                   $value       Resolved value (already type-checked).
     * @param string                                  $path        Path for error messages.
     *
     * @return string|null The first failure message, or null when all pass.
     */
    private function checkConstraints(array $constraints, mixed $value, string $path): ?string
    {
        foreach ($constraints as $constraint) {
            $message = $this->checkOne($constraint['name'], $constraint['arg'], $value, $path);
            if ($message !== null) {
                return $message;
            }
        }

        return null;
    }

    /**
     * Evaluate a single constraint against a value.
     *
     * @param string $name  Constraint name.
     * @param string $arg   Constraint argument.
     * @param mixed  $value Resolved value.
     * @param string $path  Path for the message.
     *
     * @return string|null An error message, or null when the constraint holds.
     */
    private function checkOne(string $name, string $arg, mixed $value, string $path): ?string
    {
        return match ($name) {
            'min' => $this->checkBound($path, $value, (float) $arg, true),
            'max' => $this->checkBound($path, $value, (float) $arg, false),
            'enum' => $this->checkEnum($path, $value, $arg),
            'pattern' => is_string($value) && preg_match($this->toRegex($arg), $value) === 1
                ? null
                : "Path \"{$path}\" must match pattern {$arg}.",
            'email' => is_string($value) && preg_match(self::EMAIL_RE, $value) === 1
                ? null
                : "Path \"{$path}\" must be a valid email.",
            'url' => is_string($value) && preg_match(self::URL_RE, $value) === 1
                ? null
                : "Path \"{$path}\" must be a valid URL.",
            default => is_string($value) && preg_match(self::UUID_RE, $value) === 1
                ? null
                : "Path \"{$path}\" must be a valid UUID.",
        };
    }

    /**
     * Check a `min`/`max` bound against a number (by value) or string/array (by length).
     *
     * @param string $path  Path for the message.
     * @param mixed  $value Resolved value.
     * @param float  $bound Numeric bound.
     * @param bool   $isMin True for `min` (>=), false for `max` (<=).
     *
     * @return string|null An error message, or null when the bound holds.
     */
    private function checkBound(string $path, mixed $value, float $bound, bool $isMin): ?string
    {
        $op = $isMin ? '>=' : '<=';

        if (is_int($value) || is_float($value)) {
            $ok = $isMin ? $value >= $bound : $value <= $bound;

            return $ok ? null : "Path \"{$path}\" must be {$op} {$this->num($bound)}, got {$this->num($value)}.";
        }

        if (is_string($value) || (is_array($value) && array_is_list($value))) {
            $len = is_string($value) ? mb_strlen($value) : count($value);
            $ok = $isMin ? $len >= $bound : $len <= $bound;

            return $ok ? null : "Path \"{$path}\" length must be {$op} {$this->num($bound)}, got {$len}.";
        }

        $kind = $isMin ? 'min' : 'max';

        return "Path \"{$path}\" {$kind} constraint requires a number, string, or array.";
    }

    /**
     * Check that a value is one of a comma-separated enum list.
     *
     * @param string $path  Path for the message.
     * @param mixed  $value Resolved value (string or number).
     * @param string $arg   Comma-separated allowed values.
     *
     * @return string|null An error message, or null when the value is allowed.
     */
    private function checkEnum(string $path, mixed $value, string $arg): ?string
    {
        $allowed = explode(',', $arg);
        $asString = (is_int($value) || is_float($value)) ? $this->num($value) : $value;

        if (is_string($asString) && in_array($asString, $allowed, true)) {
            return null;
        }

        $list = implode(', ', $allowed);

        return "Path \"{$path}\" must be one of [{$list}], got {$this->describe($value)}.";
    }

    /**
     * Test whether a value satisfies a base type.
     *
     * @param string $type  Base type name.
     * @param mixed  $value Resolved value at the path.
     *
     * @return bool True when the value matches the type.
     */
    private function matchesType(string $type, mixed $value): bool
    {
        return match ($type) {
            'any' => true,
            'string' => is_string($value),
            'int' => is_int($value),
            'float', 'number' => is_int($value) || is_float($value),
            'bool' => is_bool($value),
            'array' => is_array($value) && array_is_list($value),
            'object' => is_array($value) && !array_is_list($value),
            default => $value === null,
        };
    }

    /**
     * Describe the runtime type of a value for type-mismatch messages.
     *
     * @param mixed $value Resolved value.
     *
     * @return string A short type name.
     */
    private function typeName(mixed $value): string
    {
        return match (true) {
            $value === null => 'null',
            is_array($value) => array_is_list($value) ? 'array' : 'object',
            is_int($value) => 'int',
            is_float($value) => 'float',
            is_bool($value) => 'bool',
            is_string($value) => 'string',
            default => get_debug_type($value),
        };
    }

    /**
     * Render a value for constraint-failure messages (quotes strings).
     *
     * @param mixed $value Resolved value.
     *
     * @return string A short human-readable rendering.
     */
    private function describe(mixed $value): string
    {
        return match (true) {
            is_string($value) => "\"{$value}\"",
            $value === null => 'null',
            is_array($value) => array_is_list($value) ? 'array' : 'object',
            is_bool($value) => $value ? 'true' : 'false',
            is_int($value) || is_float($value) => $this->num($value),
            default => get_debug_type($value),
        };
    }

    /**
     * Format a number without a trailing `.0`, matching JS string coercion.
     *
     * @param int|float $n Numeric value.
     *
     * @return string The formatted number.
     */
    private function num(int|float $n): string
    {
        if (is_float($n) && $n === floor($n) && is_finite($n)) {
            return (string) (int) $n;
        }

        return (string) $n;
    }

    /**
     * Wrap a user-supplied pattern as a delimited PCRE regex.
     *
     * @param string $pattern Raw regex body (no delimiters).
     *
     * @return string A delimited PCRE pattern.
     */
    private function toRegex(string $pattern): string
    {
        return '/' . str_replace('/', '\\/', $pattern) . '/';
    }
}
