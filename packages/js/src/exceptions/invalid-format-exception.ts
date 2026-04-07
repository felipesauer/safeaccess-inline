import { AccessorException } from './accessor-exception.js';

/**
 * Thrown when the input data cannot be parsed as the expected format.
 *
 * @example
 * throw new InvalidFormatException('Expected JSON string, got number.');
 */
export class InvalidFormatException extends AccessorException {
    /**
     * @param message - Description of the format violation.
     * @param options - Optional cause chaining via `ErrorOptions`.
     */
    constructor(message: string, options?: ErrorOptions) {
        super(message, options);
        this.name = 'InvalidFormatException';
    }
}
