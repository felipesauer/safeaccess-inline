<?php

declare(strict_types=1);

use SafeAccess\Inline\Exceptions\AccessorException;
use SafeAccess\Inline\Exceptions\PathNotFoundException;

describe(PathNotFoundException::class, function (): void {
    it('stores the provided message', function (): void {
        $e = new PathNotFoundException('path missing');

        expect($e->getMessage())->toBe('path missing');
    });

    it('extends AccessorException', function (): void {
        expect(new PathNotFoundException('msg'))->toBeInstanceOf(AccessorException::class);
    });

    it('accepts a custom code and previous throwable', function (): void {
        $previous = new \RuntimeException('root');
        $e = new PathNotFoundException('wrapped', 42, $previous);

        expect($e->getCode())->toBe(42);
        expect($e->getPrevious())->toBe($previous);
    });

    it('can be thrown and caught', function (): void {
        expect(fn () => throw new PathNotFoundException('boom'))
            ->toThrow(PathNotFoundException::class, 'boom');
    });
});
