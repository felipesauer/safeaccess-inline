<?php

declare(strict_types=1);

use SafeAccess\Inline\Accessors\Formats\TomlAccessor;
use SafeAccess\Inline\Exceptions\InvalidFormatException;

describe(TomlAccessor::class, function (): void {
    describe(TomlAccessor::class . ' > from', function (): void {
        it('parses a flat TOML string', function (): void {
            $accessor = factory()->toml("name = \"Alice\"\n");

            expect($accessor->get('name'))->toBe('Alice');
        });

        it('parses a nested table', function (): void {
            $accessor = factory()->toml("[server]\nhost = \"0.0.0.0\"\n");

            expect($accessor->get('server.host'))->toBe('0.0.0.0');
        });

        it('parses an array of tables', function (): void {
            $accessor = factory()->toml("[[p]]\nn = \"A\"\n[[p]]\nn = \"B\"\n");

            expect($accessor->get('p.0.n'))->toBe('A');
            expect($accessor->get('p.1.n'))->toBe('B');
        });

        it('stores the raw input', function (): void {
            $raw = "[server]\nport = 8000\n";
            $accessor = factory()->toml($raw);

            expect($accessor->getRaw())->toBe($raw);
        });

        it('returns null for a missing path', function (): void {
            $accessor = factory()->toml("key = \"value\"\n");

            expect($accessor->get('missing'))->toBeNull();
        });

        it('throws InvalidFormatException for a non-string input', function (): void {
            expect(fn () => factory()->toml(42))
                ->toThrow(InvalidFormatException::class);
        });

        it('throws InvalidFormatException for null input', function (): void {
            expect(fn () => factory()->toml(null))
                ->toThrow(InvalidFormatException::class);
        });
    });
});
