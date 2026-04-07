<?php

declare(strict_types=1);

namespace SafeAccess\Inline\PathQuery;

use SafeAccess\Inline\Contracts\FilterEvaluatorInterface;
use SafeAccess\Inline\Contracts\SecurityGuardInterface;
use SafeAccess\Inline\Exceptions\InvalidFormatException;

/**
 * Parse and evaluate filter predicate expressions for path queries.
 *
 * Handles `[?expression]` syntax with comparison operators (==, !=, >, <, >=, <=),
 * logical operators (&& and ||), and built-in functions (starts_with, contains, values).
 * Supports arithmetic expressions and nested field access via dot-notation.
 *
 * @internal
 *
 * @see FilterEvaluatorInterface  Contract this class implements.
 * @see SegmentParser             Uses this for filter segment parsing.
 * @see SegmentPathResolver       Uses this for filter evaluation during resolution.
 * @see SecurityGuardInterface    Guards field access against forbidden keys.
 */
final class SegmentFilterParser implements FilterEvaluatorInterface
{
    /**
     * Create a filter parser with security guard for field validation.
     *
     * @param SecurityGuardInterface $guard Key validator for field access.
     */
    public function __construct(
        private readonly SecurityGuardInterface $guard
    ) {
    }

    /**
     * Parse a filter expression into structured conditions and logical operators.
     *
     * @param string $expression Raw filter string (e.g. "age>18 && active==true").
     *
     * @return array{conditions: list<array<string, mixed>>, logicals: list<string>} Parsed structure.
     *
     * @throws \SafeAccess\Inline\Exceptions\InvalidFormatException When the expression syntax is invalid.
     */
    public function parse(string $expression): array
    {
        $conditions = [];
        $parts = $this->splitLogical($expression);

        foreach ($parts['tokens'] as $token) {
            $conditions[] = $this->parseCondition(trim($token));
        }

        return ['conditions' => $conditions, 'logicals' => $parts['operators']];
    }

    /**
     * Evaluate a parsed filter expression against a data item.
     *
     * @param array<string, mixed>                                                   $item Data item to test.
     * @param array{conditions: list<array<string, mixed>>, logicals: list<string>}   $expr Parsed expression.
     *
     * @return bool True if the item satisfies all conditions.
     */
    public function evaluate(array $item, array $expr): bool
    {
        if (count($expr['conditions']) === 0) {
            return false;
        }

        /** @var array{field: string, operator: string, value: mixed, func?: string, funcArgs?: list<string>} $condition0 */
        $condition0 = $expr['conditions'][0];
        $result = $this->evaluateCondition($item, $condition0);

        $logicalCount = count($expr['logicals']);
        for ($i = 0; $i < $logicalCount; $i++) {
            /** @var array{field: string, operator: string, value: mixed, func?: string, funcArgs?: list<string>} $conditionNext */
            $conditionNext = $expr['conditions'][$i + 1];
            $nextResult = $this->evaluateCondition($item, $conditionNext);

            if ($expr['logicals'][$i] === '&&') {
                $result = $result && $nextResult;
            } else {
                $result = $result || $nextResult;
            }
        }

        return $result;
    }

    /**
     * Split expression by logical operators (&& and ||), respecting quotes.
     *
     * @param string $expression Raw expression string.
     *
     * @return array{tokens: list<string>, operators: list<string>} Tokens and their joining operators.
     */
    private function splitLogical(string $expression): array
    {
        $tokens = [];
        $operators = [];
        $current = '';
        $inString = false;
        $stringChar = '';
        $len = strlen($expression);

        for ($i = 0; $i < $len; $i++) {
            $ch = $expression[$i];

            if ($inString) {
                $current .= $ch;
                if ($ch === $stringChar) {
                    $inString = false;
                }
                continue;
            }

            if ($ch === "'" || $ch === '"') {
                $inString = true;
                $stringChar = $ch;
                $current .= $ch;
                continue;
            }

            if ($ch === '&' && $i + 1 < $len && $expression[$i + 1] === '&') {
                $tokens[] = $current;
                $operators[] = '&&';
                $current = '';
                $i++;
                continue;
            }

            if ($ch === '|' && $i + 1 < $len && $expression[$i + 1] === '|') {
                $tokens[] = $current;
                $operators[] = '||';
                $current = '';
                $i++;
                continue;
            }

            $current .= $ch;
        }

        $tokens[] = $current;
        return ['tokens' => $tokens, 'operators' => $operators];
    }

    /**
     * Parse a single condition token into a structured array.
     *
     * @param string $token Single condition (e.g. "age>18", "starts_with(@.name, 'J')").
     *
     * @return array{field: string, operator: string, value: mixed, func?: string, funcArgs?: list<string>} Parsed condition.
     *
     * @throws \SafeAccess\Inline\Exceptions\InvalidFormatException When the condition syntax is invalid.
     */
    private function parseCondition(string $token): array
    {
        $operators = ['>=', '<=', '!=', '==', '>', '<'];

        if (preg_match('/^(\w+)\(([^)]*)\)\s*(>=|<=|!=|==|>|<)\s*(.+)$/', $token, $funcMatch)) {
            $func = $funcMatch[1];
            $argsRaw = $funcMatch[2];
            $operator = $funcMatch[3];
            $rawValue = trim($funcMatch[4]);
            $funcArgs = array_map('trim', explode(',', $argsRaw));

            return [
                'field'    => $funcArgs[0],
                'operator' => $operator,
                'value'    => $this->parseValue($rawValue),
                'func'     => $func,
                'funcArgs' => $funcArgs,
            ];
        }

        if (preg_match('/^(\w+)\(([^)]*)\)$/', $token, $funcBoolMatch)) {
            $func = $funcBoolMatch[1];
            $argsRaw = $funcBoolMatch[2];
            $funcArgs = array_map('trim', explode(',', $argsRaw));

            return [
                'field'    => $funcArgs[0],
                'operator' => '==',
                'value'    => true,
                'func'     => $func,
                'funcArgs' => $funcArgs,
            ];
        }

        foreach ($operators as $op) {
            $pos = strpos($token, $op);
            if ($pos !== false) {
                $field = trim(substr($token, 0, $pos));
                $rawValue = trim(substr($token, $pos + strlen($op)));

                return [
                    'field'    => $field,
                    'operator' => $op,
                    'value'    => $this->parseValue($rawValue),
                ];
            }
        }

        throw new InvalidFormatException("Invalid filter condition: \"{$token}\"");
    }

    /**
     * Parse a raw value string to its PHP native type.
     *
     * @param string $raw Raw value (e.g. "true", "'hello'", "42").
     *
     * @return bool|null|int|float|string PHP native value.
     */
    private function parseValue(string $raw): mixed
    {
        return match ($raw) {
            'true'  => true,
            'false' => false,
            'null'  => null,
            default => $this->parseValueDefault($raw),
        };
    }

    /**
     * Parse a non-keyword raw value to int, float, or string.
     *
     * @param string $raw Raw value string.
     *
     * @return int|float|string Typed value.
     */
    private function parseValueDefault(string $raw): int|float|string
    {
        if (
            (str_starts_with($raw, "'") && str_ends_with($raw, "'"))
            || (str_starts_with($raw, '"') && str_ends_with($raw, '"'))
        ) {
            return substr($raw, 1, -1);
        }

        if (is_numeric($raw)) {
            return str_contains($raw, '.') ? (float) $raw : (int) $raw;
        }

        return $raw;
    }

    /**
     * Evaluate a single parsed condition against a data item.
     *
     * @param array<string, mixed>                                                                          $item      Data item.
     * @param array{field: string, operator: string, value: mixed, func?: string, funcArgs?: list<string>}  $condition Parsed condition.
     *
     * @return bool True if the condition is satisfied.
     */
    private function evaluateCondition(array $item, array $condition): bool
    {
        $fieldValue = match (true) {
            isset($condition['func']) => $this->evaluateFunction($item, $condition['func'], $condition['funcArgs'] ?? []),
            preg_match('/[@\w.]+\s*[+\-*\/]\s*[@\w.]+/', $condition['field']) === 1 => $this->resolveArithmetic($item, $condition['field']),
            default => $this->resolveField($item, $condition['field']),
        };

        $expected = $condition['value'];

        return match ($condition['operator']) {
            '==' => $fieldValue === $expected,
            '!=' => $fieldValue !== $expected,
            '>'  => $fieldValue > $expected,
            '<'  => $fieldValue < $expected,
            '>=' => $fieldValue >= $expected,
            '<=' => $fieldValue <= $expected,
            default => false,
        };
    }

    /**
     * Dispatch and evaluate a built-in filter function.
     *
     * @param array<string, mixed> $item     Data item.
     * @param string               $func     Function name.
     * @param list<string>         $funcArgs Function arguments.
     *
     * @return mixed Function result.
     *
     * @throws \SafeAccess\Inline\Exceptions\InvalidFormatException When the function name is unknown.
     */
    private function evaluateFunction(array $item, string $func, array $funcArgs): mixed
    {
        return match ($func) {
            'starts_with' => $this->evalStartsWith($item, $funcArgs),
            'contains'    => $this->evalContains($item, $funcArgs),
            'values'      => $this->evalValues($item, $funcArgs),
            default       => throw new InvalidFormatException("Unknown filter function: \"{$func}\""),
        };
    }

    /**
     * Evaluate the starts_with() filter function.
     *
     * @param array<string, mixed> $item     Data item.
     * @param list<string>         $funcArgs [field, prefix].
     *
     * @return bool True if the field value starts with the prefix.
     */
    private function evalStartsWith(array $item, array $funcArgs): bool
    {
        $val = $this->resolveFilterArg($item, $funcArgs[0] ?? '@');
        if (!is_string($val)) {
            return false;
        }

        $prefix = (string) $this->parseValue(trim($funcArgs[1] ?? ''));

        return str_starts_with($val, $prefix);
    }

    /**
     * Evaluate the contains() filter function.
     *
     * @param array<string, mixed> $item     Data item.
     * @param list<string>         $funcArgs [field, needle].
     *
     * @return bool True if the field value contains the needle.
     */
    private function evalContains(array $item, array $funcArgs): bool
    {
        $val = $this->resolveFilterArg($item, $funcArgs[0] ?? '@');
        $needle = (string) $this->parseValue(trim($funcArgs[1] ?? ''));

        if (is_string($val)) {
            return str_contains($val, $needle);
        }

        if (is_array($val)) {
            return in_array($needle, $val, true);
        }

        return false;
    }

    /**
     * Evaluate the values() filter function (returns count).
     *
     * @param array<string, mixed> $item     Data item.
     * @param list<string>         $funcArgs [field].
     *
     * @return int Number of elements in the field array, or 0.
     */
    private function evalValues(array $item, array $funcArgs): int
    {
        $val = $this->resolveFilterArg($item, $funcArgs[0] ?? '@');
        if (is_array($val)) {
            return count($val);
        }

        return 0;
    }

    /**
     * Resolve an arithmetic expression from a filter predicate.
     *
     * @param array<string, mixed> $item Data item for field resolution.
     * @param string               $expr Arithmetic expression (e.g. "@.price * @.qty").
     *
     * @return float|int|null Computed result, or null on failure.
     */
    private function resolveArithmetic(array $item, string $expr): float|int|null
    {
        if (preg_match('/^([@\w.]+)\s*([+\-*\/])\s*([@\w.]+|\d+(?:\.\d+)?)$/', $expr, $m) !== 1) {
            return null;
        }

        $toNumber = function (string $token) use ($item): float|int|null {
            if (is_numeric($token) && !str_starts_with($token, '@')) {
                return str_contains($token, '.') ? (float) $token : (int) $token;
            }

            $val = $this->resolveFilterArg($item, $token);

            if (is_int($val) || is_float($val)) {
                return $val;
            }

            if (is_numeric($val)) {
                return str_contains((string) $val, '.') ? (float) $val : (int) $val;
            }

            return null;
        };

        $left  = $toNumber($m[1]);
        $right = $toNumber($m[3]);

        if ($left === null || $right === null) {
            return null;
        }

        return match ($m[2]) {
            '+'     => $left + $right,
            '-'     => $left - $right,
            '*'     => $left * $right,
            default => $right != 0 ? $left / $right : null,
        };
    }

    /**
     * Resolve a filter argument to its value from the data item.
     *
     * @param array<string, mixed> $item Data item.
     * @param string               $arg  Argument ("@", "@.field", or "field").
     *
     * @return mixed Resolved value.
     */
    private function resolveFilterArg(array $item, string $arg): mixed
    {
        if ($arg === '' || $arg === '@') {
            return $item;
        }

        if (str_starts_with($arg, '@.')) {
            return $this->resolveField($item, substr($arg, 2));
        }

        return $this->resolveField($item, $arg);
    }

    /**
     * Resolve a dot-separated field path from a data item.
     *
     * @param array<string, mixed> $item  Data item.
     * @param string               $field Dot-separated field path.
     *
     * @return mixed Resolved value, or null if not found.
     *
     * @throws \SafeAccess\Inline\Exceptions\SecurityException When a field key is forbidden.
     */
    private function resolveField(array $item, string $field): mixed
    {
        if (str_contains($field, '.')) {
            $current = $item;
            foreach (explode('.', $field) as $key) {
                $this->guard->assertSafeKey($key);

                if (is_array($current) && array_key_exists($key, $current)) {
                    $current = $current[$key];
                } else {
                    return null;
                }
            }

            return $current;
        }

        $this->guard->assertSafeKey($field);

        return $item[$field] ?? null;
    }
}
