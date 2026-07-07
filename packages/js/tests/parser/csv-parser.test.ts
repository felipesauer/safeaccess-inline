import { describe, expect, it } from 'vitest';
import { CsvParser } from '../../src/parser/csv-parser.js';
import { CsvParseException } from '../../src/exceptions/csv-parse-exception.js';

function makeParser(delimiter?: string): CsvParser {
    return delimiter === undefined ? new CsvParser() : new CsvParser(delimiter);
}

describe(CsvParser.name, () => {
    it('parses a basic CSV document into indexed records', () => {
        expect(makeParser().parse('name,age\nAlice,30\nBob,25')).toEqual({
            '0': { name: 'Alice', age: '30' },
            '1': { name: 'Bob', age: '25' },
        });
    });

    it('parses a TSV document with a tab delimiter', () => {
        expect(makeParser('\t').parse('name\tage\nAlice\t30')).toEqual({
            '0': { name: 'Alice', age: '30' },
        });
    });

    it('returns an empty object for an empty document', () => {
        expect(makeParser().parse('')).toEqual({});
    });

    it('returns an empty object for a header-only document', () => {
        expect(makeParser().parse('name,age')).toEqual({});
    });

    it('keeps all values as strings (no numeric coercion)', () => {
        expect(makeParser().parse('id,zip\n007,01234')).toEqual({
            '0': { id: '007', zip: '01234' },
        });
    });

    it('normalizes CRLF line endings', () => {
        expect(makeParser().parse('a\r\n1\r\n2')).toEqual({ '0': { a: '1' }, '1': { a: '2' } });
    });

    it('normalizes lone CR line endings', () => {
        expect(makeParser().parse('a\r1\r2')).toEqual({ '0': { a: '1' }, '1': { a: '2' } });
    });

    it('skips fully-empty lines', () => {
        expect(makeParser().parse('a\n1\n\n2')).toEqual({ '0': { a: '1' }, '1': { a: '2' } });
    });

    it('trims a trailing newline without producing an empty record', () => {
        expect(makeParser().parse('a\n1\n')).toEqual({ '0': { a: '1' } });
    });

    it('flushes a final row that ends on a delimiter (empty last field)', () => {
        // The last field is empty but the row has content, so the final row must
        // still be flushed — exercises the `row.length > 0` half of the guard.
        expect(makeParser().parse('a,b\n1,')).toEqual({ '0': { a: '1', b: '' } });
    });

    it('flushes a final row whose first field is empty', () => {
        expect(makeParser().parse('a,b\n,2')).toEqual({ '0': { a: '', b: '2' } });
    });

    describe('quoting', () => {
        it('keeps the delimiter inside a quoted field', () => {
            expect(makeParser().parse('a,b\n"x,y",z')).toEqual({ '0': { a: 'x,y', b: 'z' } });
        });

        it('unescapes doubled quotes inside a quoted field', () => {
            expect(makeParser().parse('a\n"he said ""hi"""')).toEqual({
                '0': { a: 'he said "hi"' },
            });
        });

        it('keeps an embedded newline inside a quoted field', () => {
            expect(makeParser().parse('a,b\n"line1\nline2",z')).toEqual({
                '0': { a: 'line1\nline2', b: 'z' },
            });
        });

        it('parses an empty quoted field', () => {
            expect(makeParser().parse('a,b\n"",z')).toEqual({ '0': { a: '', b: 'z' } });
        });

        it('keeps the tab delimiter inside a quoted TSV field', () => {
            expect(makeParser('\t').parse('a\tb\n"x\ty"\tz')).toEqual({
                '0': { a: 'x\ty', b: 'z' },
            });
        });
    });

    describe('errors', () => {
        const expectThrow = (csv: string, message: RegExp, delimiter?: string): void => {
            expect(() => makeParser(delimiter).parse(csv)).toThrow(CsvParseException);
            expect(() => makeParser(delimiter).parse(csv)).toThrow(message);
        };

        it('throws when a row has fewer fields than the header', () => {
            expectThrow('a,b\n1', /Row 2 has 1 field\(s\), expected 2\./);
        });

        it('throws when a row has more fields than the header', () => {
            expectThrow('a,b\n1,2,3', /Row 2 has 3 field\(s\), expected 2\./);
        });

        it('throws on duplicate header columns', () => {
            expectThrow('a,a\n1,2', /Duplicate header column "a"\./);
        });

        it('throws on an unterminated quoted field', () => {
            expectThrow('a\n"unclosed', /Unterminated quoted field\./);
        });
    });
});
