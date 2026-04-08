<?php

declare(strict_types=1);

use SafeAccess\Inline\Core\DotNotationParser;
use SafeAccess\Inline\Exceptions\PathNotFoundException;
use SafeAccess\Inline\Exceptions\SecurityException;
use SafeAccess\Inline\PathQuery\SegmentFilterParser;
use SafeAccess\Inline\PathQuery\SegmentParser;
use SafeAccess\Inline\PathQuery\SegmentPathResolver;
use SafeAccess\Inline\Security\SecurityGuard;
use SafeAccess\Inline\Security\SecurityParser;
use SafeAccess\Inline\Tests\Mocks\FakePathCache;

describe(DotNotationParser::class, function (): void {
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

    // get()
    describe(DotNotationParser::class . ' > get', function (): void {
        it('returns a top-level value', function (): void {
            $data = ['name' => 'Alice'];

            expect($this->parser->get($data, 'name'))->toBe('Alice');
        });

        it('returns a nested value', function (): void {
            $data = ['user' => ['name' => 'Alice']];

            expect($this->parser->get($data, 'user.name'))->toBe('Alice');
        });

        it('returns the default when the key is missing', function (): void {
            $data = ['name' => 'Alice'];

            expect($this->parser->get($data, 'missing', 'fallback'))->toBe('fallback');
        });

        it('returns the default for an empty path', function (): void {
            $data = ['name' => 'Alice'];

            expect($this->parser->get($data, '', 'default'))->toBe('default');
        });

        it('uses the cache on the second call', function (): void {
            $data = ['name' => 'Alice'];
            $this->parser->get($data, 'name');
            $beforeSecond = $this->cache->setCallCount;
            $this->parser->get($data, 'name');

            expect($this->cache->setCallCount)->toBe($beforeSecond);
            expect($this->cache->getCallCount)->toBeGreaterThanOrEqual(2);
        });

        it('stores a new path in the cache', function (): void {
            $data = ['name' => 'Alice'];
            $this->parser->get($data, 'name');

            expect($this->cache->setCallCount)->toBe(1);
        });
    });

    // has()
    describe(DotNotationParser::class . ' > has', function (): void {
        it('returns true when the path exists', function (): void {
            $data = ['names' => ['Alice']];

            expect($this->parser->has($data, 'names.0'))->toBeTrue();
        });

        it('returns false when the path does not exist', function (): void {
            $data = ['name' => 'Alice'];

            expect($this->parser->has($data, 'missing'))->toBeFalse();
        });

        it('returns true even when the value is null', function (): void {
            $data = ['key' => null];

            expect($this->parser->has($data, 'key'))->toBeTrue();
        });
    });

    // getStrict()
    describe(DotNotationParser::class . ' > getStrict', function (): void {
        it('returns the value when the path exists', function (): void {
            $data = ['name' => 'Alice'];

            expect($this->parser->getStrict($data, 'name'))->toBe('Alice');
        });

        it('throws PathNotFoundException when the path does not exist', function (): void {
            $data = ['name' => 'Alice'];

            expect(fn () => $this->parser->getStrict($data, 'missing'))
                ->toThrow(PathNotFoundException::class);
        });
    });

    // set()
    describe(DotNotationParser::class . ' > set', function (): void {
        it('sets a top-level value', function (): void {
            $data = [];

            $result = $this->parser->set($data, 'name', 'Alice');

            expect($result['name'])->toBe('Alice');
        });

        it('sets a nested value, creating intermediate keys', function (): void {
            $data = [];

            $result = $this->parser->set($data, 'user.name', 'Alice');

            expect($result['user']['name'])->toBe('Alice');
        });

        it('overwrites an existing value', function (): void {
            $data = ['name' => 'Alice'];

            $result = $this->parser->set($data, 'name', 'Bob');

            expect($result['name'])->toBe('Bob');
        });

        it('does not mutate the original array', function (): void {
            $data = ['name' => 'Alice'];

            $this->parser->set($data, 'name', 'Bob');

            expect($data['name'])->toBe('Alice');
        });

        it('throws SecurityException when the key is forbidden', function (): void {
            expect(fn () => $this->parser->set([], '__construct', 'bad'))
                ->toThrow(SecurityException::class);
        });
    });

    // remove()
    describe(DotNotationParser::class . ' > remove', function (): void {
        it('removes a top-level key', function (): void {
            $data = ['name' => 'Alice', 'age' => 30];

            $result = $this->parser->remove($data, 'name');

            expect($result)->not->toHaveKey('name');
            expect($result)->toHaveKey('age');
        });

        it('removes a nested key', function (): void {
            $data = ['user' => ['name' => 'Alice', 'age' => 30]];

            $result = $this->parser->remove($data, 'user.name');

            expect($result['user'])->not->toHaveKey('name');
            expect($result['user'])->toHaveKey('age');
        });

        it('is a no-op when the key does not exist', function (): void {
            $data = ['name' => 'Alice'];

            $result = $this->parser->remove($data, 'missing');

            expect($result)->toBe(['name' => 'Alice']);
        });
    });

    // merge()
    describe(DotNotationParser::class . ' > merge', function (): void {
        it('deep-merges at a given path', function (): void {
            $data = ['user' => ['name' => 'Alice', 'age' => 30]];

            $result = $this->parser->merge($data, 'user', ['age' => 31, 'city' => 'Porto']);

            expect($result['user']['name'])->toBe('Alice');
            expect($result['user']['age'])->toBe(31);
            expect($result['user']['city'])->toBe('Porto');
        });

        it('deep-merges at the root when path is empty', function (): void {
            $data = ['a' => 1, 'b' => 2];

            $result = $this->parser->merge($data, '', ['b' => 20, 'c' => 3]);

            expect($result)->toBe(['a' => 1, 'b' => 20, 'c' => 3]);
        });

        it('treats a non-array existing value as empty array for merge', function (): void {
            $data = ['config' => 'string-value'];

            $result = $this->parser->merge($data, 'config', ['key' => 'val']);

            expect($result['config'])->toBe(['key' => 'val']);
        });

        it('recursively merges two associative arrays at the same key', function (): void {
            $data = ['user' => ['name' => 'Alice', 'prefs' => ['color' => 'blue']]];

            $result = $this->parser->merge($data, '', ['user' => ['prefs' => ['size' => 'large']]]);

            expect($result['user']['prefs']['color'])->toBe('blue');
            expect($result['user']['prefs']['size'])->toBe('large');
        });
    });

    // getAt() / setAt() / removeAt()
    describe(DotNotationParser::class . ' > getAt / setAt / removeAt', function (): void {
        it('getAt returns a value from a pre-parsed segment array', function (): void {
            $data = ['user' => ['name' => 'Alice']];

            expect($this->parser->getAt($data, ['user', 'name']))->toBe('Alice');
        });

        it('getAt returns the default for a missing segment', function (): void {
            $data = ['user' => ['name' => 'Alice']];

            expect($this->parser->getAt($data, ['user', 'missing'], 'fallback'))->toBe('fallback');
        });

        it('setAt stores a value using a segment array', function (): void {
            $result = $this->parser->setAt([], ['user', 'name'], 'Alice');

            expect($result['user']['name'])->toBe('Alice');
        });

        it('setAt returns data unchanged for an empty segment array', function (): void {
            $data = ['name' => 'Alice'];
            $result = $this->parser->setAt($data, [], 'Bob');

            expect($result)->toBe($data);
        });

        it('removeAt deletes a key using a segment array', function (): void {
            $data = ['user' => ['name' => 'Alice', 'age' => 30]];

            $result = $this->parser->removeAt($data, ['user', 'name']);

            expect($result['user'])->not->toHaveKey('name');
        });

        it('removeAt returns data unchanged for an empty segment array', function (): void {
            $data = ['name' => 'Alice'];
            $result = $this->parser->removeAt($data, []);

            expect($result)->toBe($data);
        });
    });
});
