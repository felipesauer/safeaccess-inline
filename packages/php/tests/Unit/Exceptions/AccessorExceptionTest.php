<?php

declare(strict_types=1);

use SafeAccess\Inline\Exceptions\AccessorException;

describe(AccessorException::class, function (): void {
    it('stores the provided message', function (): void {
        $e = new AccessorException('accessor error');

        expect($e->getMessage())->toBe('accessor error');
    });

    it('defaults code to 0 and previous to null', function (): void {
        $e = new AccessorException('msg');

        expect($e->getCode())->toBe(0);
        expect($e->getPrevious())->toBeNull();
    });

    it('accepts a custom code and previous throwable', function (): void {
        $previous = new \RuntimeException('root');
        $e = new AccessorException('wrapped', 42, $previous);

        expect($e->getCode())->toBe(42);
        expect($e->getPrevious())->toBe($previous);
    });

    it('extends RuntimeException', function (): void {
        expect(new AccessorException('msg'))->toBeInstanceOf(\RuntimeException::class);
    });

    it('can be thrown and caught', function (): void {
        expect(fn () => throw new AccessorException('boom'))
            ->toThrow(AccessorException::class, 'boom');
    });
});
