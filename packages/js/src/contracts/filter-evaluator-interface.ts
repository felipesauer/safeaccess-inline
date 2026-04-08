import type { FilterExpression } from '../path-query/segment-type.js';

/**
 * Contract for parsing and evaluating filter predicate expressions.
 *
 * Handles the `[?expression]` segment syntax, converting string predicates
 * into structured condition arrays and evaluating them against data items.
 *
 * @internal
 */
export interface FilterEvaluatorInterface {
    /**
     * Parse a filter expression string into a structured condition array.
     *
     * @param expression - Raw filter expression (e.g. "age>18 && active==true").
     * @returns Parsed conditions and logical operators.
     *
     * @throws {InvalidFormatException} When the expression syntax is invalid.
     */
    parse(expression: string): FilterExpression;

    /**
     * Evaluate a parsed expression against a single data item.
     *
     * @param item - Data item to test.
     * @param expr - Parsed expression from {@link parse}.
     * @returns True if the item satisfies the expression.
     */
    evaluate(item: Record<string, unknown>, expr: FilterExpression): boolean;
}
