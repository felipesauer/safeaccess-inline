<?php

declare(strict_types=1);

use SafeAccess\Inline\Accessors\Formats\YamlAccessor;
use SafeAccess\Inline\Exceptions\InvalidFormatException;

describe(YamlAccessor::class, function (): void {
    describe(YamlAccessor::class . ' > from', function (): void {
        it('parses a flat YAML string', function (): void {
            $accessor = factory()->yaml("name: Alice\n");

            expect($accessor->get('name'))->toBe('Alice');
        });

        it('parses nested YAML', function (): void {
            $accessor = factory()->yaml("user:\n  city: Porto\n");

            expect($accessor->get('user.city'))->toBe('Porto');
        });

        it('stores the raw input', function (): void {
            $raw = "name: Alice\n";
            $accessor = factory()->yaml($raw);

            expect($accessor->getRaw())->toBe($raw);
        });

        it('throws InvalidFormatException for a non-string input', function (): void {
            expect(fn () => factory()->yaml(42))
                ->toThrow(InvalidFormatException::class);
        });

        it('throws InvalidFormatException for null input', function (): void {
            expect(fn () => factory()->yaml(null))
                ->toThrow(InvalidFormatException::class);
        });

        it('throws InvalidFormatException for YAML with unsafe constructs (tag)', function (): void {
            expect(fn () => factory()->yaml("name: !!str Alice\n"))
                ->toThrow(InvalidFormatException::class);
        });
    });
});
