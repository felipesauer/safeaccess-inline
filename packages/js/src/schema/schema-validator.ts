import { AccessorException } from '../exceptions/accessor-exception.js';
import { SchemaResult, type SchemaError } from './schema-result.js';

/** A schema maps dot-notation paths to type rules. */
export type Schema = Record<string, string>;

/** Sentinel marking an absent path — distinct from a real `null` value. */
const MISSING = Symbol('missing');

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
 * @internal
 */
export class SchemaValidator {
    /**
     * @param has - Predicate testing whether a dot-notation path exists.
     * @param get - Resolver returning the value at a path, or the fallback when absent.
     */
    constructor(
        private readonly has: (path: string) => boolean,
        private readonly get: (path: string, fallback: unknown) => unknown,
    ) {}

    /**
     * Validate the data against the schema.
     *
     * @param schema - Map of dot-notation path to type rule.
     * @returns The validation outcome (never throws for data failures).
     * @throws {AccessorException} When a rule string is not recognised (a programming error).
     *
     * @example
     * validator.validate({ 'user.age': 'int', 'user.email': 'string' });
     */
    validate(schema: Schema): SchemaResult {
        const errors: SchemaError[] = [];

        for (const path of Object.keys(schema)) {
            const raw = schema[path] as string;
            const optional = raw.endsWith('?');
            const rule = optional ? raw.slice(0, -1) : raw;

            this.assertKnownRule(rule, path);

            if (!this.has(path)) {
                if (!optional) {
                    errors.push({
                        path,
                        expected: raw,
                        actual: 'missing',
                        message: `Missing required path "${path}" (expected ${rule}).`,
                    });
                }
                continue;
            }

            const value = this.get(path, MISSING);
            if (!this.matches(rule, value)) {
                const actual = this.typeName(value);
                errors.push({
                    path,
                    expected: raw,
                    actual,
                    message: `Path "${path}" expected ${rule}, got ${actual}.`,
                });
            }
        }

        return new SchemaResult(errors);
    }

    /**
     * Reject an unrecognised rule — a mistake in the schema, not the data.
     *
     * @param rule - Rule name with any `?` already stripped.
     * @param path - Path the rule belongs to (for the message).
     * @throws {AccessorException} When the rule is not a known type.
     */
    private assertKnownRule(rule: string, path: string): void {
        const known = [
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
        if (!known.includes(rule)) {
            throw new AccessorException(`Unknown schema rule "${rule}" for path "${path}".`);
        }
    }

    /**
     * Test whether a value satisfies a (non-optional) rule.
     *
     * @param rule - Rule name.
     * @param value - Resolved value at the path.
     * @returns True when the value matches the rule.
     */
    private matches(rule: string, value: unknown): boolean {
        switch (rule) {
            case 'any':
                return true;
            case 'string':
                return typeof value === 'string';
            case 'int':
                return typeof value === 'number' && Number.isInteger(value);
            case 'float':
            case 'number':
                return typeof value === 'number' && Number.isFinite(value);
            case 'bool':
                return typeof value === 'boolean';
            case 'array':
                return Array.isArray(value);
            case 'object':
                return typeof value === 'object' && value !== null && !Array.isArray(value);
            /* Stryker disable next-line StringLiteral -- only remaining known rule is 'null' */
            default:
                return value === null;
        }
    }

    /**
     * Describe the runtime type of a value for error messages.
     *
     * @param value - Resolved value.
     * @returns A short type name (`null`, `array`, `int`, `float`, or `typeof`).
     */
    private typeName(value: unknown): string {
        if (value === null) return 'null';
        if (Array.isArray(value)) return 'array';
        if (typeof value === 'number') return Number.isInteger(value) ? 'int' : 'float';
        return typeof value;
    }
}
