import { AccessorException } from './accessor-exception.js';

/**
 * Thrown when an underlying parser encounters a structural error.
 *
 * @example
 * throw new ParserException('Parser failed to process input.');
 */
export class ParserException extends AccessorException {
    /**
     * @param message - Description of the parser failure.
     * @param options - Optional cause chaining via `ErrorOptions`.
     */
    constructor(message: string, options?: ErrorOptions) {
        super(message, options);
        this.name = 'ParserException';
    }
}
