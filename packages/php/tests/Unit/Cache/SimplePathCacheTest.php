<?php

declare(strict_types=1);

use SafeAccess\Inline\Cache\SimplePathCache;

describe(SimplePathCache::class, function (): void {
    // get()
    describe(SimplePathCache::class . ' > get', function (): void {
        it('returns null on cache miss', function (): void {
            $cache = new SimplePathCache();

            expect($cache->get('user.name'))->toBeNull();
        });

        it('returns cached segments on hit', function (): void {
            $cache = new SimplePathCache();
            $segments = [['type' => 'key', 'value' => 'user']];
            $cache->set('user', $segments);

            expect($cache->get('user'))->toBe($segments);
        });

        it('promotes the accessed entry to most-recently-used position', function (): void {
            $cache = new SimplePathCache(maxSize: 3);

            $s1 = [['type' => 'key', 'value' => 'a']];
            $s2 = [['type' => 'key', 'value' => 'b']];
            $s3 = [['type' => 'key', 'value' => 'c']];

            $cache->set('a', $s1);
            $cache->set('b', $s2);
            $cache->set('c', $s3);

            // Access 'a' to promote it to MRU
            $cache->get('a');

            // Now add a 4th entry - 'b' (oldest) should be evicted, not 'a'
            $cache->set('d', [['type' => 'key', 'value' => 'd']]);

            expect($cache->has('a'))->toBeTrue();
            expect($cache->has('b'))->toBeFalse();
            expect($cache->has('c'))->toBeTrue();
            expect($cache->has('d'))->toBeTrue();
        });
    });

    // set()
    describe(SimplePathCache::class . ' > set', function (): void {
        it('stores segments and makes them retrievable', function (): void {
            $cache = new SimplePathCache();
            $segments = [['type' => 'key', 'value' => 'name']];

            $cache->set('name', $segments);

            expect($cache->get('name'))->toBe($segments);
        });

        it('evicts the least-recently-used entry when capacity is reached', function (): void {
            $cache = new SimplePathCache(maxSize: 2);

            $cache->set('a', [['type' => 'key', 'value' => 'a']]);
            $cache->set('b', [['type' => 'key', 'value' => 'b']]);

            // 'a' is the LRU entry; adding 'c' should evict it
            $cache->set('c', [['type' => 'key', 'value' => 'c']]);

            expect($cache->has('a'))->toBeFalse();
            expect($cache->has('b'))->toBeTrue();
            expect($cache->has('c'))->toBeTrue();
        });

        it('overwrites an existing entry without growing the cache beyond maxSize', function (): void {
            $cache = new SimplePathCache(maxSize: 2);
            $s1 = [['type' => 'key', 'value' => 'v1']];
            $s2 = [['type' => 'key', 'value' => 'v2']];

            $cache->set('a', $s1);
            $cache->set('a', $s2);

            expect($cache->get('a'))->toBe($s2);
        });
    });

    // has()
    describe(SimplePathCache::class . ' > has', function (): void {
        it('returns true for a cached path', function (): void {
            $cache = new SimplePathCache();
            $cache->set('foo', []);

            expect($cache->has('foo'))->toBeTrue();
        });

        it('returns false for a path not in cache', function (): void {
            $cache = new SimplePathCache();

            expect($cache->has('missing'))->toBeFalse();
        });
    });

    // clear()
    describe(SimplePathCache::class . ' > clear', function (): void {
        it('removes all entries from the cache', function (): void {
            $cache = new SimplePathCache();
            $cache->set('a', []);
            $cache->set('b', []);

            $cache->clear();

            expect($cache->has('a'))->toBeFalse();
            expect($cache->has('b'))->toBeFalse();
        });

        it('returns the same instance for fluent chaining', function (): void {
            $cache = new SimplePathCache();

            expect($cache->clear())->toBe($cache);
        });
    });
});
