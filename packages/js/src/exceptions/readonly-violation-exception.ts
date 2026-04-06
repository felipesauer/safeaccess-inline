import { AccessorException } from './accessor-exception.js';

/**
 * Thrown when a write operation is attempted on a readonly accessor.
 *
 * @example
 * const accessor = Inline.fromJson('{}').readonly(true);
 * accessor.set('key', 'value'); // throws ReadonlyViolationException
 */
export class ReadonlyViolationException extends AccessorException {
    /**
     * @param message - Error message. Defaults to 'Cannot modify a readonly accessor.'
     * @param options - Optional cause chaining via `ErrorOptions`.
     */
    constructor(message: string = 'Cannot modify a readonly accessor.', options?: ErrorOptions) {
        super(message, options);
        this.name = 'ReadonlyViolationException';
    }
}
