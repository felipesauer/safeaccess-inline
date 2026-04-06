<?php

declare(strict_types=1);

use SafeAccess\Inline\Exceptions\ParserException;

describe(ParserException::class, function (): void {
    // instantiation
    describe(ParserException::class . ' > instantiation', function (): void {
        it('instantiates with a message', function (): void {
            $e = new ParserException('parse failed');

            expect($e->getMessage())->toBe('parse failed');
            expect($e->getCode())->toBe(0);
            expect($e->getPrevious())->toBeNull();
        });

        it('instantiates with a custom code and a previous throwable', function (): void {
            $previous = new \RuntimeException('root cause');
            $e = new ParserException('wrapped', 42, $previous);

            expect($e->getMessage())->toBe('wrapped');
            expect($e->getCode())->toBe(42);
            expect($e->getPrevious())->toBe($previous);
        });

        it('can be thrown and caught', function (): void {
            expect(fn () => throw new ParserException('boom'))
                ->toThrow(ParserException::class, 'boom');
        });
    });
});
