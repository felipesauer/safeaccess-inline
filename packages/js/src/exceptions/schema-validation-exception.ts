import { AccessorException } from './accessor-exception.js';
import type { SchemaError } from '../schema/schema-result.js';

/**
 * Thrown by `assert()` when data does not satisfy the given schema.
 *
 * Carries the full list of validation failures via {@link SchemaValidationException.errors},
 * and aggregates them into the exception message.
 *
 * @api
 *
 * @see AccessorException  Parent exception class.
 *
 * @example
 * try {
 *     accessor.assert({ 'user.age': 'int' });
 * } catch (e) {
 *     if (e instanceof SchemaValidationException) console.log(e.errors);
 * }
 */
export class SchemaValidationException extends AccessorException {
    /** The validation failures that caused this exception. */
    readonly errors: SchemaError[];

    /**
     * @param errors - The schema validation failures.
     * @param options - Optional cause chaining via `ErrorOptions`.
     */
    constructor(errors: SchemaError[], options?: ErrorOptions) {
        const summary = errors.map((e) => e.message).join(' ');
        super(`Schema validation failed: ${summary}`, options);
        this.name = 'SchemaValidationException';
        this.errors = [...errors];
    }
}
