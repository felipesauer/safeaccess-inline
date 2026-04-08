import { describe, expect, it } from 'vitest';
import { SimplePathCache } from '../../src/cache/simple-path-cache.js';
import { SegmentType } from '../../src/path-query/segment-type.js';
import type { Segment } from '../../src/path-query/segment-type.js';

describe(SimplePathCache.name, () => {
    describe(`${SimplePathCache.name} > get`, () => {
        it('returns null on cache miss', () => {
            const cache = new SimplePathCache();

            expect(cache.get('user.name')).toBeNull();
        });

        it('returns cached segments on hit', () => {
            const cache = new SimplePathCache();
            const segments: Segment[] = [{ type: SegmentType.Key, value: 'user' }];
            cache.set('user', segments);

            expect(cache.get('user')).toEqual(segments);
        });

        it('promotes the accessed entry to most-recently-used position', () => {
            const cache = new SimplePathCache(3);

            const s1: Segment[] = [{ type: SegmentType.Key, value: 'a' }];
            const s2: Segment[] = [{ type: SegmentType.Key, value: 'b' }];
            const s3: Segment[] = [{ type: SegmentType.Key, value: 'c' }];

            cache.set('a', s1);
            cache.set('b', s2);
            cache.set('c', s3);

            cache.get('a');

            cache.set('d', [{ type: SegmentType.Key, value: 'd' }]);

            expect(cache.has('a')).toBe(true);
            expect(cache.has('b')).toBe(false);
            expect(cache.has('c')).toBe(true);
            expect(cache.has('d')).toBe(true);
        });
    });

    describe(`${SimplePathCache.name} > set`, () => {
        it('stores segments and makes them retrievable', () => {
            const cache = new SimplePathCache();
            const segments: Segment[] = [{ type: SegmentType.Key, value: 'name' }];

            cache.set('name', segments);

            expect(cache.get('name')).toEqual(segments);
        });

        it('evicts the least-recently-used entry when capacity is reached', () => {
            const cache = new SimplePathCache(2);

            cache.set('a', [{ type: SegmentType.Key, value: 'a' }]);
            cache.set('b', [{ type: SegmentType.Key, value: 'b' }]);

            cache.set('c', [{ type: SegmentType.Key, value: 'c' }]);

            expect(cache.has('a')).toBe(false);
            expect(cache.has('b')).toBe(true);
            expect(cache.has('c')).toBe(true);
        });

        it('overwrites an existing entry without growing the cache beyond maxSize', () => {
            const cache = new SimplePathCache(2);
            const s1: Segment[] = [{ type: SegmentType.Key, value: 'v1' }];
            const s2: Segment[] = [{ type: SegmentType.Key, value: 'v2' }];

            cache.set('a', s1);
            cache.set('a', s2);

            expect(cache.get('a')).toEqual(s2);
        });

        it('handles maxSize of zero without error', () => {
            const cache = new SimplePathCache(0);
            const segments: Segment[] = [{ type: SegmentType.Key, value: 'a' }];

            cache.set('a', segments);

            expect(cache.has('a')).toBe(true);
        });

        it('evicts correctly with maxSize of 1', () => {
            const cache = new SimplePathCache(1);

            cache.set('a', [{ type: SegmentType.Key, value: 'a' }]);
            cache.set('b', [{ type: SegmentType.Key, value: 'b' }]);

            expect(cache.has('a')).toBe(false);
            expect(cache.has('b')).toBe(true);
        });
    });

    describe(`${SimplePathCache.name} > has`, () => {
        it('returns true for a cached path', () => {
            const cache = new SimplePathCache();
            cache.set('foo', []);

            expect(cache.has('foo')).toBe(true);
        });

        it('returns false for a path not in cache', () => {
            const cache = new SimplePathCache();

            expect(cache.has('missing')).toBe(false);
        });
    });

    describe(`${SimplePathCache.name} > clear`, () => {
        it('removes all entries from the cache', () => {
            const cache = new SimplePathCache();
            cache.set('a', []);
            cache.set('b', []);

            cache.clear();

            expect(cache.has('a')).toBe(false);
            expect(cache.has('b')).toBe(false);
        });

        it('returns the same instance for fluent chaining', () => {
            const cache = new SimplePathCache();

            expect(cache.clear()).toBe(cache);
        });
    });

    describe(`${SimplePathCache.name} > mutation boundary tests`, () => {
        it('does not evict when cache has remaining capacity', () => {
            const cache = new SimplePathCache(3);
            cache.set('a', [{ type: SegmentType.Key, value: 'a' }]);
            cache.set('b', [{ type: SegmentType.Key, value: 'b' }]);

            expect(cache.has('a')).toBe(true);
            expect(cache.has('b')).toBe(true);
        });

        it('guards firstKey !== undefined when evicting from a non-empty cache', () => {
            const cache = new SimplePathCache(1);
            cache.set('a', [{ type: SegmentType.Key, value: 'a' }]);

            expect(cache.has('a')).toBe(true);

            cache.set('b', [{ type: SegmentType.Key, value: 'b' }]);

            expect(cache.has('a')).toBe(false);
            expect(cache.has('b')).toBe(true);
            expect(cache.get('a')).toBeNull();
            expect(cache.get('b')).toEqual([{ type: SegmentType.Key, value: 'b' }]);
        });

        it('does not crash when set is called on max-capacity cache and firstKey exists', () => {
            const cache = new SimplePathCache(2);
            cache.set('x', []);
            cache.set('y', []);

            cache.set('z', [{ type: SegmentType.Key, value: 'z' }]);

            expect(cache.has('x')).toBe(false);
            expect(cache.has('y')).toBe(true);
            expect(cache.has('z')).toBe(true);
        });
    });
});
