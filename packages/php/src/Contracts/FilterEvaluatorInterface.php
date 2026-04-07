<?php

declare(strict_types=1);

namespace SafeAccess\Inline\Contracts;

/**
 * Contract for parsing and evaluating filter predicate expressions.
 *
 * Handles the `[?expression]` segment syntax, converting string predicates
 * into structured condition arrays and evaluating them against data items.
 *
 * @internal
 */
interface FilterEvaluatorInterface
{
    /**
     * Parse a filter expression string into a structured condition array.
     *
     * @param string $expression Raw filter expression (e.g. "age>18 && active==true").
     *
     * @return array{conditions: list<array<string, mixed>>, logicals: list<string>} Parsed conditions and logical operators.
     *
     * @throws \SafeAccess\Inline\Exceptions\InvalidFormatException When the expression syntax is invalid.
     */
    public function parse(string $expression): array;

    /**
     * Evaluate a parsed expression against a single data item.
     *
     * @param array<string, mixed>                                                   $item Data item to test.
     * @param array{conditions: list<array<string, mixed>>, logicals: list<string>}   $expr Parsed expression from {@see parse()}.
     *
     * @return bool True if the item satisfies the expression.
     */
    public function evaluate(array $item, array $expr): bool;
}
