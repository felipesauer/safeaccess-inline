import { InvalidFormatException } from './invalid-format-exception.js';

/**
 * Thrown when a TOML string contains invalid syntax or unsafe constructs.
 *
 * Unsafe or rejected constructs include: duplicate keys, redefined tables,
 * unterminated strings/arrays, and nesting that exceeds the configured depth.
 *
 * @api
 *
 * @see InvalidFormatException  Parent exception class.
 *
 * @example
 * throw new TomlParseException('Duplicate key "host" (line 4).');
 */
export class TomlParseException extends InvalidFormatException {
    /**
     * @param message - Description of the TOML parse failure.
     * @param options - Optional cause chaining via `ErrorOptions`.
     */
    constructor(message: string, options?: ErrorOptions) {
        super(message, options);
        this.name = 'TomlParseException';
    }
}
