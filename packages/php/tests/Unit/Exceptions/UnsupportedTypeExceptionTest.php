<?php

declare(strict_types=1);

use SafeAccess\Inline\Exceptions\AccessorException;
use SafeAccess\Inline\Exceptions\UnsupportedTypeException;

describe(UnsupportedTypeException::class, function (): void {
    it('stores the provided message', function (): void {
        $e = new UnsupportedTypeException('unsupported');

        expect($e->getMessage())->toBe('unsupported');
    });

    it('extends AccessorException', function (): void {
        expect(new UnsupportedTypeException('msg'))->toBeInstanceOf(AccessorException::class);
    });

    it('accepts a custom code and previous throwable', function (): void {
        $previous = new \RuntimeException('root');
        $e = new UnsupportedTypeException('wrapped', 42, $previous);

        expect($e->getCode())->toBe(42);
        expect($e->getPrevious())->toBe($previous);
    });

    it('can be thrown and caught', function (): void {
        expect(fn () => throw new UnsupportedTypeException('boom'))
            ->toThrow(UnsupportedTypeException::class, 'boom');
    });
});
