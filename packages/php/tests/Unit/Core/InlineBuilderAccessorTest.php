<?php

declare(strict_types=1);

use SafeAccess\Inline\Core\AccessorFactory;
use SafeAccess\Inline\Core\InlineBuilderAccessor;
use SafeAccess\Inline\Security\SecurityGuard;
use SafeAccess\Inline\Security\SecurityParser;
use SafeAccess\Inline\Tests\Mocks\FakeParseIntegration;
use SafeAccess\Inline\Tests\Mocks\FakePathCache;

describe(InlineBuilderAccessor::class, function (): void {
    // builder()
    describe(InlineBuilderAccessor::class . ' > builder', function (): void {
        it('returns an AccessorFactory from the default builder', function (): void {
            $factory = (new InlineBuilderAccessor())->builder();

            expect($factory)->toBeInstanceOf(AccessorFactory::class);
        });

        it('returned factory can create a working ArrayAccessor', function (): void {
            $factory = (new InlineBuilderAccessor())->builder();

            $accessor = $factory->array(['name' => 'Alice']);

            expect($accessor->get('name'))->toBe('Alice');
        });
    });

    // withParserIntegration()
    describe(InlineBuilderAccessor::class . ' > withParserIntegration', function (): void {
        it('returns a new instance (immutability)', function (): void {
            $original = new InlineBuilderAccessor();
            $modified = $original->withParserIntegration(new FakeParseIntegration());

            expect($modified)->not->toBe($original);
        });

        it('wires the AnyAccessor factory when integration is set', function (): void {
            $integration = new FakeParseIntegration(accepts: true, parsed: ['result' => 42]);

            $factory = (new InlineBuilderAccessor())
                ->withParserIntegration($integration)
                ->builder();

            $accessor = $factory->any('raw-input');

            expect($accessor->get('result'))->toBe(42);
        });
    });

    // withSecurityGuard()
    describe(InlineBuilderAccessor::class . ' > withSecurityGuard', function (): void {
        it('returns a new instance (immutability)', function (): void {
            $original = new InlineBuilderAccessor();
            $modified = $original->withSecurityGuard(new SecurityGuard());

            expect($modified)->not->toBe($original);
        });

        it('accepts a custom SecurityGuard with extra forbidden keys', function (): void {
            $guard = new SecurityGuard(extraForbiddenKeys: ['forbidden_custom']);

            $factory = (new InlineBuilderAccessor())
                ->withSecurityGuard($guard)
                ->builder();

            expect($factory)->toBeInstanceOf(AccessorFactory::class);
        });
    });

    // withSecurityParser()
    describe(InlineBuilderAccessor::class . ' > withSecurityParser', function (): void {
        it('returns a new instance (immutability)', function (): void {
            $original = new InlineBuilderAccessor();
            $modified = $original->withSecurityParser(new SecurityParser());

            expect($modified)->not->toBe($original);
        });

        it('accepts a custom SecurityParser and builds successfully', function (): void {
            $parser = new SecurityParser(maxPayloadBytes: 512);

            $factory = (new InlineBuilderAccessor())
                ->withSecurityParser($parser)
                ->builder();

            expect($factory)->toBeInstanceOf(AccessorFactory::class);
        });
    });

    // withPathCache()
    describe(InlineBuilderAccessor::class . ' > withPathCache', function (): void {
        it('returns a new instance (immutability)', function (): void {
            $original = new InlineBuilderAccessor();
            $modified = $original->withPathCache(new FakePathCache());

            expect($modified)->not->toBe($original);
        });

        it('uses the custom cache when resolving paths', function (): void {
            $cache = new FakePathCache();

            $factory = (new InlineBuilderAccessor())
                ->withPathCache($cache)
                ->builder();

            $factory->array(['name' => 'Alice'])->get('name');

            expect($cache->setCallCount)->toBeGreaterThanOrEqual(1);
        });
    });

    // __callStatic() - dispatches to instance methods via new static()
    describe(InlineBuilderAccessor::class . ' > __callStatic', function (): void {
        it('is invoked for undefined static method calls and delegates to the instance', function (): void {
            // Create a subclass that exposes __callStatic for testable undefined-method case
            $sub = new class () extends InlineBuilderAccessor {
                public static function testCallStatic(string $method, array $args): mixed
                {
                    return static::__callStatic($method, $args);
                }
            };

            // builder() is a defined instance method - __callStatic is NOT invoked for it.
            // But calling it via the explicit trampoline works the same way:
            $factory = $sub::testCallStatic('builder', []);

            expect($factory)->toBeInstanceOf(AccessorFactory::class);
        });
    });
});
