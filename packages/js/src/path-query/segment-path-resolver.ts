import type { FilterEvaluatorInterface } from '../contracts/filter-evaluator-interface.js';
import { SecurityException } from '../exceptions/security-exception.js';
import { SegmentType } from './segment-type.js';
import type { Segment, FilterExpression, ProjectionField } from './segment-type.js';

/**
 * Resolve typed path segments against nested data structures.
 *
 * Traverses data using segment arrays produced by {@link SegmentParser},
 * dispatching to segment-type-specific handlers for key, wildcard,
 * descent, filter, slice, multi-key/index, and projection operations.
 *
 * @internal
 *
 * @see SegmentParser           Produces the segment arrays this resolver consumes.
 * @see SegmentType             Enum governing which handler is dispatched.
 * @see FilterEvaluatorInterface  Delegate for filter predicate evaluation.
 * @see DotNotationParser       Invokes this resolver for path queries.
 */
export class SegmentPathResolver {
    /**
     * Create a resolver with a filter evaluator.
     *
     * @param segmentFilterParser - Delegate for filter evaluation.
     */
    constructor(private readonly segmentFilterParser: FilterEvaluatorInterface) {}

    /**
     * Resolve a value by walking segments starting at the given index.
     *
     * @param current - Current data node.
     * @param segments - Typed segment array from {@link SegmentParser}.
     * @param index - Current segment index.
     * @param defaultValue - Fallback value when resolution fails.
     * @param maxDepth - Maximum recursion depth.
     * @returns Resolved value or the default.
     *
     * @throws {SecurityException} When recursion depth exceeds the limit.
     */
    resolve(
        current: unknown,
        segments: ReadonlyArray<Segment>,
        index: number,
        defaultValue: unknown,
        maxDepth: number,
    ): unknown {
        if (index > maxDepth) {
            throw new SecurityException(`Recursion depth ${index} exceeds maximum of ${maxDepth}.`);
        }

        if (index >= segments.length) {
            return current;
        }

        const segment = segments[index];

        switch (segment.type) {
            case SegmentType.Descent:
                return this.segmentDescent(current, segments, index, defaultValue, maxDepth);
            case SegmentType.DescentMulti:
                return this.segmentDescentMulti(current, segments, index, defaultValue, maxDepth);
            case SegmentType.Wildcard:
                return this.segmentWildcard(current, segments, index, defaultValue, maxDepth);
            case SegmentType.Filter:
                return this.segmentFilter(current, segments, index, defaultValue, maxDepth);
            case SegmentType.MultiKey:
                return this.segmentMultiKey(current, segments, index, defaultValue, maxDepth);
            case SegmentType.MultiIndex:
                return this.segmentMultiIndex(current, segments, index, defaultValue, maxDepth);
            case SegmentType.Slice:
                return this.segmentSlice(current, segments, index, defaultValue, maxDepth);
            case SegmentType.Projection:
                return this.segmentProjection(current, segments, index, defaultValue, maxDepth);
            default:
                return this.segmentAny(current, segments, index, defaultValue, maxDepth);
        }
    }

    /**
     * Resolve a simple key/index segment.
     *
     * @param current      - Current data node.
     * @param segments     - Typed segment array.
     * @param index        - Current segment index.
     * @param defaultValue - Fallback value when resolution fails.
     * @param maxDepth     - Maximum recursion depth.
     * @returns Resolved value or the default.
     */
    private segmentAny(
        current: unknown,
        segments: ReadonlyArray<Segment>,
        index: number,
        defaultValue: unknown,
        maxDepth: number,
    ): unknown {
        const segment = segments[index];
        const keyValue = 'value' in segment ? (segment as { value: string }).value : '';

        if (
            typeof current === 'object' &&
            current !== null &&
            Object.prototype.hasOwnProperty.call(current, keyValue)
        ) {
            return this.resolve(
                (current as Record<string, unknown>)[keyValue],
                segments,
                index + 1,
                defaultValue,
                maxDepth,
            );
        }

        return defaultValue;
    }

    /**
     * Resolve a recursive descent segment for a single key.
     *
     * @param current      - Current data node.
     * @param segments     - Typed segment array.
     * @param index        - Current segment index.
     * @param defaultValue - Fallback value when resolution fails.
     * @param maxDepth     - Maximum recursion depth.
     * @returns Array of all values matching the descent key.
     */
    private segmentDescent(
        current: unknown,
        segments: ReadonlyArray<Segment>,
        index: number,
        defaultValue: unknown,
        maxDepth: number,
    ): unknown[] {
        const results: unknown[] = [];
        const segment = segments[index] as { type: SegmentType.Descent; key: string };
        const descentKey = segment.key;
        this.collectDescent(
            current,
            descentKey,
            segments,
            index + 1,
            defaultValue,
            results,
            maxDepth,
        );
        return results;
    }

    /**
     * Resolve a recursive descent segment for multiple keys.
     *
     * @param current      - Current data node.
     * @param segments     - Typed segment array.
     * @param index        - Current segment index.
     * @param defaultValue - Fallback value when resolution fails.
     * @param maxDepth     - Maximum recursion depth.
     * @returns Array of all values matching any of the descent keys.
     */
    private segmentDescentMulti(
        current: unknown,
        segments: ReadonlyArray<Segment>,
        index: number,
        defaultValue: unknown,
        maxDepth: number,
    ): unknown {
        const segment = segments[index] as {
            type: SegmentType.DescentMulti;
            keys: ReadonlyArray<string>;
        };
        const descentKeys = segment.keys;
        const results: unknown[] = [];

        for (const dk of descentKeys) {
            this.collectDescent(current, dk, segments, index + 1, defaultValue, results, maxDepth);
        }

        return results.length > 0 ? results : defaultValue;
    }

    /**
     * Resolve a wildcard segment, expanding all children.
     *
     * @param current      - Current data node.
     * @param segments     - Typed segment array.
     * @param index        - Current segment index.
     * @param defaultValue - Fallback value when resolution fails.
     * @param maxDepth     - Maximum recursion depth.
     * @returns Array of resolved values for all children.
     */
    private segmentWildcard(
        current: unknown,
        segments: ReadonlyArray<Segment>,
        index: number,
        defaultValue: unknown,
        maxDepth: number,
    ): unknown {
        if (typeof current !== 'object' || current === null) {
            return defaultValue;
        }

        const items = Array.isArray(current)
            ? current
            : Object.values(current as Record<string, unknown>);

        const nextIndex = index + 1;

        return items.map((item) => this.resolve(item, segments, nextIndex, defaultValue, maxDepth));
    }

    /**
     * Resolve a filter segment, applying predicates to array items.
     *
     * @param current      - Current data node.
     * @param segments     - Typed segment array.
     * @param index        - Current segment index.
     * @param defaultValue - Fallback value when resolution fails.
     * @param maxDepth     - Maximum recursion depth.
     * @returns Array of items passing the filter predicate.
     */
    private segmentFilter(
        current: unknown,
        segments: ReadonlyArray<Segment>,
        index: number,
        defaultValue: unknown,
        maxDepth: number,
    ): unknown {
        if (typeof current !== 'object' || current === null) {
            return defaultValue;
        }

        const segment = segments[index] as {
            type: SegmentType.Filter;
            expression: FilterExpression;
        };
        const filterExpr = segment.expression;

        const items = Array.isArray(current)
            ? current
            : Object.values(current as Record<string, unknown>);

        const filtered: unknown[] = [];
        for (const item of items) {
            if (typeof item === 'object' && item !== null) {
                if (
                    this.segmentFilterParser.evaluate(item as Record<string, unknown>, filterExpr)
                ) {
                    filtered.push(item);
                }
            }
        }

        const nextIndex = index + 1;

        return filtered.map((item) =>
            this.resolve(item, segments, nextIndex, defaultValue, maxDepth),
        );
    }

    /**
     * Resolve a multi-key segment, selecting values by multiple keys.
     *
     * @param current      - Current data node.
     * @param segments     - Typed segment array.
     * @param index        - Current segment index.
     * @param defaultValue - Fallback value when resolution fails.
     * @param maxDepth     - Maximum recursion depth.
     * @returns Array of resolved values for each key.
     */
    private segmentMultiKey(
        current: unknown,
        segments: ReadonlyArray<Segment>,
        index: number,
        defaultValue: unknown,
        maxDepth: number,
    ): unknown {
        if (typeof current !== 'object' || current === null) {
            return defaultValue;
        }

        const nextIndex = index + 1;
        const segment = segments[index] as {
            type: SegmentType.MultiKey;
            keys: ReadonlyArray<string>;
        };
        const multiKeys = segment.keys;
        const obj = current as Record<string, unknown>;

        return multiKeys.map((k) => {
            const val = Object.prototype.hasOwnProperty.call(obj, k) ? obj[k] : defaultValue;
            return this.resolve(val, segments, nextIndex, defaultValue, maxDepth);
        });
    }

    /**
     * Resolve a multi-index segment, selecting values by multiple indices.
     *
     * @param current      - Current data node.
     * @param segments     - Typed segment array.
     * @param index        - Current segment index.
     * @param defaultValue - Fallback value when resolution fails.
     * @param maxDepth     - Maximum recursion depth.
     * @returns Array of resolved values for each index.
     */
    private segmentMultiIndex(
        current: unknown,
        segments: ReadonlyArray<Segment>,
        index: number,
        defaultValue: unknown,
        maxDepth: number,
    ): unknown {
        if (typeof current !== 'object' || current === null) {
            return defaultValue;
        }

        const nextIndex = index + 1;
        const segment = segments[index] as {
            type: SegmentType.MultiIndex;
            indices: ReadonlyArray<number>;
        };
        const indices = segment.indices;
        const items = Array.isArray(current)
            ? current
            : Object.values(current as Record<string, unknown>);
        const len = items.length;

        return indices.map((idx) => {
            const resolved = idx < 0 ? (items[len + idx] ?? null) : (items[idx] ?? null);
            if (resolved === null) {
                return defaultValue;
            }
            return this.resolve(resolved, segments, nextIndex, defaultValue, maxDepth);
        });
    }

    /**
     * Resolve a slice segment on an array (start:end:step).
     *
     * @param current      - Current data node.
     * @param segments     - Typed segment array.
     * @param index        - Current segment index.
     * @param defaultValue - Fallback value when resolution fails.
     * @param maxDepth     - Maximum recursion depth.
     * @returns Array of resolved values matching the slice range.
     */
    private segmentSlice(
        current: unknown,
        segments: ReadonlyArray<Segment>,
        index: number,
        defaultValue: unknown,
        maxDepth: number,
    ): unknown {
        if (typeof current !== 'object' || current === null) {
            return defaultValue;
        }

        const items = Array.isArray(current)
            ? current
            : Object.values(current as Record<string, unknown>);
        const len = items.length;
        const segment = segments[index] as {
            type: SegmentType.Slice;
            start: number | null;
            end: number | null;
            step: number | null;
        };
        const step = segment.step ?? 1;
        let start = segment.start ?? (step > 0 ? 0 : len - 1);
        let end = segment.end ?? (step > 0 ? len : -len - 1);

        if (start < 0) {
            start = Math.max(len + start, 0);
        }

        if (end < 0) {
            end = len + end;
        }

        if (start >= len) {
            start = len;
        }

        if (end > len) {
            end = len;
        }

        const sliced: unknown[] = [];
        if (step > 0) {
            for (let si = start; si < end; si += step) {
                sliced.push(items[si]);
            }
        } else {
            for (let si = start; si > end; si += step) {
                sliced.push(items[si]);
            }
        }

        const nextSliceIndex = index + 1;

        return sliced.map((item) =>
            this.resolve(item, segments, nextSliceIndex, defaultValue, maxDepth),
        );
    }

    /**
     * Resolve a projection segment, selecting specific fields from items.
     *
     * @param current      - Current data node.
     * @param segments     - Typed segment array.
     * @param index        - Current segment index.
     * @param defaultValue - Fallback value when resolution fails.
     * @param maxDepth     - Maximum recursion depth.
     * @returns Projected item(s) with only the specified fields.
     */
    private segmentProjection(
        current: unknown,
        segments: ReadonlyArray<Segment>,
        index: number,
        defaultValue: unknown,
        maxDepth: number,
    ): unknown {
        const segment = segments[index] as {
            type: SegmentType.Projection;
            fields: ReadonlyArray<ProjectionField>;
        };
        const fields = segment.fields;

        const projectItem = (item: unknown): Record<string, unknown> => {
            if (typeof item !== 'object' || item === null) {
                const result: Record<string, unknown> = {};
                for (const field of fields) {
                    result[field.alias] = null;
                }
                return result;
            }

            const obj = item as Record<string, unknown>;
            const result: Record<string, unknown> = {};
            for (const field of fields) {
                result[field.alias] = Object.prototype.hasOwnProperty.call(obj, field.source)
                    ? obj[field.source]
                    : null;
            }
            return result;
        };

        const nextProjectionIndex = index + 1;

        if (Array.isArray(current)) {
            const projected = current.map(projectItem);
            return projected.map((item) =>
                this.resolve(item, segments, nextProjectionIndex, defaultValue, maxDepth),
            );
        }

        if (typeof current === 'object' && current !== null) {
            const result = projectItem(current);
            return this.resolve(result, segments, nextProjectionIndex, defaultValue, maxDepth);
        }

        return defaultValue;
    }

    /**
     * Recursively collect values matching a descent key from nested data.
     *
     * @param current - Current data node.
     * @param key - Key to search for recursively.
     * @param segments - Typed segment array.
     * @param nextIndex - Next segment index after the descent.
     * @param defaultValue - Fallback value.
     * @param results - Collector array (mutated in place).
     * @param maxDepth - Maximum recursion depth.
     */
    private collectDescent(
        current: unknown,
        key: string,
        segments: ReadonlyArray<Segment>,
        nextIndex: number,
        defaultValue: unknown,
        results: unknown[],
        maxDepth: number,
    ): void {
        if (typeof current !== 'object' || current === null) {
            return;
        }

        const obj = current as Record<string, unknown>;

        if (Object.prototype.hasOwnProperty.call(obj, key)) {
            if (nextIndex >= segments.length) {
                results.push(obj[key]);
            } else {
                const resolved = this.resolve(
                    obj[key],
                    segments,
                    nextIndex,
                    defaultValue,
                    maxDepth,
                );
                if (Array.isArray(resolved)) {
                    results.push(...resolved);
                } else {
                    results.push(resolved);
                }
            }
        }

        for (const child of Object.values(obj)) {
            if (typeof child === 'object' && child !== null) {
                this.collectDescent(
                    child,
                    key,
                    segments,
                    nextIndex,
                    defaultValue,
                    results,
                    maxDepth,
                );
            }
        }
    }
}
