<?php

declare(strict_types=1);

use SafeAccess\Inline\Accessors\Formats\TsvAccessor;
use SafeAccess\Inline\Exceptions\InvalidFormatException;

describe(TsvAccessor::class, function (): void {
    describe(TsvAccessor::class . ' > from', function (): void {
        it('parses a TSV string and resolves by index', function (): void {
            $accessor = factory()->tsv("name\tage\nAlice\t30");

            expect($accessor->get('0.name'))->toBe('Alice');
            expect($accessor->get('0.age'))->toBe('30');
        });

        it('resolves multiple rows by index', function (): void {
            $accessor = factory()->tsv("name\nAlice\nBob");

            expect($accessor->get('1.name'))->toBe('Bob');
        });

        it('stores the raw input', function (): void {
            $raw = "name\tage\nAlice\t30";
            $accessor = factory()->tsv($raw);

            expect($accessor->getRaw())->toBe($raw);
        });

        it('returns null for a missing path', function (): void {
            $accessor = factory()->tsv("name\nAlice");

            expect($accessor->get('5.name'))->toBeNull();
        });

        it('throws InvalidFormatException for a non-string input', function (): void {
            expect(fn () => factory()->tsv(42))->toThrow(InvalidFormatException::class);
        });

        it('throws InvalidFormatException for null input', function (): void {
            expect(fn () => factory()->tsv(null))->toThrow(InvalidFormatException::class);
        });
    });
});
