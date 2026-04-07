import { InvalidFormatException } from './invalid-format-exception.js';

/**
 * Thrown when a YAML string contains invalid syntax or unsafe constructs.
 *
 * Unsafe constructs include: tags (!! and !), anchors (&), aliases (*),
 * and merge keys (<<).
 *
 * @example
 * throw new YamlParseException('YAML anchors are not supported (line 3).');
 */
export class YamlParseException extends InvalidFormatException {
    /**
     * @param message - Description of the YAML parse failure.
     * @param options - Optional cause chaining via `ErrorOptions`.
     */
    constructor(message: string, options?: ErrorOptions) {
        super(message, options);
        this.name = 'YamlParseException';
    }
}
