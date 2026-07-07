import { InvalidFormatException } from './invalid-format-exception.js';

/**
 * Thrown when a CSV or TSV string contains invalid or malformed content.
 *
 * Rejected conditions include: duplicate header columns, a row whose field
 * count differs from the header, and unterminated quoted fields.
 *
 * @api
 *
 * @see InvalidFormatException  Parent exception class.
 *
 * @example
 * throw new CsvParseException('Row 3 has 2 fields, expected 3.');
 */
export class CsvParseException extends InvalidFormatException {
    /**
     * @param message - Description of the CSV/TSV parse failure.
     * @param options - Optional cause chaining via `ErrorOptions`.
     */
    constructor(message: string, options?: ErrorOptions) {
        super(message, options);
        this.name = 'CsvParseException';
    }
}
