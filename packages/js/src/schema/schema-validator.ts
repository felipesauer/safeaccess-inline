import { AccessorException } from '../exceptions/accessor-exception.js';
import { SchemaResult, type SchemaError } from './schema-result.js';

/** A schema maps dot-notation paths to type rules. */
export type Schema = Record<string, string>;

/** Sentinel marking an absent path — distinct from a real `null` value. */
const MISSING = Symbol('missing');

/** A single parsed constraint (the part after the type in a pipe rule). */
interface Constraint {
    name: string;
    arg: string;
}

/** A rule parsed into its optional flag, base type, and constraints. */
interface ParsedRule {
    optional: boolean;
    type: string;
    constraints: Constraint[];
}

const KNOWN_TYPES = ['string', 'int', 'float', 'number', 'bool', 'array', 'object', 'null', 'any'];
const CONSTRAINT_NAMES = ['min', 'max', 'enum', 'pattern', 'email', 'url', 'uuid'];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const URL_RE = /^https?:\/\/[^\s/$.?#].[^\s]*$/i;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
     * @param schema - Map of dot-notation path to rule.
     * @returns The validation outcome (never throws for data failures).
     * @throws {AccessorException} When a rule is malformed (a programming error).
     *
     * @example
     * validator.validate({ 'user.age': 'int|min:0', 'user.email': 'string|email' });
     */
    validate(schema: Schema): SchemaResult {
        const errors: SchemaError[] = [];

        for (const path of Object.keys(schema)) {
            const raw = schema[path] as string;
            const parsed = this.parseRule(raw, path);

            if (!this.has(path)) {
                if (!parsed.optional) {
                    errors.push({
                        path,
                        expected: raw,
                        actual: 'missing',
                        message: `Missing required path "${path}" (expected ${parsed.type}).`,
                    });
                }
                continue;
            }

            const value = this.get(path, MISSING);
            if (!this.matchesType(parsed.type, value)) {
                errors.push({
                    path,
                    expected: raw,
                    actual: this.typeName(value),
                    message: `Path "${path}" expected ${parsed.type}, got ${this.typeName(value)}.`,
                });
                continue;
            }

            const failure = this.checkConstraints(parsed, value, path);
            if (failure !== null) {
                errors.push({ ...failure, expected: raw });
            }
        }

        return new SchemaResult(errors);
    }

    /**
     * Parse a raw rule string into its optional flag, type, and constraints.
     *
     * @param raw - Rule string, e.g. `int|min:1|max:10?`.
     * @param path - Path the rule belongs to (for error messages).
     * @returns The parsed rule.
     * @throws {AccessorException} When the type or a constraint is unrecognised or malformed.
     */
    private parseRule(raw: string, path: string): ParsedRule {
        const optional = raw.endsWith('?');
        const body = optional ? raw.slice(0, -1) : raw;
        const parts = body.split('|');
        const type = parts[0] as string;

        if (!KNOWN_TYPES.includes(type)) {
            throw new AccessorException(`Unknown schema rule "${type}" for path "${path}".`);
        }

        const constraints: Constraint[] = [];
        for (let i = 1; i < parts.length; i++) {
            const part = parts[i] as string;
            const colon = part.indexOf(':');
            const name = colon === -1 ? part : part.slice(0, colon);
            const arg = colon === -1 ? '' : part.slice(colon + 1);

            if (!CONSTRAINT_NAMES.includes(name)) {
                throw new AccessorException(
                    `Unknown schema constraint "${name}" for path "${path}".`,
                );
            }
            this.assertConstraintArg(name, arg, path);
            constraints.push({ name, arg });
        }

        return { optional, type, constraints };
    }

    /**
     * Validate that a constraint's argument is well-formed at parse time.
     *
     * @param name - Constraint name.
     * @param arg - Raw argument text.
     * @param path - Path for error messages.
     * @throws {AccessorException} When the argument is missing or malformed.
     */
    private assertConstraintArg(name: string, arg: string, path: string): void {
        if (name === 'min' || name === 'max') {
            if (!/^-?\d+(?:\.\d+)?$/.test(arg)) {
                throw new AccessorException(
                    `Schema constraint "${name}" needs a numeric argument for path "${path}".`,
                );
            }
        } else if (name === 'enum') {
            if (arg === '') {
                throw new AccessorException(
                    `Schema constraint "enum" is empty for path "${path}".`,
                );
            }
        } else if (name === 'pattern') {
            try {
                new RegExp(arg);
            } catch {
                throw new AccessorException(
                    `Schema constraint "pattern" has an invalid regex for path "${path}".`,
                );
            }
        }
    }

    /**
     * Apply every constraint to a value, returning the first failure.
     *
     * @param parsed - The parsed rule.
     * @param value - Resolved value (already type-checked).
     * @param path - Path for error messages.
     * @returns A partial SchemaError (without `expected`) or null when all pass.
     */
    private checkConstraints(
        parsed: ParsedRule,
        value: unknown,
        path: string,
    ): Omit<SchemaError, 'expected'> | null {
        for (const { name, arg } of parsed.constraints) {
            const message = this.checkOne(name, arg, value, path);
            if (message !== null) {
                return { path, actual: this.describe(value), message };
            }
        }
        return null;
    }

    /**
     * Evaluate a single constraint against a value.
     *
     * @param name - Constraint name.
     * @param arg - Constraint argument.
     * @param value - Resolved value.
     * @param path - Path for the message.
     * @returns An error message, or null when the constraint holds.
     */
    private checkOne(name: string, arg: string, value: unknown, path: string): string | null {
        switch (name) {
            case 'min':
                return this.checkBound(path, value, Number(arg), true);
            case 'max':
                return this.checkBound(path, value, Number(arg), false);
            case 'enum':
                return this.checkEnum(path, value, arg);
            case 'pattern':
                return typeof value === 'string' && new RegExp(arg).test(value)
                    ? null
                    : `Path "${path}" must match pattern ${arg}.`;
            case 'email':
                return typeof value === 'string' && EMAIL_RE.test(value)
                    ? null
                    : `Path "${path}" must be a valid email.`;
            case 'url':
                return typeof value === 'string' && URL_RE.test(value)
                    ? null
                    : `Path "${path}" must be a valid URL.`;
            /* Stryker disable next-line StringLiteral -- only remaining constraint is 'uuid' */
            default:
                return typeof value === 'string' && UUID_RE.test(value)
                    ? null
                    : `Path "${path}" must be a valid UUID.`;
        }
    }

    /**
     * Check a `min`/`max` bound against a number (by value) or string/array (by length).
     *
     * @param path - Path for the message.
     * @param value - Resolved value.
     * @param bound - Numeric bound.
     * @param isMin - True for `min` (>=), false for `max` (<=).
     * @returns An error message, or null when the bound holds.
     */
    private checkBound(path: string, value: unknown, bound: number, isMin: boolean): string | null {
        if (typeof value === 'number') {
            const ok = isMin ? value >= bound : value <= bound;
            return ok
                ? null
                : `Path "${path}" must be ${isMin ? '>=' : '<='} ${bound}, got ${value}.`;
        }
        if (typeof value === 'string' || Array.isArray(value)) {
            const len = value.length;
            const ok = isMin ? len >= bound : len <= bound;
            return ok
                ? null
                : `Path "${path}" length must be ${isMin ? '>=' : '<='} ${bound}, got ${len}.`;
        }
        return `Path "${path}" ${isMin ? 'min' : 'max'} constraint requires a number, string, or array.`;
    }

    /**
     * Check that a value is one of a comma-separated enum list.
     *
     * @param path - Path for the message.
     * @param value - Resolved value (string or number).
     * @param arg - Comma-separated allowed values.
     * @returns An error message, or null when the value is allowed.
     */
    private checkEnum(path: string, value: unknown, arg: string): string | null {
        const allowed = arg.split(',');
        const asString = typeof value === 'number' ? String(value) : value;
        if (typeof asString === 'string' && allowed.includes(asString)) {
            return null;
        }
        return `Path "${path}" must be one of [${allowed.join(', ')}], got ${this.describe(value)}.`;
    }

    /**
     * Test whether a value satisfies a base type.
     *
     * @param type - Base type name.
     * @param value - Resolved value at the path.
     * @returns True when the value matches the type.
     */
    private matchesType(type: string, value: unknown): boolean {
        switch (type) {
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
            /* Stryker disable next-line StringLiteral -- only remaining known type is 'null' */
            default:
                return value === null;
        }
    }

    /**
     * Describe the runtime type of a value for type-mismatch messages.
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

    /**
     * Render a value for constraint-failure messages (quotes strings).
     *
     * @param value - Resolved value.
     * @returns A short human-readable rendering.
     */
    private describe(value: unknown): string {
        if (typeof value === 'string') return `"${value}"`;
        if (value === null) return 'null';
        if (Array.isArray(value)) return 'array';
        if (typeof value === 'object') return 'object';
        return String(value);
    }
}
