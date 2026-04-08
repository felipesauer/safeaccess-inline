<?php

declare(strict_types=1);

use SafeAccess\Inline\Accessors\Formats\NdjsonAccessor;
use SafeAccess\Inline\Exceptions\InvalidFormatException;

describe(NdjsonAccessor::class, function (): void {
    describe(NdjsonAccessor::class . ' > from', function (): void {
        it('parses a single NDJSON line', function (): void {
            $accessor = factory()->ndjson("{\"name\":\"Alice\"}\n");

            expect($accessor->get('0.name'))->toBe('Alice');
        });

        it('parses multiple NDJSON lines', function (): void {
            $accessor = factory()->ndjson("{\"name\":\"Alice\"}\n{\"name\":\"Bob\"}\n");

            expect($accessor->get('1.name'))->toBe('Bob');
        });

        it('stores the raw input', function (): void {
            $raw = "{\"a\":1}\n";
            $accessor = factory()->ndjson($raw);

            expect($accessor->getRaw())->toBe($raw);
        });

        it('throws InvalidFormatException for a non-string input', function (): void {
            expect(fn () => factory()->ndjson(42))
                ->toThrow(InvalidFormatException::class);
        });

        it('throws InvalidFormatException for null input', function (): void {
            expect(fn () => factory()->ndjson(null))
                ->toThrow(InvalidFormatException::class);
        });

        it('throws InvalidFormatException for malformed NDJSON', function (): void {
            expect(fn () => factory()->ndjson("not-json\n"))
                ->toThrow(InvalidFormatException::class);
        });

        it('returns an empty accessor for a string containing only blank lines', function (): void {
            $accessor = factory()->ndjson("\n\n");

            expect($accessor->get('0', 'none'))->toBe('none');
        });

        it('keys() returns numeric line positions as strings (parity with JS Object.keys)', function (): void {
            $accessor = factory()->ndjson("{\"name\":\"Alice\"}\n{\"name\":\"Bob\"}");

            expect($accessor->keys())->toBe(['0', '1']);
        });
    });
});
