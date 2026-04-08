<?php

declare(strict_types=1);

use SafeAccess\Inline\Exceptions\SecurityException;
use SafeAccess\Inline\Security\SecurityParser;

describe(SecurityParser::class, function (): void {
    // assertPayloadSize()
    describe(SecurityParser::class . ' > assertPayloadSize', function (): void {
        it('does not throw for a payload within the default limit', function (): void {
            $parser = new SecurityParser();

            $parser->assertPayloadSize('hello');

            expect(mb_strlen('hello', '8bit'))->toBeLessThanOrEqual($parser->maxPayloadBytes);
        });

        it('throws SecurityException when payload exceeds the configured limit', function (): void {
            $parser = new SecurityParser(maxPayloadBytes: 10);

            expect(fn () => $parser->assertPayloadSize('12345678901'))->toThrow(SecurityException::class);
        });

        it('accepts a payload exactly at the byte limit', function (): void {
            $parser = new SecurityParser(maxPayloadBytes: 5);

            $parser->assertPayloadSize('hello');

            expect(mb_strlen('hello', '8bit'))->toBe(5);
        });

        it('respects a maxBytes override passed directly to assertPayloadSize', function (): void {
            $parser = new SecurityParser(maxPayloadBytes: 1_000_000);

            // Even though default is large, override sets limit to 3 bytes
            expect(fn () => $parser->assertPayloadSize('toolong', 3))->toThrow(SecurityException::class);
        });

        it('does not throw when override allows the payload', function (): void {
            $parser = new SecurityParser(maxPayloadBytes: 3);

            $parser->assertPayloadSize('hello', 1_000_000);

            expect(mb_strlen('hello', '8bit'))->toBeLessThanOrEqual(1_000_000);
        });
    });

    // assertMaxResolveDepth()
    describe(SecurityParser::class . ' > assertMaxResolveDepth', function (): void {
        it('does not throw when depth is within the configured limit', function (): void {
            $parser = new SecurityParser(maxResolveDepth: 100);

            $parser->assertMaxResolveDepth(50);

            expect(50)->toBeLessThanOrEqual($parser->maxResolveDepth);
        });

        it('throws SecurityException when depth exceeds the limit', function (): void {
            $parser = new SecurityParser(maxResolveDepth: 10);

            expect(fn () => $parser->assertMaxResolveDepth(11))->toThrow(SecurityException::class);
        });

        it('does not throw when depth equals the limit exactly', function (): void {
            $parser = new SecurityParser(maxResolveDepth: 5);

            $parser->assertMaxResolveDepth(5);

            expect(5)->toBe($parser->maxResolveDepth);
        });
    });

    // assertMaxKeys()
    describe(SecurityParser::class . ' > assertMaxKeys', function (): void {
        it('does not throw when key count is within the default limit', function (): void {
            $parser = new SecurityParser();

            $parser->assertMaxKeys(['a' => 1, 'b' => 2]);

            expect(2)->toBeLessThanOrEqual($parser->maxKeys);
        });

        it('throws SecurityException when total key count exceeds the configured limit', function (): void {
            $parser = new SecurityParser(maxKeys: 2);

            expect(fn () => $parser->assertMaxKeys(['a' => 1, 'b' => 2, 'c' => 3]))->toThrow(SecurityException::class);
        });

        it('counts nested keys recursively toward the limit', function (): void {
            $parser = new SecurityParser(maxKeys: 3);

            // 2 root keys + 2 nested = 4 total keys → exceeds limit
            $data = ['a' => ['x' => 1, 'y' => 2], 'b' => 1];

            expect(fn () => $parser->assertMaxKeys($data))->toThrow(SecurityException::class);
        });

        it('respects a maxKeys override', function (): void {
            $parser = new SecurityParser(maxKeys: 1_000);

            // Override forces limit to 1
            expect(fn () => $parser->assertMaxKeys(['a' => 1, 'b' => 2], 1))->toThrow(SecurityException::class);
        });
    });

    // assertMaxDepth()
    describe(SecurityParser::class . ' > assertMaxDepth', function (): void {
        it('does not throw when depth is within the limit', function (): void {
            $parser = new SecurityParser(maxDepth: 100);

            $parser->assertMaxDepth(50);

            expect(50)->toBeLessThanOrEqual($parser->maxDepth);
        });

        it('throws SecurityException when depth exceeds the limit', function (): void {
            $parser = new SecurityParser(maxDepth: 5);

            expect(fn () => $parser->assertMaxDepth(6))->toThrow(SecurityException::class);
        });

        it('respects a maxDepth override', function (): void {
            $parser = new SecurityParser(maxDepth: 500);

            expect(fn () => $parser->assertMaxDepth(3, 2))->toThrow(SecurityException::class);
        });
    });

    // assertMaxStructuralDepth()
    describe(SecurityParser::class . ' > assertMaxStructuralDepth', function (): void {
        it('does not throw for a flat array', function (): void {
            $parser = new SecurityParser(maxDepth: 10);

            $parser->assertMaxStructuralDepth(['a' => 1], 10);

            expect(['a' => 1])->toBeArray();
        });

        it('does not throw for a nested array within the structural limit', function (): void {
            $parser = new SecurityParser(maxDepth: 5);

            $data = ['a' => ['b' => ['c' => 1]]];

            $parser->assertMaxStructuralDepth($data, 5);

            expect($data)->toBeArray();
        });

        it('throws SecurityException when structural depth exceeds the policy maximum', function (): void {
            $parser = new SecurityParser(maxDepth: 2);

            $data = ['a' => ['b' => ['c' => 'd']]]; // depth 3

            expect(fn () => $parser->assertMaxStructuralDepth($data, 2))->toThrow(SecurityException::class);
        });

        it('does not throw for non-array input', function (): void {
            $parser = new SecurityParser();

            $parser->assertMaxStructuralDepth('scalar', 10);

            expect('scalar')->toBeString();
        });
    });

    // assertMaxKeys() - maxCountRecursiveDepth limit
    describe(SecurityParser::class . ' > assertMaxKeys depth limit', function (): void {
        it('ceases counting keys once recursion exceeds the maxCountRecursiveDepth', function (): void {
            $parser = new SecurityParser(maxKeys: 10_000);
            $nested = ['l1' => ['l2' => ['l3' => ['l4' => 'deep']]]];

            // With maxCountDepth=1, depth-2+ keys are not counted → no exception thrown
            $parser->assertMaxKeys($nested, null, 1);

            expect(true)->toBeTrue();
        });
    });

    // getMaxKeys()
    describe(SecurityParser::class . ' > getMaxKeys', function (): void {
        it('returns the configured max key count', function (): void {
            $parser = new SecurityParser(maxKeys: 250);

            expect($parser->getMaxKeys())->toBe(250);
        });

        it('returns the default max key count when not overridden', function (): void {
            $parser = new SecurityParser();

            expect($parser->getMaxKeys())->toBe(10_000);
        });
    });
});
