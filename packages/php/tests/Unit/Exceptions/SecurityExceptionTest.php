<?php

declare(strict_types=1);

use SafeAccess\Inline\Exceptions\AccessorException;
use SafeAccess\Inline\Exceptions\SecurityException;

describe(SecurityException::class, function (): void {
    it('stores the provided message', function (): void {
        $e = new SecurityException('forbidden key');

        expect($e->getMessage())->toBe('forbidden key');
    });

    it('extends AccessorException', function (): void {
        expect(new SecurityException('msg'))->toBeInstanceOf(AccessorException::class);
    });

    it('accepts a custom code and previous throwable', function (): void {
        $previous = new \RuntimeException('root');
        $e = new SecurityException('wrapped', 42, $previous);

        expect($e->getCode())->toBe(42);
        expect($e->getPrevious())->toBe($previous);
    });

    it('can be thrown and caught', function (): void {
        expect(fn () => throw new SecurityException('boom'))
            ->toThrow(SecurityException::class, 'boom');
    });
});
