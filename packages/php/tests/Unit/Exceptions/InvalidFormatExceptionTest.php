<?php

declare(strict_types=1);

use SafeAccess\Inline\Exceptions\AccessorException;
use SafeAccess\Inline\Exceptions\InvalidFormatException;

describe(InvalidFormatException::class, function (): void {
    it('stores the provided message', function (): void {
        $e = new InvalidFormatException('bad format');

        expect($e->getMessage())->toBe('bad format');
    });

    it('extends AccessorException', function (): void {
        expect(new InvalidFormatException('msg'))->toBeInstanceOf(AccessorException::class);
    });

    it('accepts a custom code and previous throwable', function (): void {
        $previous = new \RuntimeException('root');
        $e = new InvalidFormatException('wrapped', 42, $previous);

        expect($e->getCode())->toBe(42);
        expect($e->getPrevious())->toBe($previous);
    });

    it('can be thrown and caught', function (): void {
        expect(fn () => throw new InvalidFormatException('boom'))
            ->toThrow(InvalidFormatException::class, 'boom');
    });
});
