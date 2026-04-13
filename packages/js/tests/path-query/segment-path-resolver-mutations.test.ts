import { describe, expect, it, beforeEach } from 'vitest';
import { SegmentPathResolver } from '../../src/path-query/segment-path-resolver.js';
import { SegmentParser } from '../../src/path-query/segment-parser.js';
import { SegmentFilterParser } from '../../src/path-query/segment-filter-parser.js';
import { SecurityGuard } from '../../src/security/security-guard.js';
import { SegmentType } from '../../src/path-query/segment-type.js';
import type { Segment } from '../../src/path-query/segment-type.js';
import { SecurityException } from '../../src/exceptions/security-exception.js';

describe(`${SegmentPathResolver.name} mutation tests`, () => {
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

    describe('SecurityException message content', () => {
        it('throws SecurityException with non-empty message', () => {
            const segments: Segment[] = [{ type: SegmentType.Key, value: 'a' }];

            try {
                resolver.resolve({}, segments, 200, null, 100);
                expect.fail('Should have thrown');
            } catch (e) {
                expect(e).toBeInstanceOf(SecurityException);
                expect((e as Error).message).not.toBe('');
                expect((e as Error).message).toContain('200');
            }
        });

        it('throws at exact boundary: index == maxDepth+1', () => {
            const segments: Segment[] = [{ type: SegmentType.Key, value: 'a' }];

            expect(() => resolver.resolve({}, segments, 101, null, 100)).toThrow(SecurityException);
        });

        it('does not throw at exact maxDepth boundary', () => {
            const segments: Segment[] = [];

            const result = resolver.resolve({ a: 1 }, segments, 100, null, 100);

            expect(result).toEqual({ a: 1 });
        });
    });

    describe('segmentAny null checks', () => {
        it('returns default when current is null', () => {
            const segments: Segment[] = [{ type: SegmentType.Key, value: 'x' }];

            expect(resolver.resolve(null, segments, 0, 'def', 100)).toBe('def');
        });

        it('returns default when current is a primitive string', () => {
            const segments: Segment[] = [{ type: SegmentType.Key, value: 'x' }];

            expect(resolver.resolve('text' as unknown, segments, 0, 'def', 100)).toBe('def');
        });

        it('returns default when current is undefined', () => {
            const segments: Segment[] = [{ type: SegmentType.Key, value: 'x' }];

            expect(resolver.resolve(undefined as unknown, segments, 0, 'def', 100)).toBe('def');
        });
    });

    describe('wildcard null checks', () => {
        it('returns default when wildcard applied to null', () => {
            const segments: Segment[] = [
                { type: SegmentType.Key, value: 'x' },
                { type: SegmentType.Wildcard },
            ];

            expect(resolver.resolve({ x: null }, segments, 0, 'def', 100)).toBe('def');
        });

        it('returns default when wildcard applied to a number', () => {
            const segments: Segment[] = [
                { type: SegmentType.Key, value: 'x' },
                { type: SegmentType.Wildcard },
            ];

            expect(resolver.resolve({ x: 42 }, segments, 0, 'def', 100)).toBe('def');
        });
    });

    describe('filter terminal vs chained', () => {
        it('returns filtered items when filter is the last segment', () => {
            const data = { items: [{ a: 1 }, { a: 2 }, { a: 3 }] };

            const result = r(data, 'items[?a>1]') as unknown[];

            expect(result).toEqual([{ a: 2 }, { a: 3 }]);
        });

        it('resolves further segments on each filtered item', () => {
            const data = {
                items: [
                    { a: 1, b: 'x' },
                    { a: 2, b: 'y' },
                    { a: 3, b: 'z' },
                ],
            };

            const result = r(data, 'items[?a>1].b');

            expect(result).toEqual(['y', 'z']);
        });

        it('returns default when filter applied to null', () => {
            const segments: Segment[] = [
                { type: SegmentType.Key, value: 'x' },
                {
                    type: SegmentType.Filter,
                    expression: {
                        conditions: [{ field: 'a', operator: '>', value: 0 }],
                        logicals: [],
                    },
                },
            ];

            expect(resolver.resolve({ x: null }, segments, 0, 'def', 100)).toBe('def');
        });
    });

    describe('multiKey terminal vs chained', () => {
        it('returns values directly when multiKey is the last segment', () => {
            const segments: Segment[] = [{ type: SegmentType.MultiKey, keys: ['a', 'b'] }];

            const result = resolver.resolve({ a: 1, b: 2 }, segments, 0, null, 100);

            expect(result).toEqual([1, 2]);
        });

        it('resolves further segments when multiKey is not the last segment', () => {
            const segments: Segment[] = [
                { type: SegmentType.MultiKey, keys: ['x', 'y'] },
                { type: SegmentType.Key, value: 'name' },
            ];

            const result = resolver.resolve(
                { x: { name: 'A' }, y: { name: 'B' } },
                segments,
                0,
                null,
                100,
            );

            expect(result).toEqual(['A', 'B']);
        });

        it('returns default for multiKey on null', () => {
            const segments: Segment[] = [
                { type: SegmentType.Key, value: 'z' },
                { type: SegmentType.MultiKey, keys: ['a'] },
            ];

            expect(resolver.resolve({ z: null }, segments, 0, 'def', 100)).toBe('def');
        });
    });

    describe('multiIndex terminal vs chained', () => {
        it('returns values directly when multiIndex is the last segment', () => {
            const segments: Segment[] = [{ type: SegmentType.MultiIndex, indices: [0, 2] }];

            const result = resolver.resolve(['a', 'b', 'c'], segments, 0, null, 100);

            expect(result).toEqual(['a', 'c']);
        });

        it('resolves further segments when multiIndex is not the last', () => {
            const segments: Segment[] = [
                { type: SegmentType.MultiIndex, indices: [0, 1] },
                { type: SegmentType.Key, value: 'v' },
            ];

            const result = resolver.resolve([{ v: 1 }, { v: 2 }], segments, 0, null, 100);

            expect(result).toEqual([1, 2]);
        });

        it('returns default for multiIndex on null', () => {
            const segments: Segment[] = [
                { type: SegmentType.Key, value: 'z' },
                { type: SegmentType.MultiIndex, indices: [0] },
            ];

            expect(resolver.resolve({ z: null }, segments, 0, 'def', 100)).toBe('def');
        });
    });

    describe('slice edge cases', () => {
        it('returns sliced items when slice is the last segment', () => {
            const segments: Segment[] = [{ type: SegmentType.Slice, start: 0, end: 2, step: null }];

            expect(resolver.resolve(['a', 'b', 'c'], segments, 0, null, 100)).toEqual(['a', 'b']);
        });

        it('resolves further segments on sliced items', () => {
            const segments: Segment[] = [
                { type: SegmentType.Slice, start: 0, end: 2, step: null },
                { type: SegmentType.Key, value: 'n' },
            ];

            expect(
                resolver.resolve([{ n: 1 }, { n: 2 }, { n: 3 }], segments, 0, null, 100),
            ).toEqual([1, 2]);
        });

        it('returns default for slice on null', () => {
            const segments: Segment[] = [
                { type: SegmentType.Key, value: 'z' },
                { type: SegmentType.Slice, start: 0, end: 1, step: null },
            ];

            expect(resolver.resolve({ z: null }, segments, 0, 'def', 100)).toBe('def');
        });

        it('clamps negative start to 0', () => {
            const segments: Segment[] = [{ type: SegmentType.Slice, start: -100, end: 2, step: 1 }];

            expect(resolver.resolve(['a', 'b', 'c'], segments, 0, null, 100)).toEqual(['a', 'b']);
        });

        it('clamps end larger than len to len', () => {
            const segments: Segment[] = [{ type: SegmentType.Slice, start: 0, end: 100, step: 1 }];

            expect(resolver.resolve(['a', 'b'], segments, 0, null, 100)).toEqual(['a', 'b']);
        });

        it('clamps start larger than len to len (empty result)', () => {
            const segments: Segment[] = [
                { type: SegmentType.Slice, start: 100, end: 200, step: 1 },
            ];

            expect(resolver.resolve(['a', 'b'], segments, 0, null, 100)).toEqual([]);
        });

        it('negative end converts correctly', () => {
            const segments: Segment[] = [{ type: SegmentType.Slice, start: 0, end: -1, step: 1 }];

            expect(resolver.resolve(['a', 'b', 'c'], segments, 0, null, 100)).toEqual(['a', 'b']);
        });

        it('uses correct default start for positive step (0)', () => {
            const segments: Segment[] = [{ type: SegmentType.Slice, start: null, end: 2, step: 1 }];

            expect(resolver.resolve(['a', 'b', 'c'], segments, 0, null, 100)).toEqual(['a', 'b']);
        });

        it('uses correct default start for negative step (len-1)', () => {
            const segments: Segment[] = [
                { type: SegmentType.Slice, start: null, end: null, step: -1 },
            ];

            expect(resolver.resolve(['a', 'b', 'c'], segments, 0, null, 100)).toEqual([
                'c',
                'b',
                'a',
            ]);
        });

        it('uses correct default end for positive step (len)', () => {
            const segments: Segment[] = [{ type: SegmentType.Slice, start: 0, end: null, step: 1 }];

            expect(resolver.resolve(['a', 'b'], segments, 0, null, 100)).toEqual(['a', 'b']);
        });

        it('uses correct default end for negative step (-len-1)', () => {
            const segments: Segment[] = [
                { type: SegmentType.Slice, start: null, end: null, step: -2 },
            ];
            const result = resolver.resolve(['a', 'b', 'c', 'd'], segments, 0, null, 100);

            expect(result).toEqual(['d', 'b']);
        });

        it('zero end stays zero for positive step (not mutated to <=0)', () => {
            const segments: Segment[] = [{ type: SegmentType.Slice, start: 0, end: 0, step: 1 }];

            expect(resolver.resolve(['a', 'b'], segments, 0, null, 100)).toEqual([]);
        });

        it('step of exactly 0 is rejected by parser', () => {
            expect(() => segmentParser.parseSegments('[0:5:0]')).toThrow();
        });
    });

    describe('projection edge cases', () => {
        it('returns projected array when projection is last segment', () => {
            const segments: Segment[] = [
                { type: SegmentType.Projection, fields: [{ alias: 'x', source: 'a' }] },
            ];

            const result = resolver.resolve([{ a: 1 }, { a: 2 }], segments, 0, null, 100);

            expect(result).toEqual([{ x: 1 }, { x: 2 }]);
        });

        it('resolves further segments after array projection', () => {
            const segments: Segment[] = [
                { type: SegmentType.Projection, fields: [{ alias: 'x', source: 'a' }] },
                { type: SegmentType.Key, value: 'x' },
            ];

            const result = resolver.resolve([{ a: 1 }, { a: 2 }], segments, 0, null, 100);

            expect(result).toEqual([1, 2]);
        });

        it('returns projected object when projection on single object is last', () => {
            const segments: Segment[] = [
                { type: SegmentType.Projection, fields: [{ alias: 'x', source: 'a' }] },
            ];

            const result = resolver.resolve({ a: 1 }, segments, 0, null, 100);

            expect(result).toEqual({ x: 1 });
        });

        it('resolves further segments after single object projection', () => {
            const segments: Segment[] = [
                { type: SegmentType.Projection, fields: [{ alias: 'x', source: 'a' }] },
                { type: SegmentType.Key, value: 'x' },
            ];

            const result = resolver.resolve({ a: 1 }, segments, 0, null, 100);

            expect(result).toBe(1);
        });

        it('returns default for projection on a primitive', () => {
            const segments: Segment[] = [
                { type: SegmentType.Projection, fields: [{ alias: 'x', source: 'a' }] },
            ];

            expect(resolver.resolve('text' as unknown, segments, 0, 'def', 100)).toBe('def');
        });

        it('sets null for non-object items in projected array', () => {
            const segments: Segment[] = [
                { type: SegmentType.Projection, fields: [{ alias: 'x', source: 'a' }] },
            ];

            const result = resolver.resolve([null, 42, 'text'], segments, 0, null, 100);

            expect(result).toEqual([{ x: null }, { x: null }, { x: null }]);
        });

        it('handles projection on object with null current check', () => {
            const segments: Segment[] = [
                { type: SegmentType.Key, value: 'z' },
                { type: SegmentType.Projection, fields: [{ alias: 'x', source: 'a' }] },
            ];

            expect(resolver.resolve({ z: null }, segments, 0, 'def', 100)).toBe('def');
        });
    });

    describe('collectDescent edge cases', () => {
        it('skips null children during descent', () => {
            const data = {
                a: { name: 'found' },
                b: null,
                c: { name: 'also found' },
            };

            const result = r(data, '..name') as unknown[];

            expect(result).toContain('found');
            expect(result).toContain('also found');
            expect(result).toHaveLength(2);
        });

        it('skips primitive children during descent', () => {
            const data = {
                a: { name: 'found' },
                b: 42,
                c: 'text',
                d: true,
            };

            const result = r(data, '..name') as unknown[];

            expect(result).toEqual(['found']);
        });

        it('returns empty array when descent starts on a primitive', () => {
            const segments: Segment[] = [{ type: SegmentType.Descent, key: 'x' }];

            const result = resolver.resolve('primitive' as unknown, segments, 0, null, 100);

            expect(result).toEqual([]);
        });

        it('returns empty array when descent starts on null', () => {
            const segments: Segment[] = [{ type: SegmentType.Descent, key: 'x' }];

            const result = resolver.resolve(null, segments, 0, null, 100);

            expect(result).toEqual([]);
        });

        it('collects array values from descent into results', () => {
            const data = {
                l1: { items: [1, 2] },
                l2: { items: [3, 4] },
            };

            const result = r(data, '..items') as unknown[];

            expect(result).toHaveLength(2);
            expect(result[0]).toEqual([1, 2]);
            expect(result[1]).toEqual([3, 4]);
        });
    });

    describe('descentMulti edge cases', () => {
        it('returns default when no keys are found', () => {
            const segments: Segment[] = [
                { type: SegmentType.DescentMulti, keys: ['missing1', 'missing2'] },
            ];

            const result = resolver.resolve({ a: 1 }, segments, 0, 'def', 100);

            expect(result).toBe('def');
        });

        it('returns results array when keys are found', () => {
            const segments: Segment[] = [{ type: SegmentType.DescentMulti, keys: ['a', 'b'] }];

            const result = resolver.resolve(
                { a: 1, b: 2, nested: { a: 10 } },
                segments,
                0,
                null,
                100,
            );

            expect(result).toEqual([1, 10, 2]);
        });
    });

    describe('filter on object values', () => {
        it('applies filter to object values (not just arrays)', () => {
            const data = {
                items: { x: { score: 5 }, y: { score: 15 }, z: { score: 25 } },
            };

            const result = r(data, 'items[?score>10]') as unknown[];

            expect(result).toHaveLength(2);
        });

        it('skips non-object items during filter evaluation', () => {
            const data = { items: [{ a: 1 }, 'string', null, { a: 2 }] };

            const result = r(data, 'items[?a>0]') as unknown[];

            expect(result).toEqual([{ a: 1 }, { a: 2 }]);
        });
    });

    describe('slice - step boundary conditions', () => {
        it('differentiates step > 0 from step >= 0 (positive step)', () => {
            const segments: Segment[] = [{ type: SegmentType.Slice, start: 0, end: 3, step: 2 }];

            const result = resolver.resolve(['a', 'b', 'c', 'd'], segments, 0, null, 100);

            expect(result).toEqual(['a', 'c']);
        });

        it('negative step iterates in reverse correctly', () => {
            const segments: Segment[] = [{ type: SegmentType.Slice, start: 3, end: 0, step: -1 }];

            const result = resolver.resolve(['a', 'b', 'c', 'd'], segments, 0, null, 100);

            expect(result).toEqual(['d', 'c', 'b']);
        });

        it('negative step with default start and end covers all items in reverse', () => {
            const segments: Segment[] = [
                { type: SegmentType.Slice, start: null, end: null, step: -1 },
            ];

            const result = resolver.resolve(['a', 'b', 'c'], segments, 0, null, 100);

            expect(result).toEqual(['c', 'b', 'a']);
        });

        it('step > 0 determines default start as 0 (not len-1)', () => {
            const segments: Segment[] = [{ type: SegmentType.Slice, start: null, end: 2, step: 1 }];

            const result = resolver.resolve(['a', 'b', 'c'], segments, 0, null, 100);

            expect(result).toEqual(['a', 'b']);
        });

        it('step < 0 determines default start as len-1', () => {
            const segments: Segment[] = [
                { type: SegmentType.Slice, start: null, end: 0, step: -1 },
            ];

            const result = resolver.resolve(['a', 'b', 'c'], segments, 0, null, 100);

            expect(result).toEqual(['c', 'b']);
        });

        it('step > 0 uses < comparison (not <=) for slicing', () => {
            const segments: Segment[] = [{ type: SegmentType.Slice, start: 0, end: 2, step: 1 }];

            const result = resolver.resolve(['a', 'b', 'c'], segments, 0, null, 100);

            expect(result).toEqual(['a', 'b']);
        });

        it('step < 0 uses > comparison (not >=) for slicing', () => {
            const segments: Segment[] = [{ type: SegmentType.Slice, start: 2, end: 0, step: -1 }];

            const result = resolver.resolve(['a', 'b', 'c'], segments, 0, null, 100);

            expect(result).toEqual(['c', 'b']);
        });
    });

    describe('slice - start/end clamping boundary', () => {
        it('clamps start at len exactly (not start > len)', () => {
            const segments: Segment[] = [{ type: SegmentType.Slice, start: 2, end: 5, step: 1 }];

            const result = resolver.resolve(['a', 'b'], segments, 0, null, 100);

            expect(result).toEqual([]);
        });

        it('clamps end at len exactly (not end >= len)', () => {
            const segments: Segment[] = [{ type: SegmentType.Slice, start: 0, end: 3, step: 1 }];

            const result = resolver.resolve(['a', 'b'], segments, 0, null, 100);

            expect(result).toEqual(['a', 'b']);
        });

        it('does not clamp start at len-1 (clamps at len)', () => {
            const segments: Segment[] = [{ type: SegmentType.Slice, start: 3, end: 5, step: 1 }];

            const result = resolver.resolve(['a', 'b', 'c'], segments, 0, null, 100);

            expect(result).toEqual([]);
        });
    });

    describe('projection - null item handling', () => {
        it('sets null for missing source fields in projected object', () => {
            const segments: Segment[] = [
                { type: SegmentType.Projection, fields: [{ alias: 'x', source: 'missing' }] },
            ];

            const result = resolver.resolve({ a: 1 }, segments, 0, null, 100);

            expect(result).toEqual({ x: null });
        });
    });

    describe('collectDescent - child type checking', () => {
        it('only descends into object children, not null', () => {
            const data = {
                a: { name: 'found' },
                b: null,
            };

            const result = r(data, '..name') as unknown[];

            expect(result).toEqual(['found']);
        });

        it('skips number children during descent', () => {
            const data = {
                a: { key: 'found' },
                num: 42,
            };

            const result = r(data, '..key') as unknown[];

            expect(result).toEqual(['found']);
        });

        it('skips string children during descent', () => {
            const data = {
                a: { key: 'found' },
                str: 'text',
            };

            const result = r(data, '..key') as unknown[];

            expect(result).toEqual(['found']);
        });

        it('descends into nested objects checking both typeof and !== null', () => {
            const data = {
                a: { nested: { target: 'deep' } },
                b: null,
                c: 'text',
                d: { target: 'shallow' },
            };

            const result = r(data, '..target') as unknown[];

            expect(result).toContain('deep');
            expect(result).toContain('shallow');
            expect(result).toHaveLength(2);
        });
    });

    describe('collectDescent - continuation array spread behavior', () => {
        it('spreads array results from continuation segments into flat array', () => {
            const data = {
                a: { items: [1, 2] },
                b: { items: [3, 4] },
            };

            const result = r(data, '..items[*]') as unknown[];

            // Mutation: Array.isArray(resolved) → false  → results.push([1,2]) then results.push([3,4])
            // Result: [[1,2],[3,4]] with mutation, [1,2,3,4] without
            expect(Array.isArray(result[0])).toBe(false);
            expect(result).toHaveLength(4);
        });

        it('does not wrap continuation array results in an extra array layer', () => {
            const data = { root: { keys: ['x', 'y'] } };

            const result = r(data, '..keys[*]') as unknown[];

            // With mutation: [['x','y']] — result[0] would be an array
            expect(result).toEqual(['x', 'y']);
        });

        it('handles nested objects where continuation produces multi-element array', () => {
            const data = {
                section1: { scores: [10, 20, 30] },
                section2: { scores: [40, 50] },
            };

            const result = r(data, '..scores[0:2]') as unknown[];

            // section1 wildcard [0:2] → [10,20]; section2 [0:2] → [40,50]
            // Spread: [10,20,40,50]; with mutation: [[10,20],[40,50]]
            expect(result).toHaveLength(4);
            expect(Array.isArray(result[0])).toBe(false);
        });
    });
});
