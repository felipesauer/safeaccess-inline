<?php

declare(strict_types=1);

namespace SafeAccess\Inline\Contracts;

/**
 * Contract for caching parsed path segments.
 *
 * Avoids repeated parsing of the same dot-notation path string
 * by storing the resulting segment arrays in a fast lookup structure.
 *
 * @api
 */
interface PathCacheInterface
{
    /**
     * Retrieve cached segments for a path.
     *
     * @param string $path Dot-notation path string.
     *
     * @return array<int, array<string, mixed>>|null Cached segment array, or null on cache miss.
     */
    public function get(string $path): ?array;

    /**
     * Store parsed segments for a path.
     *
     * @param string                           $path     Dot-notation path string.
     * @param array<int, array<string, mixed>> $segments Parsed segment array.
     */
    public function set(string $path, array $segments): void;

    /**
     * Check whether a path exists in the cache.
     *
     * @param string $path Dot-notation path string.
     *
     * @return bool True if segments are cached for this path.
     */
    public function has(string $path): bool;

    /**
     * Clear all cached entries.
     *
     * @return static Same instance for fluent chaining.
     */
    public function clear(): static;
}
