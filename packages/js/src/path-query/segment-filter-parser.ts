import type { FilterEvaluatorInterface } from '../contracts/filter-evaluator-interface.js';
import type { SecurityGuardInterface } from '../contracts/security-guard-interface.js';
import type { FilterCondition, FilterExpression } from './segment-type.js';
import { InvalidFormatException } from '../exceptions/invalid-format-exception.js';

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
export class SegmentFilterParser implements FilterEvaluatorInterface {
    /**
     * Create a filter parser with security guard for field validation.
     *
     * @param guard - Key validator for field access.
     */
    constructor(private readonly guard: SecurityGuardInterface) {}

    /**
     * Parse a filter expression into structured conditions and logical operators.
     *
     * @param expression - Raw filter string (e.g. "age>18 && active==true").
     * @returns Parsed structure with conditions and logical operators.
     *
     * @throws {InvalidFormatException} When the expression syntax is invalid.
     */
    parse(expression: string): FilterExpression {
        const conditions: FilterCondition[] = [];
        const parts = this.splitLogical(expression);

        for (const token of parts.tokens) {
            conditions.push(this.parseCondition(token.trim()));
        }

        return { conditions, logicals: parts.operators };
    }

    /**
     * Evaluate a parsed filter expression against a data item.
     *
     * @param item - Data item to test.
     * @param expr - Parsed expression.
     * @returns True if the item satisfies all conditions.
     */
    evaluate(item: Record<string, unknown>, expr: FilterExpression): boolean {
        if (expr.conditions.length === 0) {
            return false;
        }

        let result = this.evaluateCondition(item, expr.conditions[0]);

        for (let i = 0; i < expr.logicals.length; i++) {
            const nextResult = this.evaluateCondition(item, expr.conditions[i + 1]);

            if (expr.logicals[i] === '&&') {
                result = result && nextResult;
            } else {
                result = result || nextResult;
            }
        }

        return result;
    }

    /**
     * Split expression by logical operators (&& and ||), respecting quotes.
     *
     * @param expression - Raw expression string.
     * @returns Tokens and their joining operators.
     */
    private splitLogical(expression: string): { tokens: string[]; operators: string[] } {
        const tokens: string[] = [];
        const operators: string[] = [];
        let current = '';
        let inString = false;
        let stringChar = '';

        for (let i = 0; i < expression.length; i++) {
            const ch = expression[i];

            if (inString) {
                current += ch;
                if (ch === stringChar) {
                    inString = false;
                }
                continue;
            }

            if (ch === "'" || ch === '"') {
                inString = true;
                stringChar = ch;
                current += ch;
                continue;
            }

            if (ch === '&' && expression[i + 1] === '&') {
                tokens.push(current);
                operators.push('&&');
                current = '';
                i++;
                continue;
            }

            if (ch === '|' && expression[i + 1] === '|') {
                tokens.push(current);
                operators.push('||');
                current = '';
                i++;
                continue;
            }

            current += ch;
        }

        tokens.push(current);
        return { tokens, operators };
    }

    /**
     * Parse a single condition token into a structured object.
     *
     * @param token - Single condition (e.g. "age>18", "starts_with(@.name, 'J')").
     * @returns Parsed condition.
     *
     * @throws {InvalidFormatException} When the condition syntax is invalid.
     */
    private parseCondition(token: string): FilterCondition {
        const operators = ['>=', '<=', '!=', '==', '>', '<'];

        const funcCompareMatch = token.match(/^(\w+)\(([^)]*)\)\s*(>=|<=|!=|==|>|<)\s*(.+)$/);
        if (funcCompareMatch) {
            const func = funcCompareMatch[1];
            const argsRaw = funcCompareMatch[2];
            const operator = funcCompareMatch[3];
            const rawValue = funcCompareMatch[4].trim();
            const funcArgs = argsRaw.split(',').map((a) => a.trim());

            return {
                field: funcArgs[0],
                operator,
                value: this.parseValue(rawValue),
                func,
                funcArgs,
            };
        }

        const funcBoolMatch = token.match(/^(\w+)\(([^)]*)\)$/);
        if (funcBoolMatch) {
            const func = funcBoolMatch[1];
            const argsRaw = funcBoolMatch[2];
            const funcArgs = argsRaw.split(',').map((a) => a.trim());

            return {
                field: funcArgs[0],
                operator: '==',
                value: true,
                func,
                funcArgs,
            };
        }

        for (const op of operators) {
            const pos = token.indexOf(op);
            if (pos !== -1) {
                const field = token.substring(0, pos).trim();
                const rawValue = token.substring(pos + op.length).trim();

                return {
                    field,
                    operator: op,
                    value: this.parseValue(rawValue),
                };
            }
        }

        throw new InvalidFormatException(`Invalid filter condition: "${token}"`);
    }

    /**
     * Parse a raw value string to its native type.
     *
     * @param raw - Raw value (e.g. "true", "'hello'", "42").
     * @returns Native value.
     */
    private parseValue(raw: string): boolean | null | number | string {
        if (raw === 'true') return true;
        if (raw === 'false') return false;
        if (raw === 'null') return null;
        return this.parseValueDefault(raw);
    }

    /**
     * Parse a non-keyword raw value to number or string.
     *
     * @param raw - Raw value string.
     * @returns Typed value.
     */
    private parseValueDefault(raw: string): number | string {
        if (
            (raw.startsWith("'") && raw.endsWith("'")) ||
            (raw.startsWith('"') && raw.endsWith('"'))
        ) {
            return raw.substring(1, raw.length - 1);
        }

        if (!isNaN(Number(raw)) && raw !== '') {
            return raw.includes('.') ? parseFloat(raw) : parseInt(raw, 10);
        }

        return raw;
    }

    /**
     * Evaluate a single parsed condition against a data item.
     *
     * @param item - Data item.
     * @param condition - Parsed condition.
     * @returns True if the condition is satisfied.
     */
    private evaluateCondition(item: Record<string, unknown>, condition: FilterCondition): boolean {
        let fieldValue: unknown;

        if (condition.func !== undefined) {
            fieldValue = this.evaluateFunction(item, condition.func, condition.funcArgs ?? []);
        } else if (/[@\w.]+\s*[+\-*/]\s*[@\w.]+/.test(condition.field)) {
            fieldValue = this.resolveArithmetic(item, condition.field);
        } else {
            fieldValue = this.resolveField(item, condition.field);
        }

        const expected = condition.value;

        switch (condition.operator) {
            case '==':
                return fieldValue === expected;
            case '!=':
                return fieldValue !== expected;
            case '>':
                return (fieldValue as number) > (expected as number);
            case '<':
                return (fieldValue as number) < (expected as number);
            case '>=':
                return (fieldValue as number) >= (expected as number);
            case '<=':
                return (fieldValue as number) <= (expected as number);
            default:
                return false;
        }
    }

    /**
     * Dispatch and evaluate a built-in filter function.
     *
     * @param item - Data item.
     * @param func - Function name.
     * @param funcArgs - Function arguments.
     * @returns Function result.
     *
     * @throws {InvalidFormatException} When the function name is unknown.
     */
    private evaluateFunction(
        item: Record<string, unknown>,
        func: string,
        funcArgs: ReadonlyArray<string>,
    ): unknown {
        switch (func) {
            case 'starts_with':
                return this.evalStartsWith(item, funcArgs);
            case 'contains':
                return this.evalContains(item, funcArgs);
            case 'values':
                return this.evalValues(item, funcArgs);
            default:
                throw new InvalidFormatException(`Unknown filter function: "${func}"`);
        }
    }

    /**
     * Evaluate the starts_with() filter function.
     *
     * @param item - Data item.
     * @param funcArgs - [field, prefix].
     * @returns True if the field value starts with the prefix.
     */
    private evalStartsWith(
        item: Record<string, unknown>,
        funcArgs: ReadonlyArray<string>,
    ): boolean {
        const val = this.resolveFilterArg(item, funcArgs[0] ?? '@');
        if (typeof val !== 'string') {
            return false;
        }

        const prefix = String(this.parseValue((funcArgs[1] ?? '').trim()));
        return val.startsWith(prefix);
    }

    /**
     * Evaluate the contains() filter function.
     *
     * @param item - Data item.
     * @param funcArgs - [field, needle].
     * @returns True if the field value contains the needle.
     */
    private evalContains(item: Record<string, unknown>, funcArgs: ReadonlyArray<string>): boolean {
        const val = this.resolveFilterArg(item, funcArgs[0] ?? '@');
        const needle = String(this.parseValue((funcArgs[1] ?? '').trim()));

        if (typeof val === 'string') {
            return val.includes(needle);
        }

        if (Array.isArray(val)) {
            return val.includes(needle);
        }

        return false;
    }

    /**
     * Evaluate the values() filter function (returns count).
     *
     * @param item - Data item.
     * @param funcArgs - [field].
     * @returns Number of elements in the field array, or 0.
     */
    private evalValues(item: Record<string, unknown>, funcArgs: ReadonlyArray<string>): number {
        const val = this.resolveFilterArg(item, funcArgs[0] ?? '@');
        if (Array.isArray(val)) {
            return val.length;
        }
        return 0;
    }

    /**
     * Resolve an arithmetic expression from a filter predicate.
     *
     * @param item - Data item for field resolution.
     * @param expr - Arithmetic expression (e.g. "@.price * @.qty").
     * @returns Computed result, or null on failure.
     */
    private resolveArithmetic(item: Record<string, unknown>, expr: string): number | null {
        const m = expr.match(/^([@\w.]+)\s*([+\-*/])\s*([@\w.]+|\d+(?:\.\d+)?)$/);
        if (!m) {
            return null;
        }

        const toNumber = (token: string): number | null => {
            if (!token.startsWith('@') && !isNaN(Number(token)) && token !== '') {
                return token.includes('.') ? parseFloat(token) : parseInt(token, 10);
            }

            const val = this.resolveFilterArg(item, token);

            if (typeof val === 'number') {
                return val;
            }

            if (typeof val === 'string' && !isNaN(Number(val)) && val !== '') {
                return val.includes('.') ? parseFloat(val) : parseInt(val, 10);
            }

            return null;
        };

        const left = toNumber(m[1]);
        const right = toNumber(m[3]);

        if (left === null || right === null) {
            return null;
        }

        switch (m[2]) {
            case '+':
                return left + right;
            case '-':
                return left - right;
            case '*':
                return left * right;
            default:
                return right !== 0 ? left / right : null;
        }
    }

    /**
     * Resolve a filter argument to its value from the data item.
     *
     * @param item - Data item.
     * @param arg - Argument ("@", "@.field", or "field").
     * @returns Resolved value.
     */
    private resolveFilterArg(item: Record<string, unknown>, arg: string): unknown {
        if (arg === '' || arg === '@') {
            return item;
        }

        if (arg.startsWith('@.')) {
            return this.resolveField(item, arg.substring(2));
        }

        return this.resolveField(item, arg);
    }

    /**
     * Resolve a dot-separated field path from a data item.
     *
     * @param item - Data item.
     * @param field - Dot-separated field path.
     * @returns Resolved value, or null if not found.
     *
     * @throws {SecurityException} When a field key is forbidden.
     */
    private resolveField(item: Record<string, unknown>, field: string): unknown {
        if (field.includes('.')) {
            let current: unknown = item;
            for (const key of field.split('.')) {
                this.guard.assertSafeKey(key);

                if (
                    typeof current === 'object' &&
                    current !== null &&
                    Object.prototype.hasOwnProperty.call(current, key)
                ) {
                    current = (current as Record<string, unknown>)[key];
                } else {
                    return null;
                }
            }
            return current;
        }

        this.guard.assertSafeKey(field);
        return (item as Record<string, unknown>)[field] ?? null;
    }
}
