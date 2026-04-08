<?php

declare(strict_types=1);

use SafeAccess\Inline\Exceptions\AccessorException;
use SafeAccess\Inline\Exceptions\ReadonlyViolationException;

describe(ReadonlyViolationException::class, function (): void {
    it('uses default message when none provided', function (): void {
        $e = new ReadonlyViolationException();

        expect($e->getMessage())->toBe('Cannot modify a readonly accessor.');
    });

    it('accepts a custom message', function (): void {
        $e = new ReadonlyViolationException('custom msg');

        expect($e->getMessage())->toBe('custom msg');
    });

    it('extends AccessorException', function (): void {
        expect(new ReadonlyViolationException())->toBeInstanceOf(AccessorException::class);
    });

    it('accepts a custom code and previous throwable', function (): void {
        $previous = new \RuntimeException('root');
        $e = new ReadonlyViolationException('wrapped', 42, $previous);

        expect($e->getCode())->toBe(42);
        expect($e->getPrevious())->toBe($previous);
    });

    it('can be thrown and caught', function (): void {
        expect(fn () => throw new ReadonlyViolationException())
            ->toThrow(ReadonlyViolationException::class);
    });
});
