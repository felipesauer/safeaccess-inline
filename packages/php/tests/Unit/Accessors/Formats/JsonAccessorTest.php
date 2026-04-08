<?php

declare(strict_types=1);

use SafeAccess\Inline\Accessors\Formats\JsonAccessor;
use SafeAccess\Inline\Exceptions\InvalidFormatException;

describe(JsonAccessor::class, function (): void {
    describe(JsonAccessor::class . ' > from', function (): void {
        it('parses a flat JSON string', function (): void {
            $accessor = factory()->json('{"name":"Alice"}');

            expect($accessor->get('name'))->toBe('Alice');
        });

        it('parses nested JSON', function (): void {
            $accessor = factory()->json('{"user":{"city":"Porto"}}');

            expect($accessor->get('user.city'))->toBe('Porto');
        });

        it('stores the raw input', function (): void {
            $raw = '{"name":"Alice"}';
            $accessor = factory()->json($raw);

            expect($accessor->getRaw())->toBe($raw);
        });

        it('throws InvalidFormatException for a non-string input', function (): void {
            expect(fn () => factory()->json(42))
                ->toThrow(InvalidFormatException::class);
        });

        it('throws InvalidFormatException for null input', function (): void {
            expect(fn () => factory()->json(null))
                ->toThrow(InvalidFormatException::class);
        });

        it('throws InvalidFormatException for malformed JSON', function (): void {
            expect(fn () => factory()->json('not-json'))
                ->toThrow(InvalidFormatException::class);
        });
    });
});
