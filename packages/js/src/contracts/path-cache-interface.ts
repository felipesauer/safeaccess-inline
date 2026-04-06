/**
 * Contract for a path-segment cache.
 *
 * Provides O(1) lookup for previously parsed dot-notation path strings,
 * avoiding repeated segment parsing on hot paths.
 *
 * Note: JS segments are flat `string[]` (from `path.split('.')`), whereas
 * PHP segments are structured `array<int, array<string, mixed>>` containing
 * SegmentType metadata. This architectural difference reflects each
 * language's parser implementation.
 */
export interface PathCacheInterface {
    /**
     * Retrieve cached segments for a path string.
     *
     * @param path - Dot-notation path string.
     * @returns Cached segment array, or null if not cached.
     */
    get(path: string): string[] | null;

    /**
     * Store parsed segments for a path string.
     *
     * @param path - Dot-notation path string.
     * @param segments - Parsed segment array to cache.
     */
    set(path: string, segments: string[]): void;

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
