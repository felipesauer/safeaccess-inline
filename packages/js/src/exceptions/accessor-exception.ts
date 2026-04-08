/**
 * Base exception for all accessor-layer errors.
 *
 * @api
 *
 * @see InvalidFormatException  Thrown on malformed input data.
 * @see ParserException         Thrown on parser-level operational errors.
 * @see PathNotFoundException   Thrown when a requested path does not exist.
 * @see SecurityException       Thrown on security constraint violations.
 * @see ReadonlyViolationException Thrown on write attempts to a readonly accessor.
 * @see UnsupportedTypeException   Thrown when an unsupported format is requested.
 *
 * @example
 * throw new AccessorException('Something went wrong.');
 */
export class AccessorException extends Error {
    /**
     * @param message - Human-readable error description.
     * @param options - Optional cause chaining via `ErrorOptions`.
     */
    constructor(message: string, options?: ErrorOptions) {
        super(message, options);
        this.name = 'AccessorException';
    }
}
