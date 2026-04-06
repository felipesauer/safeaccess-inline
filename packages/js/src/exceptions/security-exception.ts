import { AccessorException } from './accessor-exception.js';

/**
 * Thrown when a security validation check fails.
 *
 * Covers forbidden keys (prototype pollution vectors, legacy prototype manipulation
 * methods, stream wrapper / protocol URI schemes, Node.js globals),
 * payload size violations, key-count limits, and depth limit violations.
 *
 * @example
 * throw new SecurityException("Forbidden key '__proto__' detected.");
 */
export class SecurityException extends AccessorException {
    /**
     * @param message - Description of the security violation.
     * @param options - Optional cause chaining via `ErrorOptions`.
     */
    constructor(message: string, options?: ErrorOptions) {
        super(message, options);
        this.name = 'SecurityException';
    }
}
