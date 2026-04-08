<?php

declare(strict_types=1);

use SafeAccess\Inline\Accessors\Formats\IniAccessor;
use SafeAccess\Inline\Exceptions\InvalidFormatException;

describe(IniAccessor::class, function (): void {
    describe(IniAccessor::class . ' > from', function (): void {
        it('parses a flat INI string', function (): void {
            $accessor = factory()->ini("name=Alice\nage=30\n");

            expect($accessor->get('name'))->toBe('Alice');
            expect($accessor->get('age'))->toBe(30);
        });

        it('parses section-based INI', function (): void {
            $accessor = factory()->ini("[user]\nname=Alice\n");

            expect($accessor->get('user.name'))->toBe('Alice');
        });

        it('stores the raw input', function (): void {
            $raw = "key=val\n";
            $accessor = factory()->ini($raw);

            expect($accessor->getRaw())->toBe($raw);
        });

        it('throws InvalidFormatException for a non-string input', function (): void {
            expect(fn () => factory()->ini(42))
                ->toThrow(InvalidFormatException::class);
        });

        it('throws InvalidFormatException for null input', function (): void {
            expect(fn () => factory()->ini(null))
                ->toThrow(InvalidFormatException::class);
        });

        it('throws InvalidFormatException when parse_ini_string returns false', function (): void {
            expect(fn () => factory()->ini('[unclosed'))
                ->toThrow(InvalidFormatException::class);
        });
    });
});
