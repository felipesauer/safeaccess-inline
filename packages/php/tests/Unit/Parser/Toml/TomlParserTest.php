<?php

declare(strict_types=1);

use SafeAccess\Inline\Exceptions\TomlParseException;
use SafeAccess\Inline\Parser\Toml\TomlParser;

describe(TomlParser::class, function (): void {
    it('parses a simple key-value pair', function (): void {
        expect((new TomlParser())->parse('name = "Alice"'))->toBe(['name' => 'Alice']);
    });

    it('returns an empty array for empty string', function (): void {
        expect((new TomlParser())->parse(''))->toBe([]);
    });

    it('returns an empty array for comment-only input', function (): void {
        expect((new TomlParser())->parse('# comment only'))->toBe([]);
    });

    it('normalizes CRLF line endings', function (): void {
        expect((new TomlParser())->parse("a = 1\r\nb = 2"))->toBe(['a' => 1, 'b' => 2]);
    });

    it('parses multiple root-level keys', function (): void {
        expect((new TomlParser())->parse("a = 1\nb = 2"))->toBe(['a' => 1, 'b' => 2]);
    });

    it('parses a standard table', function (): void {
        expect((new TomlParser())->parse("[server]\nhost = \"0.0.0.0\""))
            ->toBe(['server' => ['host' => '0.0.0.0']]);
    });

    it('parses a dotted table header', function (): void {
        expect((new TomlParser())->parse("[a.b.c]\nx = 1"))
            ->toBe(['a' => ['b' => ['c' => ['x' => 1]]]]);
    });

    it('parses dotted keys', function (): void {
        expect((new TomlParser())->parse('a.b.c = 1'))->toBe(['a' => ['b' => ['c' => 1]]]);
    });

    it('parses an array of tables', function (): void {
        expect((new TomlParser())->parse("[[p]]\nn = \"A\"\n[[p]]\nn = \"B\""))
            ->toBe(['p' => [['n' => 'A'], ['n' => 'B']]]);
    });

    it('descends into the latest array-of-tables element for a sub-table', function (): void {
        expect((new TomlParser())->parse("[[p]]\nn = \"A\"\n[p.meta]\nk = 1"))
            ->toBe(['p' => [['n' => 'A', 'meta' => ['k' => 1]]]]);
    });

    it('parses inline arrays', function (): void {
        expect((new TomlParser())->parse('x = [1, 2, 3]'))->toBe(['x' => [1, 2, 3]]);
    });

    it('parses empty inline arrays', function (): void {
        expect((new TomlParser())->parse('x = []'))->toBe(['x' => []]);
    });

    it('parses nested inline arrays', function (): void {
        expect((new TomlParser())->parse('x = [[1, 2], [3]]'))->toBe(['x' => [[1, 2], [3]]]);
    });

    it('parses multi-line inline arrays', function (): void {
        expect((new TomlParser())->parse("x = [\n  1,\n  2,\n  3,\n]"))->toBe(['x' => [1, 2, 3]]);
    });

    it('parses inline tables', function (): void {
        expect((new TomlParser())->parse('p = { x = 1, y = 2 }'))->toBe(['p' => ['x' => 1, 'y' => 2]]);
    });

    it('parses empty inline tables', function (): void {
        expect((new TomlParser())->parse('p = {}'))->toBe(['p' => []]);
    });

    it('keeps separators inside quoted array items', function (): void {
        expect((new TomlParser())->parse('x = ["a,b", "c]d"]'))->toBe(['x' => ['a,b', 'c]d']]);
    });

    it('keeps separators inside quoted inline-table values', function (): void {
        expect((new TomlParser())->parse('p = { a = "x,y", b = 1 }'))
            ->toBe(['p' => ['a' => 'x,y', 'b' => 1]]);
    });

    it('keeps separators inside triple-quoted array items', function (): void {
        expect((new TomlParser())->parse('x = ["""a,]b""", "c"]'))->toBe(['x' => ['a,]b', 'c']]);
    });

    it('tolerates a trailing comma in inline tables', function (): void {
        expect((new TomlParser())->parse('p = { a = 1, }'))->toBe(['p' => ['a' => 1]]);
    });

    it('skips empty items between separators', function (): void {
        expect((new TomlParser())->parse('x = [1, , 2]'))->toBe(['x' => [1, 2]]);
    });

    it('descends into a pre-existing sub-table via a table header', function (): void {
        expect((new TomlParser())->parse("[a]\nx = 1\n[a.b]\ny = 2"))
            ->toBe(['a' => ['x' => 1, 'b' => ['y' => 2]]]);
    });

    it('extends a table opened by a dotted key', function (): void {
        expect((new TomlParser())->parse("a.b = 1\na.c = 2"))
            ->toBe(['a' => ['b' => 1, 'c' => 2]]);
    });

    describe('scalar types', function (): void {
        it('casts integers', function (): void {
            expect((new TomlParser())->parse("a = 42\nb = -17\nc = +99"))
                ->toBe(['a' => 42, 'b' => -17, 'c' => 99]);
        });

        it('casts integers with underscore separators', function (): void {
            expect((new TomlParser())->parse('a = 1_000_000'))->toBe(['a' => 1000000]);
        });

        it('casts hex, octal, and binary integers', function (): void {
            expect((new TomlParser())->parse("h = 0xFF\no = 0o755\nb = 0b1010"))
                ->toBe(['h' => 255, 'o' => 493, 'b' => 10]);
        });

        it('casts floats', function (): void {
            expect((new TomlParser())->parse("a = 3.14\nb = -0.1\nc = 5e3\nd = 6.02e2"))
                ->toBe(['a' => 3.14, 'b' => -0.1, 'c' => 5000.0, 'd' => 602.0]);
        });

        it('casts float special values', function (): void {
            $r = (new TomlParser())->parse("a = inf\nb = -inf\nc = nan");
            expect($r['a'])->toBe(INF);
            expect($r['b'])->toBe(-INF);
            expect(is_nan($r['c']))->toBeTrue();
        });

        it('casts booleans (lowercase only)', function (): void {
            expect((new TomlParser())->parse("a = true\nb = false"))
                ->toBe(['a' => true, 'b' => false]);
        });

        it('keeps capitalized booleans as strings', function (): void {
            expect((new TomlParser())->parse('a = True'))->toBe(['a' => 'True']);
        });

        it('preserves datetimes as strings', function (): void {
            expect((new TomlParser())->parse('a = 1979-05-27T07:32:00Z'))
                ->toBe(['a' => '1979-05-27T07:32:00Z']);
        });
    });

    describe('strings', function (): void {
        it('parses basic strings with escapes', function (): void {
            expect((new TomlParser())->parse('a = "line1\\nline2\\ttab"'))
                ->toBe(['a' => "line1\nline2\ttab"]);
        });

        it('parses unicode escapes', function (): void {
            expect((new TomlParser())->parse('a = "\\u00e9"'))->toBe(['a' => 'é']);
        });

        it('parses long unicode escapes', function (): void {
            expect((new TomlParser())->parse('a = "\\U0001F600"'))->toBe(['a' => "\u{1F600}"]);
        });

        it('parses literal strings without escaping', function (): void {
            expect((new TomlParser())->parse("a = 'C:\\path\\file'"))->toBe(['a' => 'C:\\path\\file']);
        });

        it('parses multi-line basic strings', function (): void {
            expect((new TomlParser())->parse("a = \"\"\"\nline1\nline2\"\"\""))
                ->toBe(['a' => "line1\nline2"]);
        });

        it('parses multi-line literal strings', function (): void {
            expect((new TomlParser())->parse("a = '''\nraw\\nnot-escaped'''"))
                ->toBe(['a' => 'raw\\nnot-escaped']);
        });

        it('folds line-ending backslashes in multi-line basic strings', function (): void {
            expect((new TomlParser())->parse("a = \"\"\"\\\n  continued\"\"\""))
                ->toBe(['a' => 'continued']);
        });

        it('keeps # inside strings out of comment stripping', function (): void {
            expect((new TomlParser())->parse('a = "not # a comment"'))
                ->toBe(['a' => 'not # a comment']);
        });
    });

    describe('comments', function (): void {
        it('ignores full-line comments', function (): void {
            expect((new TomlParser())->parse("# top\na = 1\n# mid\nb = 2"))
                ->toBe(['a' => 1, 'b' => 2]);
        });

        it('strips inline comments', function (): void {
            expect((new TomlParser())->parse('a = 1 # trailing'))->toBe(['a' => 1]);
        });
    });

    describe('quoted keys', function (): void {
        it('parses double-quoted keys', function (): void {
            expect((new TomlParser())->parse('"a.b" = 1'))->toBe(['a.b' => 1]);
        });

        it('parses single-quoted keys', function (): void {
            expect((new TomlParser())->parse("'key with spaces' = 1"))
                ->toBe(['key with spaces' => 1]);
        });
    });

    describe('errors', function (): void {
        it('throws on a line without an assignment or header', function (): void {
            expect(fn () => (new TomlParser())->parse('garbage line'))
                ->toThrow(TomlParseException::class);
        });

        it('throws on duplicate keys', function (): void {
            expect(fn () => (new TomlParser())->parse("a = 1\na = 2"))
                ->toThrow(TomlParseException::class);
        });

        it('throws on duplicate keys within a table', function (): void {
            expect(fn () => (new TomlParser())->parse("[t]\na = 1\na = 2"))
                ->toThrow(TomlParseException::class);
        });

        it('throws on table redefinition', function (): void {
            expect(fn () => (new TomlParser())->parse("[t]\na = 1\n[t]\nb = 2"))
                ->toThrow(TomlParseException::class);
        });

        it('throws when a table redefines an array of tables', function (): void {
            expect(fn () => (new TomlParser())->parse("[[t]]\na = 1\n[t]\nb = 2"))
                ->toThrow(TomlParseException::class);
        });

        it('throws when an array of tables redefines a table', function (): void {
            expect(fn () => (new TomlParser())->parse("[t]\na = 1\n[[t]]\nb = 2"))
                ->toThrow(TomlParseException::class);
        });

        it('throws when an array-of-tables header targets a scalar key', function (): void {
            expect(fn () => (new TomlParser())->parse("t = 1\n[[t]]\nb = 2"))
                ->toThrow(TomlParseException::class);
        });

        it('throws on a malformed header treated as a bare line', function (): void {
            expect(fn () => (new TomlParser())->parse("[unclosed\nk = 1"))
                ->toThrow(TomlParseException::class);
        });

        it('throws when a bracket appears in key position', function (): void {
            expect(fn () => (new TomlParser())->parse('a] = 1'))
                ->toThrow(TomlParseException::class);
        });

        it('throws on an empty key', function (): void {
            expect(fn () => (new TomlParser())->parse('. = 1'))
                ->toThrow(TomlParseException::class);
        });

        it('throws on a missing value', function (): void {
            expect(fn () => (new TomlParser())->parse('a ='))
                ->toThrow(TomlParseException::class);
        });

        it('throws on an unterminated multi-line string', function (): void {
            expect(fn () => (new TomlParser())->parse("a = \"\"\"\nunclosed"))
                ->toThrow(TomlParseException::class);
        });

        it('throws on an unterminated array', function (): void {
            expect(fn () => (new TomlParser())->parse('a = [1, 2'))
                ->toThrow(TomlParseException::class);
        });

        it('throws on an inline table entry without =', function (): void {
            expect(fn () => (new TomlParser())->parse('a = { x }'))
                ->toThrow(TomlParseException::class);
        });

        it('throws when a dotted key extends a scalar', function (): void {
            expect(fn () => (new TomlParser())->parse("a = 1\na.b = 2"))
                ->toThrow(TomlParseException::class);
        });

        it('throws when a table path collides with a scalar', function (): void {
            expect(fn () => (new TomlParser())->parse("a = 1\n[a.b]\nc = 2"))
                ->toThrow(TomlParseException::class);
        });

        it('throws when nesting exceeds maxDepth', function (): void {
            expect(fn () => (new TomlParser(2))->parse('a = [[[1]]]'))
                ->toThrow(TomlParseException::class);
        });
    });
});
