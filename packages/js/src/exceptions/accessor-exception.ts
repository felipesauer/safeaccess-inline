/**
 * Base exception for all accessor-layer errors.
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
