import type { Segment } from '../path-query/segment-type.js';

/**
 * Contract for a path-segment cache.
 *
 * Provides O(1) lookup for previously parsed dot-notation path strings,
 * avoiding repeated segment parsing on hot paths.
 *
 * Segments are structured typed arrays with {@link SegmentType} metadata,
 * matching the PHP implementation.
 *
 * @api
 */
export interface PathCacheInterface {
    /**
     * Retrieve cached segments for a path string.
     *
     * @param path - Dot-notation path string.
     * @returns Cached segment array, or null if not cached.
     */
    get(path: string): Segment[] | null;

    /**
     * Store parsed segments for a path string.
     *
     * @param path - Dot-notation path string.
     * @param segments - Parsed segment array to cache.
     */
    set(path: string, segments: Segment[]): void;

    /**
     * Check whether a path exists in the cache.
     *
     * @param path - Dot-notation path string.
     * @returns `true` if segments are cached for this path.
     */
    has(path: string): boolean;

    /**
     * Clear all cached entries.
     *
     * @returns Same instance for fluent chaining.
     */
    clear(): this;
}
