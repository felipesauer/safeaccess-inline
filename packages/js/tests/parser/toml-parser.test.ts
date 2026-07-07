import { describe, expect, it } from 'vitest';
import { TomlParser } from '../../src/parser/toml-parser.js';
import { TomlParseException } from '../../src/exceptions/toml-parse-exception.js';

function makeParser(maxDepth?: number): TomlParser {
    return maxDepth === undefined ? new TomlParser() : new TomlParser(maxDepth);
}

describe(TomlParser.name, () => {
    it('parses a simple key-value pair', () => {
        expect(makeParser().parse('name = "Alice"')).toEqual({ name: 'Alice' });
    });

    it('returns empty object for empty string', () => {
        expect(makeParser().parse('')).toEqual({});
    });

    it('returns empty object for comment-only input', () => {
        expect(makeParser().parse('# comment only')).toEqual({});
    });

    it('normalizes CRLF line endings', () => {
        expect(makeParser().parse('a = 1\r\nb = 2')).toEqual({ a: 1, b: 2 });
    });

    it('parses multiple root-level keys', () => {
        expect(makeParser().parse('a = 1\nb = 2')).toEqual({ a: 1, b: 2 });
    });

    it('parses a standard table', () => {
        expect(makeParser().parse('[server]\nhost = "0.0.0.0"')).toEqual({
            server: { host: '0.0.0.0' },
        });
    });

    it('parses a dotted table header', () => {
        expect(makeParser().parse('[a.b.c]\nx = 1')).toEqual({ a: { b: { c: { x: 1 } } } });
    });

    it('parses dotted keys', () => {
        expect(makeParser().parse('a.b.c = 1')).toEqual({ a: { b: { c: 1 } } });
    });

    it('parses an array of tables', () => {
        expect(makeParser().parse('[[p]]\nn = "A"\n[[p]]\nn = "B"')).toEqual({
            p: [{ n: 'A' }, { n: 'B' }],
        });
    });

    it('descends into the latest array-of-tables element for a sub-table', () => {
        const r = makeParser().parse('[[p]]\nn = "A"\n[p.meta]\nk = 1');
        expect(r).toEqual({ p: [{ n: 'A', meta: { k: 1 } }] });
    });

    it('parses inline arrays', () => {
        expect(makeParser().parse('x = [1, 2, 3]')).toEqual({ x: [1, 2, 3] });
    });

    it('parses empty inline arrays', () => {
        expect(makeParser().parse('x = []')).toEqual({ x: [] });
    });

    it('parses nested inline arrays', () => {
        expect(makeParser().parse('x = [[1, 2], [3]]')).toEqual({ x: [[1, 2], [3]] });
    });

    it('parses multi-line inline arrays', () => {
        expect(makeParser().parse('x = [\n  1,\n  2,\n  3,\n]')).toEqual({ x: [1, 2, 3] });
    });

    it('parses inline tables', () => {
        expect(makeParser().parse('p = { x = 1, y = 2 }')).toEqual({ p: { x: 1, y: 2 } });
    });

    it('parses empty inline tables', () => {
        expect(makeParser().parse('p = {}')).toEqual({ p: {} });
    });

    it('keeps separators inside quoted array items', () => {
        expect(makeParser().parse('x = ["a,b", "c]d"]')).toEqual({ x: ['a,b', 'c]d'] });
    });

    it('keeps separators inside quoted inline-table values', () => {
        expect(makeParser().parse('p = { a = "x,y", b = 1 }')).toEqual({ p: { a: 'x,y', b: 1 } });
    });

    it('keeps separators inside triple-quoted array items', () => {
        expect(makeParser().parse('x = ["""a,]b""", "c"]')).toEqual({ x: ['a,]b', 'c'] });
    });

    it('tolerates a trailing comma in inline tables', () => {
        expect(makeParser().parse('p = { a = 1, }')).toEqual({ p: { a: 1 } });
    });

    it('skips empty items between separators', () => {
        expect(makeParser().parse('x = [1, , 2]')).toEqual({ x: [1, 2] });
    });

    it('descends into a pre-existing sub-table via a table header', () => {
        expect(makeParser().parse('[a]\nx = 1\n[a.b]\ny = 2')).toEqual({
            a: { x: 1, b: { y: 2 } },
        });
    });

    it('extends a table opened by a dotted key', () => {
        expect(makeParser().parse('a.b = 1\na.c = 2')).toEqual({ a: { b: 1, c: 2 } });
    });

    describe('string-state scanners', () => {
        // These target the quote/comment state machines in findAssignment,
        // parseKeyPath, splitTopLevel, hasOpenBracket, and stripComment.

        it('finds the assignment = even when a quoted value contains =', () => {
            expect(makeParser().parse('a = "x = y"')).toEqual({ a: 'x = y' });
        });

        it('finds the assignment = even when a quoted key contains =', () => {
            expect(makeParser().parse('"a=b" = 1')).toEqual({ 'a=b': 1 });
        });

        it('does not treat # inside a single-quoted value as a comment', () => {
            expect(makeParser().parse("a = 'has # hash'")).toEqual({ a: 'has # hash' });
        });

        it('does not split a dotted key inside quotes', () => {
            expect(makeParser().parse('"a.b.c" = 1')).toEqual({ 'a.b.c': 1 });
        });

        it('handles single-quoted keys with dots and a following segment', () => {
            expect(makeParser().parse("'a.b'.c = 1")).toEqual({ 'a.b': { c: 1 } });
        });

        it('keeps brackets inside single-quoted array items intact', () => {
            expect(makeParser().parse("x = ['a[0]', 'b']")).toEqual({ x: ['a[0]', 'b'] });
        });

        it('keeps braces inside quoted inline-table values intact', () => {
            expect(makeParser().parse('p = { a = "{not a table}", b = 2 }')).toEqual({
                p: { a: '{not a table}', b: 2 },
            });
        });

        it('spans a multi-line inline table across lines', () => {
            expect(makeParser().parse('p = {\n  a = 1,\n  b = 2,\n}')).toEqual({
                p: { a: 1, b: 2 },
            });
        });

        it('does not confuse a # inside a table header with a comment boundary', () => {
            expect(makeParser().parse('["a#b"]\nk = 1')).toEqual({ 'a#b': { k: 1 } });
        });

        it('keeps a comment marker inside a quoted key out of stripping', () => {
            expect(makeParser().parse('a = 1  # tail\nb = 2')).toEqual({ a: 1, b: 2 });
        });

        it('keeps a comma inside a single-quoted array item', () => {
            expect(makeParser().parse("x = ['a,b', 'c']")).toEqual({ x: ['a,b', 'c'] });
        });

        it('keeps a comma inside a triple-single-quoted array item', () => {
            expect(makeParser().parse("x = ['''a,b''', 'c']")).toEqual({ x: ['a,b', 'c'] });
        });

        it('mixes single and double quoted items in one array', () => {
            expect(makeParser().parse('x = [\'a,1\', "b,2", 3]')).toEqual({ x: ['a,1', 'b,2', 3] });
        });

        it('keeps a comma inside a triple-double-quoted array item', () => {
            expect(makeParser().parse('x = ["""a,b""", "c,d"]')).toEqual({ x: ['a,b', 'c,d'] });
        });

        it('does not split on a brace inside a quoted string in an array', () => {
            expect(makeParser().parse('x = ["a}b", "c{d"]')).toEqual({ x: ['a}b', 'c{d'] });
        });

        it('parses a nested inline table inside an inline array', () => {
            expect(makeParser().parse('x = [{ a = 1 }, { b = 2 }]')).toEqual({
                x: [{ a: 1 }, { b: 2 }],
            });
        });

        it('parses a dotted quoted key mixing quote styles', () => {
            expect(makeParser().parse('"a"."b" = 1')).toEqual({ a: { b: 1 } });
        });
    });

    describe('value-type dispatch boundaries', () => {
        // Target the startsWith/endsWith/length guards in parseValue for each type.

        it('parses an empty multi-line basic string (exactly six quotes)', () => {
            expect(makeParser().parse('a = """"""')).toEqual({ a: '' });
        });

        it('parses an empty multi-line literal string (exactly six quotes)', () => {
            expect(makeParser().parse("a = ''''''")).toEqual({ a: '' });
        });

        it('parses an empty basic string', () => {
            expect(makeParser().parse('a = ""')).toEqual({ a: '' });
        });

        it('parses an empty literal string', () => {
            expect(makeParser().parse("a = ''")).toEqual({ a: '' });
        });

        it('keeps a single double-quote inside a multi-line basic string', () => {
            expect(makeParser().parse('a = """he said "hi" ok"""')).toEqual({
                a: 'he said "hi" ok',
            });
        });

        it('treats a bare word starting with a quote-like char as a string', () => {
            expect(makeParser().parse('a = "only-opening')).toEqual({ a: '"only-opening' });
        });

        it('distinguishes an inline array from an inline table by delimiter', () => {
            expect(makeParser().parse('a = [1]\nb = { x = 1 }')).toEqual({
                a: [1],
                b: { x: 1 },
            });
        });

        it('parses a single-element array without a trailing comma', () => {
            expect(makeParser().parse('a = [42]')).toEqual({ a: [42] });
        });
    });

    describe('scalar types', () => {
        it('casts integers', () => {
            expect(makeParser().parse('a = 42\nb = -17\nc = +99')).toEqual({
                a: 42,
                b: -17,
                c: 99,
            });
        });

        it('casts integers with underscore separators', () => {
            expect(makeParser().parse('a = 1_000_000')).toEqual({ a: 1000000 });
        });

        it('casts hex, octal, and binary integers', () => {
            expect(makeParser().parse('h = 0xFF\no = 0o755\nb = 0b1010')).toEqual({
                h: 255,
                o: 493,
                b: 10,
            });
        });

        it('casts based integers with underscore separators', () => {
            expect(makeParser().parse('h = 0xDE_AD\no = 0o7_5_5\nb = 0b1010_0101')).toEqual({
                h: 0xdead,
                o: 0o755,
                b: 0b10100101,
            });
        });

        it('distinguishes +inf, -inf, and inf', () => {
            const r = makeParser().parse('a = inf\nb = +inf\nc = -inf');
            expect(r.a).toBe(Infinity);
            expect(r.b).toBe(Infinity);
            expect(r.c).toBe(-Infinity);
        });

        it('recognizes signed nan variants', () => {
            const r = makeParser().parse('a = nan\nb = +nan\nc = -nan');
            expect(Number.isNaN(r.a)).toBe(true);
            expect(Number.isNaN(r.b)).toBe(true);
            expect(Number.isNaN(r.c)).toBe(true);
        });

        it('casts floats with underscore separators and signed exponents', () => {
            expect(makeParser().parse('a = 1_000.000_1\nb = 1e-3\nc = +2.5')).toEqual({
                a: 1000.0001,
                b: 0.001,
                c: 2.5,
            });
        });

        it('casts floats', () => {
            expect(makeParser().parse('a = 3.14\nb = -0.1\nc = 5e3\nd = 6.02e2')).toEqual({
                a: 3.14,
                b: -0.1,
                c: 5000,
                d: 602,
            });
        });

        it('casts float special values', () => {
            const r = makeParser().parse('a = inf\nb = -inf\nc = nan');
            expect(r.a).toBe(Infinity);
            expect(r.b).toBe(-Infinity);
            expect(Number.isNaN(r.c)).toBe(true);
        });

        it('casts booleans (lowercase only)', () => {
            expect(makeParser().parse('a = true\nb = false')).toEqual({ a: true, b: false });
        });

        it('keeps capitalized booleans as strings', () => {
            expect(makeParser().parse('a = True')).toEqual({ a: 'True' });
        });

        it('preserves datetimes as strings', () => {
            expect(makeParser().parse('a = 1979-05-27T07:32:00Z')).toEqual({
                a: '1979-05-27T07:32:00Z',
            });
        });

        // The following exercise the regex boundaries in castScalar: inputs that
        // must NOT match a number pattern and therefore fall through to string.
        it('keeps a lone base prefix as a string', () => {
            expect(makeParser().parse('a = "0x"\nb = "0o"\nc = "0b"')).toEqual({
                a: '0x',
                b: '0o',
                c: '0b',
            });
        });

        it('rejects an invalid hex digit and keeps it a string', () => {
            expect(makeParser().parse('a = "0xZZ"')).toEqual({ a: '0xZZ' });
        });

        it('does not match a base prefix that is not at the start', () => {
            // Kills regex mutants that drop the ^ anchor: "g0xFF" must stay a string.
            expect(makeParser().parse('a = "g0xFF"\nb = "z0o7"\nc = "y0b1"')).toEqual({
                a: 'g0xFF',
                b: 'z0o7',
                c: 'y0b1',
            });
        });

        it('does not match a base prefix with a trailing invalid char', () => {
            // Kills regex mutants that drop the $ anchor: trailing junk must reject.
            expect(makeParser().parse('a = "0xFFg"\nb = "0o7x"\nc = "0b1x"')).toEqual({
                a: '0xFFg',
                b: '0o7x',
                c: '0b1x',
            });
        });

        it('does not match a decimal with trailing junk', () => {
            // Kills regex mutants dropping ^ / $ on the float/int patterns.
            expect(makeParser().parse('a = "123abc"\nb = "x12.5"')).toEqual({
                a: '123abc',
                b: 'x12.5',
            });
        });

        it('parses a single-digit hex/octal/binary (optional group absent)', () => {
            // Kills the mutant that drops the optional (?:...)? repetition group.
            expect(makeParser().parse('a = 0xF\nb = 0o7\nc = 0b1')).toEqual({
                a: 15,
                b: 7,
                c: 1,
            });
        });

        it('rejects an octal digit out of range', () => {
            expect(makeParser().parse('a = "0o8"')).toEqual({ a: '0o8' });
        });

        it('rejects a binary digit out of range', () => {
            expect(makeParser().parse('a = "0b2"')).toEqual({ a: '0b2' });
        });

        it('does not treat a leading-zero decimal as an integer', () => {
            // Bare 007 is not a valid TOML integer; preserved verbatim as string.
            expect(makeParser().parse('a = "007"')).toEqual({ a: '007' });
        });

        it('parses zero as an integer, not a float', () => {
            const r = makeParser().parse('a = 0');
            expect(r.a).toBe(0);
            expect(Number.isInteger(r.a)).toBe(true);
        });

        it('requires a fractional or exponent part to be a float', () => {
            const r = makeParser().parse('a = 10\nb = 10.5\nc = 1e1');
            expect(r.a).toBe(10);
            expect(r.b).toBe(10.5);
            expect(r.c).toBe(10);
        });
    });

    describe('strings', () => {
        it('parses basic strings with escapes', () => {
            expect(makeParser().parse('a = "line1\\nline2\\ttab"')).toEqual({
                a: 'line1\nline2\ttab',
            });
        });

        it('parses unicode escapes', () => {
            expect(makeParser().parse('a = "\\u00e9"')).toEqual({ a: 'é' });
        });

        it('parses long unicode escapes', () => {
            expect(makeParser().parse('a = "\\U0001F600"')).toEqual({ a: '\u{1F600}' });
        });

        it('parses literal strings without escaping', () => {
            expect(makeParser().parse("a = 'C:\\path\\file'")).toEqual({ a: 'C:\\path\\file' });
        });

        it('parses multi-line basic strings', () => {
            expect(makeParser().parse('a = """\nline1\nline2"""')).toEqual({ a: 'line1\nline2' });
        });

        it('keeps content when no newline follows the opening delimiter', () => {
            expect(makeParser().parse('a = """inline\ntext"""')).toEqual({ a: 'inline\ntext' });
        });

        it('parses multi-line literal strings', () => {
            expect(makeParser().parse("a = '''\nraw\\nnot-escaped'''")).toEqual({
                a: 'raw\\nnot-escaped',
            });
        });

        it('folds line-ending backslashes in multi-line basic strings', () => {
            expect(makeParser().parse('a = """\\\n  continued"""')).toEqual({ a: 'continued' });
        });

        it('keeps # inside strings out of comment stripping', () => {
            expect(makeParser().parse('a = "not # a comment"')).toEqual({ a: 'not # a comment' });
        });
    });

    describe('comments', () => {
        it('ignores full-line comments', () => {
            expect(makeParser().parse('# top\na = 1\n# mid\nb = 2')).toEqual({ a: 1, b: 2 });
        });

        it('strips inline comments', () => {
            expect(makeParser().parse('a = 1 # trailing')).toEqual({ a: 1 });
        });
    });

    describe('quoted keys', () => {
        it('parses double-quoted keys', () => {
            expect(makeParser().parse('"a.b" = 1')).toEqual({ 'a.b': 1 });
        });

        it('parses single-quoted keys', () => {
            expect(makeParser().parse("'key with spaces' = 1")).toEqual({ 'key with spaces': 1 });
        });
    });

    describe('errors', () => {
        const expectThrow = (toml: string, message: RegExp, maxDepth?: number): void => {
            expect(() => makeParser(maxDepth).parse(toml)).toThrow(TomlParseException);
            expect(() => makeParser(maxDepth).parse(toml)).toThrow(message);
        };

        it('throws on a line without an assignment or header', () => {
            expectThrow('garbage line', /expected '=' \(line 1\): garbage line/);
        });

        it('throws on duplicate keys', () => {
            expectThrow('a = 1\na = 2', /Duplicate key "a" \(line 2\)/);
        });

        it('throws on duplicate keys within a table', () => {
            expectThrow('[t]\na = 1\na = 2', /Duplicate key "a" in table "t" \(line 3\)/);
        });

        it('throws on table redefinition', () => {
            expectThrow('[t]\na = 1\n[t]\nb = 2', /Redefinition of table "t" \(line 3\)/);
        });

        it('throws when a table redefines an array of tables', () => {
            expectThrow('[[t]]\na = 1\n[t]\nb = 2', /Redefinition of table "t" \(line 3\)/);
        });

        it('throws when an array of tables redefines a table', () => {
            expectThrow(
                '[t]\na = 1\n[[t]]\nb = 2',
                /Cannot redefine table "t" as an array of tables \(line 3\)/,
            );
        });

        it('throws when an array-of-tables header targets a scalar key', () => {
            expectThrow(
                't = 1\n[[t]]\nb = 2',
                /Cannot redefine "t" as an array of tables \(line 2\)/,
            );
        });

        it('throws on a malformed header treated as a bare line', () => {
            expectThrow('[unclosed\nk = 1', /Unterminated array or table \(line 1\)/);
        });

        it('throws when a bracket appears in key position', () => {
            expectThrow('a] = 1', /expected '=' \(line 1\): a\] = 1/);
        });

        it('throws on an empty key', () => {
            expectThrow('. = 1', /Invalid or empty key "\." \(line 1\)/);
        });

        it('throws when a line starts with the assignment operator', () => {
            expectThrow('= 1', /Invalid or empty key "" \(line 1\)/);
        });

        it('throws on an inline table entry with an empty key', () => {
            expectThrow('a = { = 1 }', /Invalid or empty key "" \(line 1\)/);
        });

        it('throws on a missing value', () => {
            expectThrow('a =', /Missing value \(line 1\)/);
        });

        it('throws on an unterminated multi-line string', () => {
            expectThrow('a = """\nunclosed', /Unterminated multi-line string \(line 1\)/);
        });

        it('throws on an unterminated array', () => {
            expectThrow('a = [1, 2', /Unterminated array or table \(line 1\)/);
        });

        it('throws on an inline table entry without =', () => {
            expectThrow('a = { x }', /Invalid inline table entry "x" \(line 1\)/);
        });

        it('throws when a dotted key extends a scalar', () => {
            expectThrow('a = 1\na.b = 2', /Cannot extend "a" with a dotted key \(line 2\)/);
        });

        it('throws when a table path collides with a scalar', () => {
            expectThrow('a = 1\n[a.b]\nc = 2', /Cannot redefine "a" as a table \(line 2\)/);
        });

        it('throws when nesting exceeds maxDepth', () => {
            expectThrow('a = [[[1]]]', /nesting depth 3 exceeds maximum of 2/, 2);
        });
    });
});
