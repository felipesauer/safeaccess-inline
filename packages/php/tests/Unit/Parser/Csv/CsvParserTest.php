<?php

declare(strict_types=1);

use SafeAccess\Inline\Exceptions\CsvParseException;
use SafeAccess\Inline\Parser\Csv\CsvParser;

describe(CsvParser::class, function (): void {
    it('parses a basic CSV document into indexed records', function (): void {
        expect((new CsvParser())->parse("name,age\nAlice,30\nBob,25"))->toBe([
            '0' => ['name' => 'Alice', 'age' => '30'],
            '1' => ['name' => 'Bob', 'age' => '25'],
        ]);
    });

    it('parses a TSV document with a tab delimiter', function (): void {
        expect((new CsvParser("\t"))->parse("name\tage\nAlice\t30"))->toBe([
            '0' => ['name' => 'Alice', 'age' => '30'],
        ]);
    });

    it('returns an empty array for an empty document', function (): void {
        expect((new CsvParser())->parse(''))->toBe([]);
    });

    it('returns an empty array for a header-only document', function (): void {
        expect((new CsvParser())->parse('name,age'))->toBe([]);
    });

    it('keeps all values as strings (no numeric coercion)', function (): void {
        expect((new CsvParser())->parse("id,zip\n007,01234"))->toBe([
            '0' => ['id' => '007', 'zip' => '01234'],
        ]);
    });

    it('normalizes CRLF line endings', function (): void {
        expect((new CsvParser())->parse("a\r\n1\r\n2"))->toBe(['0' => ['a' => '1'], '1' => ['a' => '2']]);
    });

    it('normalizes lone CR line endings', function (): void {
        expect((new CsvParser())->parse("a\r1\r2"))->toBe(['0' => ['a' => '1'], '1' => ['a' => '2']]);
    });

    it('skips fully-empty lines', function (): void {
        expect((new CsvParser())->parse("a\n1\n\n2"))->toBe(['0' => ['a' => '1'], '1' => ['a' => '2']]);
    });

    it('trims a trailing newline without producing an empty record', function (): void {
        expect((new CsvParser())->parse("a\n1\n"))->toBe(['0' => ['a' => '1']]);
    });

    describe('quoting', function (): void {
        it('keeps the delimiter inside a quoted field', function (): void {
            expect((new CsvParser())->parse("a,b\n\"x,y\",z"))->toBe([
                '0' => ['a' => 'x,y', 'b' => 'z'],
            ]);
        });

        it('unescapes doubled quotes inside a quoted field', function (): void {
            expect((new CsvParser())->parse("a\n\"he said \"\"hi\"\"\""))->toBe([
                '0' => ['a' => 'he said "hi"'],
            ]);
        });

        it('keeps an embedded newline inside a quoted field', function (): void {
            expect((new CsvParser())->parse("a,b\n\"line1\nline2\",z"))->toBe([
                '0' => ['a' => "line1\nline2", 'b' => 'z'],
            ]);
        });

        it('parses an empty quoted field', function (): void {
            expect((new CsvParser())->parse("a,b\n\"\",z"))->toBe(['0' => ['a' => '', 'b' => 'z']]);
        });

        it('keeps the tab delimiter inside a quoted TSV field', function (): void {
            expect((new CsvParser("\t"))->parse("a\tb\n\"x\ty\"\tz"))->toBe([
                '0' => ['a' => "x\ty", 'b' => 'z'],
            ]);
        });
    });

    describe('errors', function (): void {
        it('throws when a row has fewer fields than the header', function (): void {
            expect(fn () => (new CsvParser())->parse("a,b\n1"))
                ->toThrow(CsvParseException::class, 'Row 2 has 1 field(s), expected 2.');
        });

        it('throws when a row has more fields than the header', function (): void {
            expect(fn () => (new CsvParser())->parse("a,b\n1,2,3"))
                ->toThrow(CsvParseException::class, 'Row 2 has 3 field(s), expected 2.');
        });

        it('throws on duplicate header columns', function (): void {
            expect(fn () => (new CsvParser())->parse("a,a\n1,2"))
                ->toThrow(CsvParseException::class, 'Duplicate header column "a".');
        });

        it('throws on an unterminated quoted field', function (): void {
            expect(fn () => (new CsvParser())->parse("a\n\"unclosed"))
                ->toThrow(CsvParseException::class, 'Unterminated quoted field.');
        });
    });
});
