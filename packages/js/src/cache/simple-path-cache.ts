import type { PathCacheInterface } from '../contracts/path-cache-interface.js';
import type { Segment } from '../path-query/segment-type.js';

/**
 * LRU cache for parsed dot-notation path segments.
 *
 * Stores up to {@link maxSize} entries, evicting the least-recently-used
 * entry when the capacity is reached. Recently accessed entries are
 * promoted to the end of the internal map on read.
 *
 * @internal Consumers should type-hint against {@link PathCacheInterface};
 *           this concrete class is an implementation detail subject to change.
 *
 * @see PathCacheInterface
 */
export class SimplePathCache implements PathCacheInterface {
    private readonly cache: Map<string, Segment[]> = new Map();

    /**
     * Create a cache with the given maximum capacity.
     *
     * @param maxSize - Maximum number of cached path entries.
     */
    constructor(private readonly maxSize: number = 1000) {}

    /**
     * Retrieve cached segments and promote to most-recently-used.
     *
     * @param path - Dot-notation path string.
     * @returns Cached segments, or null on miss.
     */
    get(path: string): Segment[] | null {
        if (this.cache.has(path)) {
            const value = this.cache.get(path)!;
            this.cache.delete(path);
            this.cache.set(path, value);
            return value;
        }
        return null;
    }

    /**
     * Store segments, evicting the oldest entry if capacity is reached.
     *
     * @param path - Dot-notation path string.
     * @param segments - Parsed segment array to cache.
     */
    set(path: string, segments: Segment[]): void {
        if (this.cache.size >= this.maxSize) {
            const firstKey = this.cache.keys().next().value;
            if (firstKey !== undefined) {
                this.cache.delete(firstKey);
            }
        }
        this.cache.set(path, segments);
    }

    /**
     * Check whether a path exists in the cache.
     *
     * @param path - Dot-notation path string.
     * @returns True if cached.
     */
    has(path: string): boolean {
        return this.cache.has(path);
    }

    /**
     * Clear all cached entries.
     *
     * @returns Same instance for fluent chaining.
     */
    clear(): this {
        this.cache.clear();
        return this;
    }
}
