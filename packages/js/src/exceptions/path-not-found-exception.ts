import { AccessorException } from './accessor-exception.js';

/**
 * Thrown when a dot-notation path does not exist in the data.
 *
 * @example
 * throw new PathNotFoundException("Path 'user.address.zip' not found.");
 */
export class PathNotFoundException extends AccessorException {
    /**
     * @param message - Description including the missing path.
     * @param options - Optional cause chaining via `ErrorOptions`.
     */
    constructor(message: string, options?: ErrorOptions) {
        super(message, options);
        this.name = 'PathNotFoundException';
    }
}
