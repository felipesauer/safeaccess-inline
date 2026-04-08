<?php

declare(strict_types=1);

use SafeAccess\Inline\Exceptions\InvalidFormatException;
use SafeAccess\Inline\Exceptions\YamlParseException;

describe(YamlParseException::class, function (): void {
    it('stores the provided message', function (): void {
        $e = new YamlParseException('yaml error');

        expect($e->getMessage())->toBe('yaml error');
    });

    it('extends InvalidFormatException', function (): void {
        expect(new YamlParseException('msg'))->toBeInstanceOf(InvalidFormatException::class);
    });

    it('accepts a custom code and previous throwable', function (): void {
        $previous = new \RuntimeException('root');
        $e = new YamlParseException('wrapped', 42, $previous);

        expect($e->getCode())->toBe(42);
        expect($e->getPrevious())->toBe($previous);
    });

    it('can be thrown and caught', function (): void {
        expect(fn () => throw new YamlParseException('boom'))
            ->toThrow(YamlParseException::class, 'boom');
    });
});
