import { AbstractAccessor } from '../abstract-accessor.js';
import { InvalidFormatException } from '../../exceptions/invalid-format-exception.js';
import { CsvParser } from '../../parser/csv-parser.js';

/**
 * Accessor for TSV (tab-separated) strings.
 *
 * The first row is the header; each subsequent row becomes an indexed record
 * keyed by the header columns. All values are strings. Uses the internal
 * {@link CsvParser} configured with a tab delimiter.
 *
 * @api
 *
 * @example
 * const accessor = new TsvAccessor(parser).from('name\tage\nAlice\t30');
 * accessor.get('0.name'); // 'Alice'
 */
export class TsvAccessor extends AbstractAccessor {
    /**
     * Hydrate from a TSV string.
     *
     * @param data - TSV string input.
     * @returns Populated accessor instance.
     * @throws {InvalidFormatException} When input is not a string.
     * @throws {CsvParseException} When the TSV is malformed.
     * @throws {SecurityException} When payload size exceeds limit.
     *
     * @example
     * accessor.from('name\tage\nAlice\t30'); // { '0': { name: 'Alice', age: '30' } }
     */
    from(data: unknown): this {
        if (typeof data !== 'string') {
            /* Stryker disable StringLiteral -- error message content is cosmetic */
            throw new InvalidFormatException(
                `TsvAccessor expects a TSV string, got ${typeof data}`,
            );
            /* Stryker restore StringLiteral */
        }

        return this.ingest(data);
    }

    /** {@inheritDoc} */
    protected parse(raw: unknown): Record<string, unknown> {
        /* Stryker disable next-line ConditionalExpression,BlockStatement,StringLiteral -- unreachable: from() always validates string before ingest() */
        /* c8 ignore start */
        if (typeof raw !== 'string') {
            return {};
        }
        /* c8 ignore stop */

        return new CsvParser('\t').parse(raw);
    }
}
