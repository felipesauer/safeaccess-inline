<?php

declare(strict_types=1);

use SafeAccess\Inline\Core\DotNotationParser;
use SafeAccess\Inline\Exceptions\SecurityException;
use SafeAccess\Inline\PathQuery\SegmentFilterParser;
use SafeAccess\Inline\PathQuery\SegmentParser;
use SafeAccess\Inline\PathQuery\SegmentPathResolver;
use SafeAccess\Inline\Security\SecurityGuard;
use SafeAccess\Inline\Security\SecurityParser;
use SafeAccess\Inline\Tests\Mocks\FakePathCache;

// Validation, security write-path, and resolve depth - see DotNotationParserTest.php for core CRUD

describe(DotNotationParser::class . ' > validation', function (): void {
    beforeEach(function (): void {
        $guard = new SecurityGuard();
        $securityParser = new SecurityParser();
        $this->cache = new FakePathCache();
        $filterParser = new SegmentFilterParser($guard);
        $segmentParser = new SegmentParser($filterParser);
        $resolver = new SegmentPathResolver($filterParser);

        $this->parser = new DotNotationParser(
            $guard,
            $securityParser,
            $this->cache,
            $segmentParser,
            $resolver,
        );
    });

    // validate() / assertPayload()
    describe(DotNotationParser::class . ' > validate and assertPayload', function (): void {
        it('validate passes for a clean array', function (): void {
            $data = ['name' => 'Alice', 'age' => 30];

            $this->parser->validate($data);

            expect(true)->toBeTrue(); // did not throw
        });

        it('validate throws SecurityException for a forbidden key', function (): void {
            $data = ['__construct' => ['payload' => true]];

            expect(fn () => $this->parser->validate($data))
                ->toThrow(SecurityException::class);
        });

        it('assertPayload passes for a string within the size limit', function (): void {
            $this->parser->assertPayload('{"name":"Alice"}');

            expect(true)->toBeTrue(); // did not throw
        });

        it('assertPayload throws SecurityException for an oversized string', function (): void {
            $huge = str_repeat('x', 10 * 1024 * 1024 + 1);

            expect(fn () => $this->parser->assertPayload($huge))
                ->toThrow(SecurityException::class);
        });
    });

    // resolve() delegation
    describe(DotNotationParser::class . ' > resolve', function (): void {
        it('resolves pre-parsed segments against data', function (): void {
            $data = ['users' => [['name' => 'Alice'], ['name' => 'Bob']]];
            $filterParser = new SegmentFilterParser(new SecurityGuard());
            $segmentParser = new SegmentParser($filterParser);
            $segments = $segmentParser->parseSegments('users.*.name');

            $result = $this->parser->resolve($data, $segments);

            expect($result)->toBe(['Alice', 'Bob']);
        });
    });

    describe(DotNotationParser::class . ' > write-path forbidden key validation', function (): void {
        it('throws SecurityException when setting a forbidden key via set', function (): void {
            expect(fn () => $this->parser->set([], '__construct', 'bad'))
                ->toThrow(SecurityException::class);
        });

        it('throws SecurityException when setting a nested forbidden key via set', function (): void {
            expect(fn () => $this->parser->set([], '__destruct.nested', 'bad'))
                ->toThrow(SecurityException::class);
        });

        it('throws SecurityException when removing a forbidden key via remove', function (): void {
            expect(fn () => $this->parser->remove(['safe' => 1], '__construct'))
                ->toThrow(SecurityException::class);
        });

        it('throws SecurityException when setting a forbidden key via setAt', function (): void {
            expect(fn () => $this->parser->setAt([], ['__proto__'], 'bad'))
                ->toThrow(SecurityException::class);
        });

        it('throws SecurityException when removing a forbidden key via removeAt', function (): void {
            expect(fn () => $this->parser->removeAt(['safe' => 1], ['constructor']))
                ->toThrow(SecurityException::class);
        });

        it('throws SecurityException when merge source contains a forbidden key', function (): void {
            expect(fn () => $this->parser->merge([], '', ['__construct' => 'bad']))
                ->toThrow(SecurityException::class);
        });

        it('throws SecurityException when merge source contains a nested forbidden key', function (): void {
            expect(fn () => $this->parser->merge(['user' => ['name' => 'Alice']], '', ['user' => ['__destruct' => 'bad']]))
                ->toThrow(SecurityException::class);
        });

        it('allows safe keys through write-path operations', function (): void {
            expect($this->parser->set([], 'username', 'Alice'))->toBe(['username' => 'Alice']);
            expect($this->parser->remove(['username' => 'Alice'], 'username'))->toBe([]);
            expect($this->parser->merge([], '', ['name' => 'Bob']))->toBe(['name' => 'Bob']);
        });

        it('write-path error message contains the forbidden key name', function (): void {
            expect(fn () => $this->parser->set([], '__clone', 'bad'))
                ->toThrow(SecurityException::class, "Forbidden key '__clone' detected.");
        });

        it('throws SecurityException for prototype pollution key via set', function (): void {
            expect(fn () => $this->parser->set([], 'prototype', 'bad'))
                ->toThrow(SecurityException::class);
        });
    });

    // getMaxKeys()
    describe(DotNotationParser::class . ' > getMaxKeys', function (): void {
        it('returns the max key count from the configured SecurityParser', function (): void {
            $guard = new SecurityGuard();
            $securityParser = new SecurityParser(maxKeys: 99);
            $filterParser = new SegmentFilterParser($guard);
            $segmentParser = new SegmentParser($filterParser);
            $resolver = new SegmentPathResolver($filterParser);
            $parser = new DotNotationParser($guard, $securityParser, new FakePathCache(), $segmentParser, $resolver);

            expect($parser->getMaxKeys())->toBe(99);
        });

        it('returns the default max key count when not overridden', function (): void {
            expect($this->parser->getMaxKeys())->toBe(10_000);
        });
    });

    describe(DotNotationParser::class . ' > resolve maxResolveDepth enforcement', function (): void {
        it('throws SecurityException when resolve depth exceeds maxResolveDepth', function (): void {
            $guard = new SecurityGuard();
            $securityParser = new SecurityParser(maxResolveDepth: 2);
            $filterParser = new SegmentFilterParser($guard);
            $segmentParser = new SegmentParser($filterParser);
            $resolver = new SegmentPathResolver($filterParser);
            $parser = new DotNotationParser($guard, $securityParser, new FakePathCache(), $segmentParser, $resolver);

            expect(fn () => $parser->get(['a' => ['b' => ['c' => 1]]], 'a.b.c'))
                ->toThrow(SecurityException::class);
        });

        it('resolves path within maxResolveDepth limit', function (): void {
            $guard = new SecurityGuard();
            $securityParser = new SecurityParser(maxResolveDepth: 5);
            $filterParser = new SegmentFilterParser($guard);
            $segmentParser = new SegmentParser($filterParser);
            $resolver = new SegmentPathResolver($filterParser);
            $parser = new DotNotationParser($guard, $securityParser, new FakePathCache(), $segmentParser, $resolver);

            expect($parser->get(['a' => ['b' => 1]], 'a.b'))->toBe(1);
        });

        it('uses maxResolveDepth, not maxDepth, for path resolution depth limit', function (): void {
            $guard = new SecurityGuard();
            $securityParser = new SecurityParser(maxDepth: 100, maxResolveDepth: 2);
            $filterParser = new SegmentFilterParser($guard);
            $segmentParser = new SegmentParser($filterParser);
            $resolver = new SegmentPathResolver($filterParser);
            $parser = new DotNotationParser($guard, $securityParser, new FakePathCache(), $segmentParser, $resolver);

            expect(fn () => $parser->get(['a' => ['b' => ['c' => 1]]], 'a.b.c'))
                ->toThrow(SecurityException::class);
        });

        it('does not throw at exact maxResolveDepth boundary', function (): void {
            $guard = new SecurityGuard();
            $securityParser = new SecurityParser(maxResolveDepth: 3);
            $filterParser = new SegmentFilterParser($guard);
            $segmentParser = new SegmentParser($filterParser);
            $resolver = new SegmentPathResolver($filterParser);
            $parser = new DotNotationParser($guard, $securityParser, new FakePathCache(), $segmentParser, $resolver);

            expect($parser->get(['a' => ['b' => ['c' => 1]]], 'a.b.c'))->toBe(1);
        });

        it('throws when resolve depth is one above maxResolveDepth', function (): void {
            $guard = new SecurityGuard();
            $securityParser = new SecurityParser(maxResolveDepth: 3);
            $filterParser = new SegmentFilterParser($guard);
            $segmentParser = new SegmentParser($filterParser);
            $resolver = new SegmentPathResolver($filterParser);
            $parser = new DotNotationParser($guard, $securityParser, new FakePathCache(), $segmentParser, $resolver);

            expect(fn () => $parser->get(['a' => ['b' => ['c' => ['d' => 1]]]], 'a.b.c.d'))
                ->toThrow(SecurityException::class);
        });

        it('exception message contains the depth value when resolve depth exceeded', function (): void {
            $guard = new SecurityGuard();
            $securityParser = new SecurityParser(maxResolveDepth: 2);
            $filterParser = new SegmentFilterParser($guard);
            $segmentParser = new SegmentParser($filterParser);
            $resolver = new SegmentPathResolver($filterParser);
            $parser = new DotNotationParser($guard, $securityParser, new FakePathCache(), $segmentParser, $resolver);

            try {
                $parser->get(['a' => ['b' => ['c' => 1]]], 'a.b.c');
                $this->fail('Should have thrown');
            } catch (SecurityException $e) {
                expect($e->getMessage())->toContain('3');
                expect($e->getMessage())->toContain('2');
            }
        });

        it('get enforces maxResolveDepth on nested path resolution', function (): void {
            $guard = new SecurityGuard();
            $securityParser = new SecurityParser(maxResolveDepth: 1);
            $filterParser = new SegmentFilterParser($guard);
            $segmentParser = new SegmentParser($filterParser);
            $resolver = new SegmentPathResolver($filterParser);
            $parser = new DotNotationParser($guard, $securityParser, new FakePathCache(), $segmentParser, $resolver);

            expect($parser->get(['a' => 1], 'a'))->toBe(1);
            expect(fn () => $parser->get(['a' => ['b' => 1]], 'a.b'))
                ->toThrow(SecurityException::class);
        });
    });
});
