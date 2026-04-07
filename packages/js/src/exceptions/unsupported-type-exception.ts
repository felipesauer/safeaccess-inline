import { AccessorException } from './accessor-exception.js';

/**
 * Thrown when the requested format or TypeFormat value is not supported.
 *
 * @example
 * throw new UnsupportedTypeException('TypeFormat.Csv is not supported.');
 */
export class UnsupportedTypeException extends AccessorException {
    /**
     * @param message - Description of the unsupported type.
     * @param options - Optional cause chaining via `ErrorOptions`.
     */
    constructor(message: string, options?: ErrorOptions) {
        super(message, options);
        this.name = 'UnsupportedTypeException';
    }
}
