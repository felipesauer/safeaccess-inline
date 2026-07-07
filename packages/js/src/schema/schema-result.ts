/**
 * A single schema validation failure.
 *
 * @api
 */
export interface SchemaError {
    /** Dot-notation path that failed validation. */
    path: string;
    /** The rule the path was expected to satisfy (e.g. `int`, `string?`). */
    expected: string;
    /** The actual type found, or `'missing'` when the path is absent. */
    actual: string;
    /** Human-readable description of the failure. */
    message: string;
}

/**
 * Outcome of validating data against a schema.
 *
 * Returned by {@link SchemaValidator.validate} and the accessor's `validate`
 * method. Never thrown — inspect {@link SchemaResult.valid} or
 * {@link SchemaResult.errors} to react to failures.
 *
 * @api
 *
 * @example
 * const result = accessor.validate({ 'user.age': 'int' });
 * if (!result.valid) {
 *     for (const error of result.errors) console.warn(error.message);
 * }
 */
export class SchemaResult {
    /**
     * @param errors - Validation failures; an empty array means the data is valid.
     */
    constructor(private readonly failures: SchemaError[]) {}

    /**
     * Whether the data satisfied the schema.
     *
     * @returns True when there are no validation errors.
     */
    get valid(): boolean {
        return this.failures.length === 0;
    }

    /**
     * The validation failures.
     *
     * @returns A copy of the error list (empty when valid).
     */
    get errors(): SchemaError[] {
        return [...this.failures];
    }

    /**
     * Group failure messages by their path, in first-seen path order.
     *
     * Convenient for surfacing per-field errors (forms, API responses)
     * without reducing the flat error list yourself.
     *
     * @returns A record mapping each failing path to its messages (empty when valid).
     *
     * @example
     * const byField = accessor.validate(schema).errorsByPath();
     * // { 'user.email': ['Path "user.email" must be a valid email.'] }
     */
    errorsByPath(): Record<string, string[]> {
        const grouped: Record<string, string[]> = {};
        for (const failure of this.failures) {
            (grouped[failure.path] ??= []).push(failure.message);
        }
        return grouped;
    }
}
