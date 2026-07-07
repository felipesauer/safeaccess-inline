<?php

declare(strict_types=1);

namespace SafeAccess\Inline\Schema;

use SafeAccess\Inline\Exceptions\AccessorException;

/**
 * Validates data shape against a schema of `path => rule` entries.
 *
 * Rules are compact strings: `string`, `int`, `float`, `number`, `bool`,
 * `array`, `object`, `null`, `any`. A trailing `?` marks the path optional
 * (absent is allowed); without it the path is required.
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
    /** @var list<string> Recognised rule names (without the optional suffix). */
    private const KNOWN_RULES = [
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
     * @param array<string, string> $schema Map of dot-notation path to type rule.
     *
     * @return SchemaResult The validation outcome (never throws for data failures).
     *
     * @throws \SafeAccess\Inline\Exceptions\AccessorException When a rule string is not recognised (a programming error).
     */
    public function validate(array $schema): SchemaResult
    {
        $sentinel = new \stdClass();
        $errors = [];

        foreach ($schema as $path => $raw) {
            $optional = str_ends_with($raw, '?');
            $rule = $optional ? substr($raw, 0, -1) : $raw;

            $this->assertKnownRule($rule, $path);

            if (!($this->has)($path)) {
                if (!$optional) {
                    $errors[] = new SchemaError(
                        $path,
                        $raw,
                        'missing',
                        "Missing required path \"{$path}\" (expected {$rule})."
                    );
                }
                continue;
            }

            $value = ($this->get)($path, $sentinel);
            if (!$this->matches($rule, $value)) {
                $actual = $this->typeName($value);
                $errors[] = new SchemaError(
                    $path,
                    $raw,
                    $actual,
                    "Path \"{$path}\" expected {$rule}, got {$actual}."
                );
            }
        }

        return new SchemaResult($errors);
    }

    /**
     * Reject an unrecognised rule — a mistake in the schema, not the data.
     *
     * @param string $rule Rule name with any `?` already stripped.
     * @param string $path Path the rule belongs to (for the message).
     *
     * @throws \SafeAccess\Inline\Exceptions\AccessorException When the rule is not a known type.
     */
    private function assertKnownRule(string $rule, string $path): void
    {
        if (!in_array($rule, self::KNOWN_RULES, true)) {
            throw new AccessorException("Unknown schema rule \"{$rule}\" for path \"{$path}\".");
        }
    }

    /**
     * Test whether a value satisfies a (non-optional) rule.
     *
     * @param string $rule  Rule name.
     * @param mixed  $value Resolved value at the path.
     *
     * @return bool True when the value matches the rule.
     */
    private function matches(string $rule, mixed $value): bool
    {
        return match ($rule) {
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
     * Describe the runtime type of a value for error messages.
     *
     * @param mixed $value Resolved value.
     *
     * @return string A short type name (`null`, `array`, `object`, `int`, `float`, `string`, `bool`).
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
}
