<?php

declare(strict_types=1);

use SafeAccess\Inline\Accessors\Formats\CsvAccessor;
use SafeAccess\Inline\Exceptions\InvalidFormatException;
use SafeAccess\Inline\Exceptions\SecurityException;

describe(CsvAccessor::class, function (): void {
    describe(CsvAccessor::class . ' > from', function (): void {
        it('parses a CSV string and resolves by index', function (): void {
            $accessor = factory()->csv("name,age\nAlice,30");

            expect($accessor->get('0.name'))->toBe('Alice');
            expect($accessor->get('0.age'))->toBe('30');
        });

        it('resolves multiple rows by index', function (): void {
            $accessor = factory()->csv("name\nAlice\nBob");

            expect($accessor->get('0.name'))->toBe('Alice');
            expect($accessor->get('1.name'))->toBe('Bob');
        });

        it('stores the raw input', function (): void {
            $raw = "name,age\nAlice,30";
            $accessor = factory()->csv($raw);

            expect($accessor->getRaw())->toBe($raw);
        });

        it('returns null for a missing path', function (): void {
            $accessor = factory()->csv("name\nAlice");

            expect($accessor->get('5.name'))->toBeNull();
        });

        it('throws InvalidFormatException for a non-string input', function (): void {
            expect(fn () => factory()->csv(42))->toThrow(InvalidFormatException::class);
        });

        it('throws InvalidFormatException for null input', function (): void {
            expect(fn () => factory()->csv(null))->toThrow(InvalidFormatException::class);
        });

        it('blocks a forbidden key used as a header column', function (): void {
            expect(fn () => factory()->csv("__proto__\nx"))->toThrow(SecurityException::class);
        });
    });
});
