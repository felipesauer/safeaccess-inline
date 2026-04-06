<?php

declare(strict_types=1);

namespace SafeAccess\Inline\Cache;

use SafeAccess\Inline\Contracts\PathCacheInterface;

/**
 * LRU cache for parsed dot-notation path segments.
 *
 * Stores up to {@see $maxSize} entries, evicting the least-recently-used
 * entry when the capacity is reached. Recently accessed entries are
 * promoted to the end of the internal array on read.
 *
 * @internal Consumers should type-hint against {@see PathCacheInterface};
 *           this concrete class is an implementation detail subject to change.
 *
 * @see PathCacheInterface
 */
final class SimplePathCache implements PathCacheInterface
{
    /** @var array<string, array<int, array<string, mixed>>> Internal LRU cache storage. */
    private array $cache = [];

    /**
     * Create a cache with the given maximum capacity.
     *
     * @param int $maxSize Maximum number of cached path entries.
     */
    public function __construct(
        private readonly int $maxSize = 1000,
    ) {
    }

    /**
     * Retrieve cached segments and promote to most-recently-used.
     *
     * @param string $path Dot-notation path string.
     *
     * @return array<int, array<string, mixed>>|null Cached segments, or null on miss.
     */
    public function get(string $path): ?array
    {
        if ($this->has($path)) {
            $value = $this->cache[$path];

            unset($this->cache[$path]);

            $this->cache[$path] = $value;

            return $value;
        }

        return null;
    }

    /**
     * Store segments, evicting the oldest entry if capacity is reached.
     *
     * @param string                           $path     Dot-notation path string.
     * @param array<int, array<string, mixed>> $segments Parsed segment array to cache.
     */
    public function set(string $path, array $segments): void
    {
        if (count($this->cache) >= $this->maxSize) {

            reset($this->cache);

            $firstKey = key($this->cache);

            if ($firstKey !== null) {
                unset($this->cache[$firstKey]);
            }
        }

        $this->cache[$path] = $segments;
    }

    /**
     * Check whether a path exists in the cache.
     *
     * @param string $path Dot-notation path string.
     *
     * @return bool True if cached.
     */
    public function has(string $path): bool
    {
        return isset($this->cache[$path]);
    }

    /**
     * Clear all cached entries.
     *
     * @return static Same instance for fluent chaining.
     */
    public function clear(): static
    {
        $this->cache = [];
        return $this;
    }
}
