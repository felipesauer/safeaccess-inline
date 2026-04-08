import { describe, expect, it, beforeEach } from 'vitest';
import { SegmentPathResolver } from '../../src/path-query/segment-path-resolver.js';
import { SegmentParser } from '../../src/path-query/segment-parser.js';
import { SegmentFilterParser } from '../../src/path-query/segment-filter-parser.js';
import { SecurityGuard } from '../../src/security/security-guard.js';
import { SegmentType } from '../../src/path-query/segment-type.js';
import type { Segment } from '../../src/path-query/segment-type.js';
import { SecurityException } from '../../src/exceptions/security-exception.js';

describe(SegmentPathResolver.name, () => {
    let filterParser: SegmentFilterParser;
    let segmentParser: SegmentParser;
    let resolver: SegmentPathResolver;
    let r: (data: Record<string, unknown>, path: string, defaultValue?: unknown) => unknown;

    beforeEach(() => {
        const guard = new SecurityGuard();
        filterParser = new SegmentFilterParser(guard);
        segmentParser = new SegmentParser(filterParser);
        resolver = new SegmentPathResolver(filterParser);
        r = (
            data: Record<string, unknown>,
            path: string,
            defaultValue: unknown = null,
        ): unknown => {
            const segments = segmentParser.parseSegments(path);
            return resolver.resolve(data, segments, 0, defaultValue, 100);
        };
    });

    describe(`${SegmentPathResolver.name} > resolve basics`, () => {
        it('returns the value for an existing key', () => {
            const data = { name: 'Alice' };

            expect(r(data, 'name')).toBe('Alice');
        });

        it('returns the default when the key does not exist', () => {
            const data = { name: 'Alice' };

            expect(r(data, 'missing', 'fallback')).toBe('fallback');
        });

        it('resolves a nested two-level path', () => {
            const data = { user: { name: 'Alice' } };

            expect(r(data, 'user.name')).toBe('Alice');
        });

        it('resolves a nested three-level path', () => {
            const data = { user: { address: { city: 'Porto Alegre' } } };

            expect(r(data, 'user.address.city')).toBe('Porto Alegre');
        });

        it('returns current value when segments list is empty', () => {
            const data = { key: 'value' };
            const result = resolver.resolve(data, [], 0, null, 100);

            expect(result).toEqual(data);
        });

        it('throws SecurityException when index exceeds maxDepth', () => {
            const data = { a: 1 };
            const segments: Segment[] = [{ type: SegmentType.Key, value: 'a' }];

            expect(() => resolver.resolve(data, segments, 200, null, 100)).toThrow(
                SecurityException,
            );
        });
    });

    describe(`${SegmentPathResolver.name} > resolve wildcard`, () => {
        it('expands all children with a wildcard', () => {
            const data = { users: ['Alice', 'Bob', 'Carol'] };

            expect(r(data, 'users.*')).toEqual(['Alice', 'Bob', 'Carol']);
        });

        it('returns default for a wildcard on a non-array value', () => {
            const data = { name: 'Alice' };

            expect(r(data, 'name.*', 'default')).toBe('default');
        });

        it('chains wildcard with a nested key', () => {
            const data = { users: [{ name: 'Alice' }, { name: 'Bob' }] };

            expect(r(data, 'users.*.name')).toEqual(['Alice', 'Bob']);
        });
    });

    describe(`${SegmentPathResolver.name} > resolve descent`, () => {
        it('collects all values for a recursive descent key', () => {
            const data = {
                name: 'Alice',
                friend: { name: 'Bob' },
            };

            const result = r(data, '..name') as unknown[];

            expect(result).toContain('Alice');
            expect(result).toContain('Bob');
        });

        it('collects values for DescentMulti with multiple keys', () => {
            const data = {
                a: 1,
                b: 2,
                nested: { a: 10, b: 20 },
            };

            const result = r(data, "..['a','b']") as unknown[];

            expect(result).toContain(1);
            expect(result).toContain(2);
            expect(result).toContain(10);
            expect(result).toContain(20);
        });

        it('returns default when DescentMulti finds no keys', () => {
            const data = { x: 1 };

            const result = r(data, "..['missing1','missing2']", 'fallback');

            expect(result).toBe('fallback');
        });
    });

    describe(`${SegmentPathResolver.name} > resolve filter`, () => {
        it('filters array items that satisfy a condition', () => {
            const data = {
                users: [
                    { name: 'Alice', age: 30 },
                    { name: 'Bob', age: 17 },
                    { name: 'Carol', age: 25 },
                ],
            };

            const result = r(data, 'users[?age>18]') as Array<Record<string, unknown>>;

            expect(result).toHaveLength(2);
            expect(result[0].name).toBe('Alice');
            expect(result[1].name).toBe('Carol');
        });

        it('returns empty array when no items match the filter', () => {
            const data = { users: [{ name: 'Alice', age: 10 }] };

            const result = r(data, 'users[?age>100]') as unknown[];

            expect(result).toHaveLength(0);
        });

        it('returns default when the filter is applied to a non-array value', () => {
            const data = { name: 'Alice' };

            const result = r(data, 'name[?age>18]', 'fallback');

            expect(result).toBe('fallback');
        });

        it('chains filter with a key to access a field of filtered items', () => {
            const data = {
                users: [
                    { name: 'Alice', active: true },
                    { name: 'Bob', active: false },
                ],
            };

            const result = r(data, 'users[?active==true].name');

            expect(result).toEqual(['Alice']);
        });
    });

    describe(`${SegmentPathResolver.name} > resolve multi-key and multi-index`, () => {
        it("selects multiple keys with ['a','b']", () => {
            const data = { data: { a: 1, b: 2, c: 3 } };

            const result = r(data, "data['a','b']");

            expect(result).toEqual([1, 2]);
        });

        it('returns default for a multi-key miss', () => {
            const data = { data: { a: 1 } };

            const result = r(data, "data['missing']", 'fallback');

            expect(result).toBe('fallback');
        });

        it('selects multiple indices [0,2]', () => {
            const data = { items: ['a', 'b', 'c', 'd'] };

            const result = r(data, 'items[0,2]');

            expect(result).toEqual(['a', 'c']);
        });

        it('resolves a negative multi-index [-1] via MultiIndex segment', () => {
            const segments: Segment[] = [
                { type: SegmentType.Key, value: 'items' },
                { type: SegmentType.MultiIndex, indices: [-1] },
            ];
            const data = { items: ['a', 'b', 'c'] };

            const result = resolver.resolve(data, segments, 0, null, 100);

            expect(result).toEqual(['c']);
        });

        it('returns default when multi-index is out of bounds', () => {
            const data = { items: ['a'] };

            const result = r(data, 'items[0,99]', 'fallback') as unknown[];

            expect(result[1]).toBe('fallback');
        });

        it('returns default for multi-key on a non-object', () => {
            const segments: Segment[] = [{ type: SegmentType.MultiKey, keys: ['a', 'b'] }];

            const result = resolver.resolve('not-an-array', segments, 0, 'fallback', 100);

            expect(result).toBe('fallback');
        });

        it('returns default for multi-index on a non-object', () => {
            const segments: Segment[] = [{ type: SegmentType.MultiIndex, indices: [0, 1] }];

            const result = resolver.resolve('not-an-array', segments, 0, 'fallback', 100);

            expect(result).toBe('fallback');
        });
    });

    describe(`${SegmentPathResolver.name} > resolve slice`, () => {
        it('slices an array [1:3]', () => {
            const data = { items: ['a', 'b', 'c', 'd', 'e'] };

            const result = r(data, 'items[1:3]');

            expect(result).toEqual(['b', 'c']);
        });

        it('slices with a step [0:6:2]', () => {
            const data = { items: ['a', 'b', 'c', 'd', 'e', 'f'] };

            const result = r(data, 'items[0:6:2]');

            expect(result).toEqual(['a', 'c', 'e']);
        });

        it('returns default for a slice on a non-object', () => {
            const data = { name: 'Alice' };

            const result = r(data, 'name[0:1]', 'fallback');

            expect(result).toBe('fallback');
        });

        it('returns empty array for an out-of-range slice', () => {
            const data = { items: ['a', 'b'] };

            const result = r(data, 'items[99:100]') as unknown[];

            expect(result).toHaveLength(0);
        });
    });

    describe(`${SegmentPathResolver.name} > resolve projection`, () => {
        it('projects specific fields from a map', () => {
            const data = { user: { name: 'Alice', age: 30, password: 'secret' } };

            const result = r(data, 'user.{name,age}') as Record<string, unknown>;

            expect(result).toEqual({ name: 'Alice', age: 30 });
            expect(result).not.toHaveProperty('password');
        });

        it('projects fields with an alias', () => {
            const data = { user: { name: 'Alice' } };

            const result = r(data, 'user.{fullName: name}') as Record<string, unknown>;

            expect(result).toHaveProperty('fullName');
            expect(result.fullName).toBe('Alice');
        });

        it('projects fields from a list of items', () => {
            const data = {
                users: [
                    { name: 'Alice', age: 30 },
                    { name: 'Bob', age: 25 },
                ],
            };

            const result = r(data, 'users.{name}');

            expect(result).toEqual([{ name: 'Alice' }, { name: 'Bob' }]);
        });

        it('sets projected field to null when source key is missing', () => {
            const data = { user: { name: 'Alice' } };

            const result = r(data, 'user.{name,missing}') as Record<string, unknown>;

            expect(result.missing).toBeNull();
        });

        it('returns default for a projection on a non-object', () => {
            const data = { name: 'Alice' };

            const result = r(data, 'name.{foo}', 'fallback');

            expect(result).toBe('fallback');
        });
    });

    describe(`${SegmentPathResolver.name} > resolve edge cases`, () => {
        it('resolves further segments after a multi-key selection', () => {
            const data = { users: { alice: { age: 30 }, bob: { age: 25 } } };

            const segments: Segment[] = [
                { type: SegmentType.Key, value: 'users' },
                { type: SegmentType.MultiKey, keys: ['alice', 'bob'] },
                { type: SegmentType.Key, value: 'age' },
            ];
            const result = resolver.resolve(data, segments, 0, null, 100);

            expect(result).toEqual([30, 25]);
        });

        it('resolves further segments after a multi-index selection', () => {
            const data = { items: [{ name: 'a' }, { name: 'b' }, { name: 'c' }, { name: 'd' }] };

            const segments: Segment[] = [
                { type: SegmentType.Key, value: 'items' },
                { type: SegmentType.MultiIndex, indices: [0, 2] },
                { type: SegmentType.Key, value: 'name' },
            ];
            const result = resolver.resolve(data, segments, 0, null, 100);

            expect(result).toEqual(['a', 'c']);
        });

        it('adjusts a negative start index in a slice', () => {
            const segments: Segment[] = [
                { type: SegmentType.Key, value: 'items' },
                { type: SegmentType.Slice, start: -2, end: null, step: 1 },
            ];
            const data = { items: ['a', 'b', 'c', 'd'] };

            const result = resolver.resolve(data, segments, 0, null, 100);

            expect(result).toEqual(['c', 'd']);
        });

        it('adjusts a negative end index in a slice', () => {
            const segments: Segment[] = [
                { type: SegmentType.Key, value: 'items' },
                { type: SegmentType.Slice, start: null, end: -2, step: 1 },
            ];
            const data = { items: ['a', 'b', 'c', 'd'] };

            const result = resolver.resolve(data, segments, 0, null, 100);

            expect(result).toEqual(['a', 'b']);
        });

        it('iterates in reverse order with a negative step', () => {
            const segments: Segment[] = [
                { type: SegmentType.Key, value: 'items' },
                { type: SegmentType.Slice, start: null, end: null, step: -1 },
            ];
            const data = { items: ['a', 'b', 'c', 'd'] };

            const result = resolver.resolve(data, segments, 0, null, 100);

            expect(result).toEqual(['d', 'c', 'b', 'a']);
        });

        it('applies further segments to each sliced item', () => {
            const data = { items: [{ name: 'a' }, { name: 'b' }, { name: 'c' }, { name: 'd' }] };

            const result = r(data, 'items[1:3].name');

            expect(result).toEqual(['b', 'c']);
        });

        it('projects null fields for non-object items in a list', () => {
            const data = { items: ['scalar1', 'scalar2'] };

            const result = r(data, 'items.{name}') as Array<Record<string, unknown>>;

            expect(result[0].name).toBeNull();
            expect(result[1].name).toBeNull();
        });

        it('applies further segments after projecting a list of items', () => {
            const segments: Segment[] = [
                { type: SegmentType.Key, value: 'users' },
                { type: SegmentType.Projection, fields: [{ alias: 'name', source: 'name' }] },
                { type: SegmentType.Key, value: 'extra' },
            ];
            const data = {
                users: [
                    { name: 'Alice', extra: 'x' },
                    { name: 'Bob', extra: 'y' },
                ],
            };

            const result = resolver.resolve(data, segments, 0, null, 100);

            expect(result).toEqual([null, null]);
        });

        it('applies further segments after projecting a single map', () => {
            const segments: Segment[] = [
                { type: SegmentType.Key, value: 'user' },
                { type: SegmentType.Projection, fields: [{ alias: 'name', source: 'name' }] },
                { type: SegmentType.Key, value: 'missing' },
            ];
            const data = { user: { name: 'Alice', age: 30 } };

            const result = resolver.resolve(data, segments, 0, 'fallback', 100);

            expect(result).toBe('fallback');
        });

        it('returns empty results from a descent on a non-object resolved value', () => {
            const data = { name: 'Alice' };

            const result = r(data, 'name..key');

            expect(result).toEqual([]);
        });

        it('resolves further segments after descent finds a matching key (scalar result)', () => {
            const data = { config: { settings: { debug: true } } };

            const result = r(data, '..settings.debug');

            expect(result).toEqual([true]);
        });

        it('spreads list results from descent followed by a wildcard segment', () => {
            const data = { a: { targets: [1, 2, 3] } };

            const result = r(data, '..targets[*]');

            expect(result).toEqual([1, 2, 3]);
        });

        it('resolves a wildcard on an object (non-array) as its values', () => {
            const segments: Segment[] = [{ type: SegmentType.Wildcard }];
            const data = { a: 1, b: 2 };

            const result = resolver.resolve(data, segments, 0, null, 100);

            expect(result).toEqual([1, 2]);
        });

        it('resolves a filter on an object (non-array) using its values', () => {
            const data = {
                items: { first: { name: 'Alice', age: 30 }, second: { name: 'Bob', age: 17 } },
            };

            const result = r(data, 'items[?age>18]') as Array<Record<string, unknown>>;

            expect(result).toHaveLength(1);
            expect(result[0].name).toBe('Alice');
        });

        it('skips non-object items in a filter array', () => {
            const data = {
                items: [{ name: 'Alice', age: 30 }, 'scalar', null, { name: 'Bob', age: 17 }],
            };

            const result = r(data, 'items[?age>18]') as Array<Record<string, unknown>>;

            expect(result).toHaveLength(1);
            expect(result[0].name).toBe('Alice');
        });

        it('resolves a multi-index on an object using Object.values order', () => {
            const segments: Segment[] = [{ type: SegmentType.MultiIndex, indices: [0] }];
            const data = { a: 'first', b: 'second' };

            const result = resolver.resolve(data, segments, 0, null, 100);

            expect(result).toEqual(['first']);
        });

        it('resolves a slice on an object using Object.values', () => {
            const segments: Segment[] = [{ type: SegmentType.Slice, start: 0, end: 1, step: null }];
            const data = { a: 'first', b: 'second' };

            const result = resolver.resolve(data, segments, 0, null, 100);

            expect(result).toEqual(['first']);
        });

        it('falls back to empty string key when segment has no value property', () => {
            const fakeSegment = { type: 'unknown-type' } as unknown as Segment;
            const result = resolver.resolve({ '': 'found' }, [fakeSegment], 0, 'default', 100);

            expect(result).toBe('found');
        });

        it('returns default when segmentAny reaches a segment without value and key is empty', () => {
            const fakeSegment = { type: 'unknown-type' } as unknown as Segment;
            const result = resolver.resolve({ x: 1 }, [fakeSegment], 0, 'default', 100);

            expect(result).toBe('default');
        });

        it('returns default for multi-key when key is missing and has further segments', () => {
            const segments: Segment[] = [
                { type: SegmentType.MultiKey, keys: ['missing'] },
                { type: SegmentType.Key, value: 'child' },
            ];
            const data = { a: 1 };

            const result = resolver.resolve(data, segments, 0, 'fallback', 100);

            expect(result).toEqual(['fallback']);
        });

        it('returns default for multi-index when index resolves to null', () => {
            const segments: Segment[] = [
                { type: SegmentType.MultiIndex, indices: [5] },
                { type: SegmentType.Key, value: 'name' },
            ];
            const data = ['a', 'b'];

            const result = resolver.resolve(data, segments, 0, 'fallback', 100);

            expect(result).toEqual(['fallback']);
        });

        it('returns default for a negative multi-index out of bounds', () => {
            const segments: Segment[] = [{ type: SegmentType.MultiIndex, indices: [-10] }];
            const data = ['a', 'b'];

            const result = resolver.resolve(data, segments, 0, 'fallback', 100);

            expect(result).toEqual(['fallback']);
        });
    });

    describe(`${SegmentPathResolver.name} > mutation boundary tests`, () => {
        it('returns items directly when wildcard is the last segment', () => {
            const segments: Segment[] = [
                { type: SegmentType.Key, value: 'items' },
                { type: SegmentType.Wildcard },
            ];
            const data = { items: [1, 2, 3] };

            const result = resolver.resolve(data, segments, 0, null, 100);

            expect(result).toEqual([1, 2, 3]);
        });

        it('resolves further segments after wildcard (nextIndex === segments.length - 1)', () => {
            const segments: Segment[] = [
                { type: SegmentType.Key, value: 'items' },
                { type: SegmentType.Wildcard },
                { type: SegmentType.Key, value: 'name' },
            ];
            const data = { items: [{ name: 'a' }, { name: 'b' }] };

            const result = resolver.resolve(data, segments, 0, null, 100);

            expect(result).toEqual(['a', 'b']);
        });

        it('returns filtered items directly when filter is the last segment', () => {
            const data = { items: [{ age: 10 }, { age: 30 }] };

            const result = r(data, 'items[?age>18]') as Array<Record<string, unknown>>;

            expect(result).toHaveLength(1);
            expect(result[0]).toEqual({ age: 30 });
        });

        it('resolves further segments after filter when more segments follow', () => {
            const data = {
                items: [
                    { age: 10, name: 'A' },
                    { age: 30, name: 'B' },
                ],
            };

            const result = r(data, 'items[?age>18].name');

            expect(result).toEqual(['B']);
        });

        it('returns multi-key values directly when multiKey is the last segment', () => {
            const segments: Segment[] = [
                { type: SegmentType.Key, value: 'data' },
                { type: SegmentType.MultiKey, keys: ['x', 'y'] },
            ];
            const data = { data: { x: 1, y: 2, z: 3 } };

            const result = resolver.resolve(data, segments, 0, null, 100);

            expect(result).toEqual([1, 2]);
        });

        it('resolves further segments after multi-key when more segments exist', () => {
            const segments: Segment[] = [
                { type: SegmentType.Key, value: 'data' },
                { type: SegmentType.MultiKey, keys: ['a', 'b'] },
                { type: SegmentType.Key, value: 'val' },
            ];
            const data = { data: { a: { val: 10 }, b: { val: 20 } } };

            const result = resolver.resolve(data, segments, 0, null, 100);

            expect(result).toEqual([10, 20]);
        });

        it('returns multi-index values directly when multiIndex is the last segment', () => {
            const segments: Segment[] = [
                { type: SegmentType.Key, value: 'items' },
                { type: SegmentType.MultiIndex, indices: [0, 2] },
            ];
            const data = { items: ['a', 'b', 'c'] };

            const result = resolver.resolve(data, segments, 0, null, 100);

            expect(result).toEqual(['a', 'c']);
        });

        it('resolves further segments after multi-index when more segments exist', () => {
            const segments: Segment[] = [
                { type: SegmentType.Key, value: 'items' },
                { type: SegmentType.MultiIndex, indices: [0, 1] },
                { type: SegmentType.Key, value: 'name' },
            ];
            const data = { items: [{ name: 'x' }, { name: 'y' }] };

            const result = resolver.resolve(data, segments, 0, null, 100);

            expect(result).toEqual(['x', 'y']);
        });

        it('returns sliced items directly when slice is the last segment', () => {
            const segments: Segment[] = [
                { type: SegmentType.Key, value: 'items' },
                { type: SegmentType.Slice, start: 0, end: 2, step: null },
            ];
            const data = { items: ['a', 'b', 'c'] };

            const result = resolver.resolve(data, segments, 0, null, 100);

            expect(result).toEqual(['a', 'b']);
        });

        it('resolves further segments after slice when more segments exist', () => {
            const data = { items: [{ name: 'a' }, { name: 'b' }, { name: 'c' }] };

            const result = r(data, 'items[0:2].name');

            expect(result).toEqual(['a', 'b']);
        });

        it('returns projected list directly when projection is the last segment (array)', () => {
            const segments: Segment[] = [
                { type: SegmentType.Key, value: 'items' },
                { type: SegmentType.Projection, fields: [{ alias: 'n', source: 'name' }] },
            ];
            const data = { items: [{ name: 'a' }, { name: 'b' }] };

            const result = resolver.resolve(data, segments, 0, null, 100);

            expect(result).toEqual([{ n: 'a' }, { n: 'b' }]);
        });

        it('resolves further segments after projection on array when more segments exist', () => {
            const segments: Segment[] = [
                { type: SegmentType.Key, value: 'items' },
                { type: SegmentType.Projection, fields: [{ alias: 'n', source: 'name' }] },
                { type: SegmentType.Key, value: 'n' },
            ];
            const data = { items: [{ name: 'a' }, { name: 'b' }] };

            const result = resolver.resolve(data, segments, 0, null, 100);

            expect(result).toEqual(['a', 'b']);
        });

        it('returns projected map directly when projection is the last segment (object)', () => {
            const segments: Segment[] = [
                { type: SegmentType.Key, value: 'user' },
                { type: SegmentType.Projection, fields: [{ alias: 'n', source: 'name' }] },
            ];
            const data = { user: { name: 'Alice', age: 30 } };

            const result = resolver.resolve(data, segments, 0, null, 100);

            expect(result).toEqual({ n: 'Alice' });
        });

        it('resolves further segments after projection on object when more segments exist', () => {
            const segments: Segment[] = [
                { type: SegmentType.Key, value: 'user' },
                { type: SegmentType.Projection, fields: [{ alias: 'n', source: 'name' }] },
                { type: SegmentType.Key, value: 'n' },
            ];
            const data = { user: { name: 'Alice', age: 30 } };

            const result = resolver.resolve(data, segments, 0, null, 100);

            expect(result).toBe('Alice');
        });

        it('skips non-object items during filter evaluation', () => {
            const data = {
                items: [42, 'str', null, { age: 30 }],
            };

            const result = r(data, 'items[?age>18]') as Array<Record<string, unknown>>;

            expect(result).toHaveLength(1);
            expect(result[0]).toEqual({ age: 30 });
        });

        it('clamps start to len when start >= len in a positive-step slice', () => {
            const segments: Segment[] = [
                { type: SegmentType.Key, value: 'items' },
                { type: SegmentType.Slice, start: 100, end: 200, step: 1 },
            ];
            const data = { items: ['a', 'b', 'c'] };

            const result = resolver.resolve(data, segments, 0, null, 100);

            expect(result).toEqual([]);
        });

        it('clamps start to len when start equals len exactly', () => {
            const segments: Segment[] = [
                { type: SegmentType.Key, value: 'items' },
                { type: SegmentType.Slice, start: 3, end: 5, step: 1 },
            ];
            const data = { items: ['a', 'b', 'c'] };

            const result = resolver.resolve(data, segments, 0, null, 100);

            expect(result).toEqual([]);
        });

        it('clamps end to len when end > len', () => {
            const segments: Segment[] = [
                { type: SegmentType.Key, value: 'items' },
                { type: SegmentType.Slice, start: 0, end: 100, step: 1 },
            ];
            const data = { items: ['a', 'b', 'c'] };

            const result = resolver.resolve(data, segments, 0, null, 100);

            expect(result).toEqual(['a', 'b', 'c']);
        });

        it('does not clamp end when end equals len exactly', () => {
            const segments: Segment[] = [
                { type: SegmentType.Key, value: 'items' },
                { type: SegmentType.Slice, start: 0, end: 3, step: 1 },
            ];
            const data = { items: ['a', 'b', 'c'] };

            const result = resolver.resolve(data, segments, 0, null, 100);

            expect(result).toEqual(['a', 'b', 'c']);
        });

        it('uses step > 0 path for a positive step and step < 0 path for negative', () => {
            const segPos: Segment[] = [{ type: SegmentType.Slice, start: 0, end: 3, step: 1 }];
            const segNeg: Segment[] = [
                { type: SegmentType.Slice, start: null, end: null, step: -1 },
            ];
            const data = ['a', 'b', 'c'];

            const resPos = resolver.resolve(data, segPos, 0, null, 100);
            const resNeg = resolver.resolve(data, segNeg, 0, null, 100);

            expect(resPos).toEqual(['a', 'b', 'c']);
            expect(resNeg).toEqual(['c', 'b', 'a']);
        });

        it('defaults to a positive start when step > 0 and start is null', () => {
            const segments: Segment[] = [{ type: SegmentType.Slice, start: null, end: 2, step: 1 }];
            const data = ['a', 'b', 'c'];

            const result = resolver.resolve(data, segments, 0, null, 100);

            expect(result).toEqual(['a', 'b']);
        });

        it('defaults to len-1 start when step is negative and start is null', () => {
            const segments: Segment[] = [
                { type: SegmentType.Slice, start: null, end: null, step: -1 },
            ];
            const data = ['a', 'b', 'c'];

            const result = resolver.resolve(data, segments, 0, null, 100);

            expect(result).toEqual(['c', 'b', 'a']);
        });

        it('defaults to len end when step is positive and end is null', () => {
            const segments: Segment[] = [{ type: SegmentType.Slice, start: 1, end: null, step: 1 }];
            const data = ['a', 'b', 'c'];

            const result = resolver.resolve(data, segments, 0, null, 100);

            expect(result).toEqual(['b', 'c']);
        });

        it('defaults to -len-1 end when step is negative and end is null', () => {
            const segments: Segment[] = [
                { type: SegmentType.Slice, start: 2, end: null, step: -1 },
            ];
            const data = ['a', 'b', 'c'];

            const result = resolver.resolve(data, segments, 0, null, 100);

            expect(result).toEqual(['c', 'b', 'a']);
        });

        it('returns empty descent results when current is not an object', () => {
            const segments: Segment[] = [
                { type: SegmentType.Key, value: 'x' },
                { type: SegmentType.Descent, key: 'a' },
            ];
            const data = { x: 'scalar' };

            const result = resolver.resolve(data, segments, 0, null, 100);

            expect(result).toEqual([]);
        });

        it('skips null children during descent traversal', () => {
            const data = {
                a: { name: 'found' },
                b: null,
                c: 'scalar',
                d: { nested: { name: 'also found' } },
            };

            const result = r(data, '..name') as unknown[];

            expect(result).toContain('found');
            expect(result).toContain('also found');
            expect(result).toHaveLength(2);
        });

        it('skips primitive children during descent traversal', () => {
            const data = {
                name: 'top',
                x: 42,
                y: true,
                z: { name: 'deep' },
            };

            const result = r(data, '..name') as unknown[];

            expect(result).toEqual(['top', 'deep']);
        });

        it('returns default for wildcard on a scalar value', () => {
            const segments: Segment[] = [{ type: SegmentType.Wildcard }];

            const result = resolver.resolve(42, segments, 0, 'default', 100);

            expect(result).toBe('default');
        });

        it('returns default for filter on a scalar value', () => {
            const filterParser2 = new SegmentFilterParser(new SecurityGuard());
            const filterExpr = filterParser2.parse('age>18');
            const segments: Segment[] = [{ type: SegmentType.Filter, expression: filterExpr }];

            const result = resolver.resolve('not-object', segments, 0, 'default', 100);

            expect(result).toBe('default');
        });

        it('returns default for slice on a scalar value', () => {
            const segments: Segment[] = [{ type: SegmentType.Slice, start: 0, end: 1, step: null }];

            const result = resolver.resolve('not-object', segments, 0, 'default', 100);

            expect(result).toBe('default');
        });

        it('returns default for projection on a scalar value', () => {
            const segments: Segment[] = [
                { type: SegmentType.Projection, fields: [{ alias: 'n', source: 'name' }] },
            ];

            const result = resolver.resolve('not-object', segments, 0, 'default', 100);

            expect(result).toBe('default');
        });

        it('does not recurse into non-object children during descent', () => {
            const data = {
                items: [1, 2, 'text', null],
                nested: { name: 'got it' },
            };

            const result = r(data, '..name') as unknown[];

            expect(result).toEqual(['got it']);
        });

        it('descent on empty object returns empty results', () => {
            const result = r({}, '..key');

            expect(result).toEqual([]);
        });

        it('projection non-object items produce null fields in array projection', () => {
            const segments: Segment[] = [
                { type: SegmentType.Projection, fields: [{ alias: 'x', source: 'x' }] },
            ];
            const data = [null, 42, 'str'];

            const result = resolver.resolve(data, segments, 0, null, 100);

            expect(result).toEqual([{ x: null }, { x: null }, { x: null }]);
        });

        it('slice with step=0 distinction: step >= 0 vs step > 0 matters', () => {
            const segments: Segment[] = [
                { type: SegmentType.Slice, start: null, end: null, step: 1 },
            ];
            const data = ['a', 'b', 'c'];
            const result = resolver.resolve(data, segments, 0, null, 100);

            expect(result).toEqual(['a', 'b', 'c']);
        });

        it('resolves descent collecting scalar from matched key then recursing into children', () => {
            const data = {
                tag: 'root',
                inner: {
                    tag: 'child',
                },
            };

            const result = r(data, '..tag') as unknown[];

            expect(result).toEqual(['root', 'child']);
        });

        it('clamps start to len with negative step when start exceeds array length', () => {
            const segments: Segment[] = [
                { type: SegmentType.Slice, start: 100, end: null, step: -1 },
            ];
            const data = ['a', 'b', 'c'];

            const result = resolver.resolve(data, segments, 0, null, 100) as unknown[];

            expect(result).toHaveLength(4);
            expect(result[0]).toBeUndefined();
            expect(result.slice(1)).toEqual(['c', 'b', 'a']);
        });

        it('clamps end to len when end exceeds array length with positive step', () => {
            const segments: Segment[] = [
                { type: SegmentType.Key, value: 'items' },
                { type: SegmentType.Slice, start: 1, end: 999, step: 1 },
            ];
            const data = { items: ['a', 'b', 'c'] };

            const result = resolver.resolve(data, segments, 0, null, 100);

            expect(result).toEqual(['b', 'c']);
        });

        it('does not clamp end when end equals len (end > len only, not >=)', () => {
            const segments: Segment[] = [{ type: SegmentType.Slice, start: 0, end: 3, step: 1 }];
            const data = ['a', 'b', 'c'];

            const result = resolver.resolve(data, segments, 0, null, 100);

            expect(result).toEqual(['a', 'b', 'c']);
        });

        it('clamps start to len when start equals len exactly with negative step', () => {
            const segments: Segment[] = [
                { type: SegmentType.Slice, start: 3, end: null, step: -1 },
            ];
            const data = ['a', 'b', 'c'];

            const result = resolver.resolve(data, segments, 0, null, 100) as unknown[];

            expect(result).toHaveLength(4);
            expect(result[0]).toBeUndefined();
            expect(result.slice(1)).toEqual(['c', 'b', 'a']);
        });
    });
});
