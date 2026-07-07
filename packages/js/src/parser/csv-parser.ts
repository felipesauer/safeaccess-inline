import { CsvParseException } from '../exceptions/csv-parse-exception.js';

/**
 * Minimal CSV/TSV parser following a safe subset of RFC 4180.
 *
 * The first non-empty logical row is the header; every subsequent row becomes
 * an indexed record whose keys are the header columns. All values are kept as
 * strings — CSV has no type system, so no numeric/boolean coercion is applied.
 *
 * Fields may be quoted with double quotes to embed the delimiter, escaped
 * quotes (`""`), or newlines. Rows whose field count differs from the header,
 * duplicate header columns, and unterminated quotes are rejected.
 *
 * Does not depend on external CSV libraries, making the package portable.
 * Behaviour is mirrored in the PHP implementation for parity.
 *
 * @internal
 */
export class CsvParser {
    private readonly delimiter: string;

    /**
     * @param delimiter - Field delimiter: `,` for CSV, `\t` for TSV.
     */
    constructor(delimiter: string = ',') {
        this.delimiter = delimiter;
    }

    /**
     * Parse a CSV/TSV string into an indexed record of row objects.
     *
     * @param csv - Raw CSV/TSV content.
     * @returns Parsed rows keyed by their zero-based index.
     * @throws {CsvParseException} When quotes are unterminated, the header has
     *   duplicate columns, or a row's field count differs from the header.
     *
     * @example
     * new CsvParser().parse('name,age\nAlice,30'); // { '0': { name: 'Alice', age: '30' } }
     */
    parse(csv: string): Record<string, unknown> {
        const normalized = csv.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
        const rows = this.splitRows(normalized);

        // Drop leading/trailing fully-empty rows (a single empty field).
        const dataRows = rows.filter((row) => !(row.length === 1 && row[0] === ''));
        if (dataRows.length === 0) {
            return {};
        }

        const header = dataRows[0] as string[];
        this.assertUniqueColumns(header);

        const result: Record<string, unknown> = {};
        for (let i = 1; i < dataRows.length; i++) {
            const row = dataRows[i] as string[];
            if (row.length !== header.length) {
                throw new CsvParseException(
                    `Row ${i + 1} has ${row.length} field(s), expected ${header.length}.`,
                );
            }
            // Null-prototype object so a `__proto__` (or other pollution) header
            // becomes an own enumerable key the SecurityGuard can reject, rather
            // than silently mutating the prototype chain.
            const record: Record<string, string> = Object.create(null) as Record<string, string>;
            for (let c = 0; c < header.length; c++) {
                record[header[c] as string] = row[c] as string;
            }
            result[String(i - 1)] = record;
        }

        return result;
    }

    /**
     * Reject a header that repeats a column name (ambiguous access).
     *
     * @param header - Parsed header fields.
     * @throws {CsvParseException} When a column name appears more than once.
     */
    private assertUniqueColumns(header: string[]): void {
        const seen = new Set<string>();
        for (const column of header) {
            if (seen.has(column)) {
                throw new CsvParseException(`Duplicate header column "${column}".`);
            }
            seen.add(column);
        }
    }

    /**
     * Split the document into rows of fields, honouring quoted regions that may
     * span delimiters and newlines.
     *
     * @param input - Newline-normalized CSV/TSV content.
     * @returns Rows, each an array of unquoted field strings.
     * @throws {CsvParseException} When a quoted field is never closed.
     */
    private splitRows(input: string): string[][] {
        const rows: string[][] = [];
        let field = '';
        let row: string[] = [];
        let inQuotes = false;

        for (let i = 0; i < input.length; i++) {
            const ch = input[i] as string;

            if (inQuotes) {
                if (ch === '"') {
                    if (input[i + 1] === '"') {
                        // Escaped quote inside a quoted field.
                        field += '"';
                        i++;
                    } else {
                        inQuotes = false;
                    }
                } else {
                    field += ch;
                }
                continue;
            }

            if (ch === '"') {
                inQuotes = true;
                continue;
            }

            if (ch === this.delimiter) {
                row.push(field);
                field = '';
                continue;
            }

            if (ch === '\n') {
                row.push(field);
                rows.push(row);
                field = '';
                row = [];
                continue;
            }

            field += ch;
        }

        if (inQuotes) {
            throw new CsvParseException('Unterminated quoted field.');
        }

        // Flush the final field/row unless the input ended exactly on a newline.
        if (field !== '' || row.length > 0) {
            row.push(field);
            rows.push(row);
        }

        return rows;
    }
}
