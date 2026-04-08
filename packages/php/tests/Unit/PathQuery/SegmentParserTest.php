<?php

declare(strict_types=1);

use SafeAccess\Inline\Exceptions\InvalidFormatException;
use SafeAccess\Inline\PathQuery\Enums\SegmentType;
use SafeAccess\Inline\PathQuery\SegmentFilterParser;
use SafeAccess\Inline\PathQuery\SegmentParser;
use SafeAccess\Inline\Security\SecurityGuard;

describe(SegmentParser::class, function (): void {
    beforeEach(function (): void {
        $this->parser = new SegmentParser(new SegmentFilterParser(new SecurityGuard()));
    });

    // parseSegments()
    describe(SegmentParser::class . ' > parseSegments', function (): void {
        it('parses a simple key path', function (): void {
            $result = $this->parser->parseSegments('name');

            expect($result)->toHaveCount(1);
            expect($result[0]['type'])->toBe(SegmentType::Key);
            expect($result[0]['value'])->toBe('name');
        });

        it('returns empty array for an empty path', function (): void {
            $result = $this->parser->parseSegments('');

            expect($result)->toBeEmpty();
        });

        it('strips a leading $ prefix', function (): void {
            $result = $this->parser->parseSegments('$.name');

            expect($result)->toHaveCount(1);
            expect($result[0]['value'])->toBe('name');
        });

        it('strips a leading $ prefix without a dot', function (): void {
            $result = $this->parser->parseSegments('$name');

            expect($result)->toHaveCount(1);
            expect($result[0]['value'])->toBe('name');
        });

        it('parses a two-level dot-notation path', function (): void {
            $result = $this->parser->parseSegments('user.name');

            expect($result)->toHaveCount(2);
            expect($result[0]['value'])->toBe('user');
            expect($result[1]['value'])->toBe('name');
        });

        it('parses a three-level dot-notation path', function (): void {
            $result = $this->parser->parseSegments('user.address.city');

            expect($result)->toHaveCount(3);
            expect($result[2]['value'])->toBe('city');
        });

        it('parses a wildcard * segment', function (): void {
            $result = $this->parser->parseSegments('users.*');

            expect($result[1]['type'])->toBe(SegmentType::Wildcard);
        });

        it('parses a bracket wildcard [*] segment', function (): void {
            $result = $this->parser->parseSegments('users[*]');

            expect($result[1]['type'])->toBe(SegmentType::Wildcard);
        });

        it('parses a bracket numeric index [0]', function (): void {
            $result = $this->parser->parseSegments('items[0]');

            expect($result[1]['type'])->toBe(SegmentType::Key);
            expect($result[1]['value'])->toBe('0');
        });

        it('parses a bracket quoted string key', function (): void {
            $result = $this->parser->parseSegments("data['key-with-dash']");

            expect($result[1]['type'])->toBe(SegmentType::Key);
            expect($result[1]['value'])->toBe('key-with-dash');
        });

        it('parses a multi-index segment [0,1,2]', function (): void {
            $result = $this->parser->parseSegments('items[0,1,2]');

            expect($result[1]['type'])->toBe(SegmentType::MultiIndex);
            expect($result[1]['indices'])->toBe([0, 1, 2]);
        });

        it("parses a multi-key segment ['a','b']", function (): void {
            $result = $this->parser->parseSegments("data['a','b']");

            expect($result[1]['type'])->toBe(SegmentType::MultiKey);
            expect($result[1]['keys'])->toBe(['a', 'b']);
        });

        it('parses a slice segment [1:5]', function (): void {
            $result = $this->parser->parseSegments('items[1:5]');

            expect($result[1]['type'])->toBe(SegmentType::Slice);
            expect($result[1]['start'])->toBe(1);
            expect($result[1]['end'])->toBe(5);
            expect($result[1]['step'])->toBeNull();
        });

        it('parses a slice segment with a step [0:10:2]', function (): void {
            $result = $this->parser->parseSegments('items[0:10:2]');

            expect($result[1]['type'])->toBe(SegmentType::Slice);
            expect($result[1]['step'])->toBe(2);
        });

        it('parses a slice with open start [::2]', function (): void {
            $result = $this->parser->parseSegments('items[::2]');

            expect($result[1]['type'])->toBe(SegmentType::Slice);
            expect($result[1]['start'])->toBeNull();
            expect($result[1]['end'])->toBeNull();
            expect($result[1]['step'])->toBe(2);
        });

        it('throws InvalidFormatException when slice step is zero', function (): void {
            expect(fn () => $this->parser->parseSegments('items[0:5:0]'))
                ->toThrow(InvalidFormatException::class);
        });

        it('parses a recursive descent segment ..key', function (): void {
            $result = $this->parser->parseSegments('data..name');

            $descent = array_values(array_filter($result, fn ($s) => $s['type'] === SegmentType::Descent));
            expect($descent)->not->toBeEmpty();
            expect($descent[0]['key'])->toBe('name');
        });

        it("parses a recursive descent with bracket key ..['key']", function (): void {
            $result = $this->parser->parseSegments("data..['nested']");

            $descent = array_values(array_filter($result, fn ($s) => $s['type'] === SegmentType::Descent));
            expect($descent[0]['key'])->toBe('nested');
        });

        it("parses a DescentMulti segment ..['a','b']", function (): void {
            $result = $this->parser->parseSegments("data..['a','b']");

            $dm = array_values(array_filter($result, fn ($s) => $s['type'] === SegmentType::DescentMulti));
            expect($dm)->not->toBeEmpty();
            expect($dm[0]['keys'])->toBe(['a', 'b']);
        });

        it('parses a filter segment [?condition]', function (): void {
            $result = $this->parser->parseSegments('users[?age>18]');

            expect($result[1]['type'])->toBe(SegmentType::Filter);
            expect($result[1]['expression'])->toBeArray();
            expect($result[1]['expression']['conditions'])->not->toBeEmpty();
        });

        it('parses a projection segment .{name,age}', function (): void {
            $result = $this->parser->parseSegments('users.{name,age}');

            $proj = array_values(array_filter($result, fn ($s) => $s['type'] === SegmentType::Projection));
            expect($proj)->not->toBeEmpty();
            expect($proj[0]['fields'])->toHaveCount(2);
            expect($proj[0]['fields'][0]['alias'])->toBe('name');
            expect($proj[0]['fields'][1]['alias'])->toBe('age');
        });

        it('parses a projection with an alias .{fullName: name}', function (): void {
            $result = $this->parser->parseSegments('users.{fullName: name}');

            $proj = array_values(array_filter($result, fn ($s) => $s['type'] === SegmentType::Projection));
            expect($proj[0]['fields'][0]['alias'])->toBe('fullName');
            expect($proj[0]['fields'][0]['source'])->toBe('name');
        });

        it('parses a path with an escaped dot as a literal key', function (): void {
            $result = $this->parser->parseSegments('data.key\\.with\\.dots');

            expect($result[1]['value'])->toBe('key.with.dots');
        });
    });

    // parseKeys()
    describe(SegmentParser::class . ' > parseKeys', function (): void {
        it('splits a simple dot-notation path into keys', function (): void {
            $result = $this->parser->parseKeys('user.address.city');

            expect($result)->toBe(['user', 'address', 'city']);
        });

        it('converts bracket notation to dot-notation keys', function (): void {
            $result = $this->parser->parseKeys('a[0][1]');

            expect($result)->toBe(['a', '0', '1']);
        });

        it('preserves escaped dots as literal dots in keys', function (): void {
            $result = $this->parser->parseKeys('data.key\\.dot');

            expect($result)->toBe(['data', 'key.dot']);
        });

        it('returns a single key for a path without separators', function (): void {
            $result = $this->parser->parseKeys('name');

            expect($result)->toBe(['name']);
        });
    });

    // parseSegments() - coverage-gap scenarios
    describe(SegmentParser::class . ' > parseSegments edge cases', function (): void {
        it('parses an unquoted bracket descent key as a plain Descent segment', function (): void {
            // Line 130: parseDescent bracket branch, inner not quoted → return Descent key=$inner
            $result = $this->parser->parseSegments('..[0]');

            expect($result[0]['type'])->toBe(SegmentType::Descent);
            expect($result[0]['key'])->toBe('0');
        });

        it('includes an escaped dot as a literal dot in a descent key', function (): void {
            // Lines 136-137: parseDescent plain-key branch with escaped dot
            $result = $this->parser->parseSegments('..key\\.sub');

            expect($result[0]['type'])->toBe(SegmentType::Descent);
            expect($result[0]['key'])->toBe('key.sub');
        });

        it('tracks depth for a nested bracket inside a filter expression', function (): void {
            // Line 205: parseFilter depth++ when inner '[' encountered
            $result = $this->parser->parseSegments('[?(items[0] == 1)]');

            expect($result[0]['type'])->toBe(SegmentType::Filter);
        });

        it('falls through to Key type for an unquoted non-numeric comma-separated bracket', function (): void {
            // Lines 250-251: allNumeric = false; break - parts not numeric, not quoted
            $result = $this->parser->parseSegments('data[a,b]');

            expect($result[1]['type'])->toBe(SegmentType::Key);
            expect($result[1]['value'])->toBe('a,b');
        });
    });
});
