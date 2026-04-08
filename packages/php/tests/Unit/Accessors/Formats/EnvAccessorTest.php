<?php

declare(strict_types=1);

use SafeAccess\Inline\Accessors\Formats\EnvAccessor;
use SafeAccess\Inline\Exceptions\InvalidFormatException;

describe(EnvAccessor::class, function (): void {
    describe(EnvAccessor::class . ' > from', function (): void {
        it('parses a simple .env string', function (): void {
            $accessor = factory()->env("NAME=Alice\nCITY=Porto\n");

            expect($accessor->get('NAME'))->toBe('Alice');
            expect($accessor->get('CITY'))->toBe('Porto');
        });

        it('parses quoted .env values', function (): void {
            $accessor = factory()->env("MESSAGE=\"Hello World\"\n");

            expect($accessor->get('MESSAGE'))->toBe('Hello World');
        });

        it('stores the raw input', function (): void {
            $raw = "KEY=value\n";
            $accessor = factory()->env($raw);

            expect($accessor->getRaw())->toBe($raw);
        });

        it('throws InvalidFormatException for a non-string input', function (): void {
            expect(fn () => factory()->env(42))
                ->toThrow(InvalidFormatException::class);
        });

        it('throws InvalidFormatException for null input', function (): void {
            expect(fn () => factory()->env(null))
                ->toThrow(InvalidFormatException::class);
        });

        it('skips lines that contain no equals sign', function (): void {
            $accessor = factory()->env("NO_EQUALS_HERE\nKEY=value\n");

            expect($accessor->get('KEY'))->toBe('value');
            expect($accessor->get('NO_EQUALS_HERE', 'missing'))->toBe('missing');
        });
    });
});
