<?php

declare(strict_types=1);

namespace SafeAccess\Inline\Core;

use SafeAccess\Inline\Contracts\PathCacheInterface;
use SafeAccess\Inline\Contracts\SecurityGuardInterface;
use SafeAccess\Inline\Contracts\SecurityParserInterface;
use SafeAccess\Inline\Contracts\ValidatableParserInterface;
use SafeAccess\Inline\Exceptions\PathNotFoundException;
use SafeAccess\Inline\PathQuery\SegmentParser;
use SafeAccess\Inline\PathQuery\SegmentPathResolver;

/**
 * Core dot-notation parser for reading, writing, and removing nested values.
 *
 * Implement {@see ValidatableParserInterface} to provide path-based access
 * to associative arrays using dot-separated keys with support for wildcard,
 * recursive-descent, and filter segments.
 *
 * @internal
 */
final class DotNotationParser implements ValidatableParserInterface
{
    /**
     * Initialize the parser with all required collaborators.
     *
     * @param SecurityGuardInterface    $securityGuard       Key-safety and structural guards.
     * @param SecurityParserInterface   $securityParser      Parser depth and cache limits.
     * @param PathCacheInterface        $pathCache           Parsed-segment cache.
     * @param SegmentParser             $segmentParser       Path-string → segment converter.
     * @param SegmentPathResolver       $segmentPathResolver Segment → value resolver.
     */
    public function __construct(
        private readonly SecurityGuardInterface $securityGuard,
        private readonly SecurityParserInterface $securityParser,
        private readonly PathCacheInterface $pathCache,
        private readonly SegmentParser $segmentParser,
        private readonly SegmentPathResolver $segmentPathResolver,
    ) {
    }

    /**
     * Resolve a pre-parsed segment array against data, returning the matched value.
     *
     * @param array<array-key, mixed>            $data     Source data array.
     * @param array<int, array<string, mixed>>   $segments Typed segments from {@see SegmentParser}.
     * @param mixed                              $default  Fallback value.
     *
     * @return mixed Resolved value or the default.
     */
    public function resolve(array $data, array $segments, mixed $default = null): mixed
    {
        return $this->segmentPathResolver->resolve(
            $data,
            $segments,
            0,
            $default,
            $this->securityParser->getMaxResolveDepth()
        );
    }

    /** {@inheritDoc} */
    public function has(array $data, string $path): bool
    {
        $sentinel = new \stdClass();
        return $this->get($data, $path, $sentinel) !== $sentinel;
    }

    /** {@inheritDoc} */
    public function get(array $data, string $path, mixed $default = null): mixed
    {
        if ($path === '') {
            return $default;
        }

        $segments = $this->segmentPathCache($path);
        return $this->resolve($data, $segments, $default);
    }

    /**
     * Retrieve a value at the given path, throwing when not found.
     *
     * @param array<array-key, mixed> $data Source data array.
     * @param string                  $path Dot-notation path.
     *
     * @return mixed Resolved value.
     *
     * @throws \SafeAccess\Inline\Exceptions\PathNotFoundException When the path does not exist.
     */
    public function getStrict(array $data, string $path): mixed
    {
        $sentinel = new \stdClass();
        $result = $this->get($data, $path, $sentinel);

        if ($result === $sentinel) {
            throw new PathNotFoundException("Path '{$path}' not found.");
        }

        return $result;
    }

    /** {@inheritDoc} */
    public function set(array $data, string $path, mixed $value): array
    {
        $keys = $this->segmentParser->parseKeys($path);
        return $this->writeAt($data, $keys, 0, $value);
    }

    /** {@inheritDoc} */
    public function remove(array $data, string $path): array
    {
        $keys = $this->segmentParser->parseKeys($path);

        return $this->eraseAt($data, $keys, 0);
    }

    /** {@inheritDoc} */
    public function merge(array $data, string $path, array $value): array
    {
        $existing = $path !== '' ? $this->get($data, $path, []) : $data;
        $merged = $this->deepMerge(
            is_array($existing) ? $existing : [],
            $value
        );

        return $path !== '' ? $this->set($data, $path, $merged) : $merged;
    }

    /** {@inheritDoc} */
    public function getAt(array $data, array $segments, mixed $default = null): mixed
    {
        $current = $data;
        foreach ($segments as $key) {
            if (!is_array($current) || !array_key_exists($key, $current)) {
                return $default;
            }
            $current = $current[$key];
        }

        return $current;
    }

    /** {@inheritDoc} */
    public function setAt(array $data, array $segments, mixed $value): array
    {
        if (count($segments) === 0) {
            return $data;
        }

        return $this->writeAt($data, $segments, 0, $value);
    }

    /** {@inheritDoc} */
    public function removeAt(array $data, array $segments): array
    {
        if (count($segments) === 0) {
            return $data;
        }

        return $this->eraseAt($data, $segments, 0);
    }

    /** {@inheritDoc} */
    public function validate(array $data): void
    {
        $this->securityParser->assertMaxKeys($data);
        $this->securityParser->assertMaxStructuralDepth($data, $this->securityParser->getMaxDepth());
        $this->securityGuard->assertSafeKeys($data);
    }

    /** {@inheritDoc} */
    public function assertPayload(string $input): void
    {
        $this->securityParser->assertPayloadSize($input);
    }

    /** {@inheritDoc} */
    public function getMaxDepth(): int
    {
        return $this->securityParser->getMaxDepth();
    }

    /**
     * Retrieve parsed segments from cache or parse and cache the path.
     *
     * @param string $path Dot-notation path string.
     *
     * @return array<int, array<string, mixed>> Cached or freshly parsed segments.
     */
    private function segmentPathCache(string $path): array
    {
        $cached = $this->pathCache->get($path);
        if ($cached !== null) {
            return $cached;
        }

        $segments = $this->segmentParser->parseSegments($path);
        $this->pathCache->set($path, $segments);

        return $segments;
    }

    /**
     * Recursively write a value at the given key path.
     *
     * @param array<array-key, mixed>      $data  Current level data.
     * @param array<array-key, int|string> $keys  Flat key segments.
     * @param int                          $idx   Current depth index.
     * @param mixed                        $value Value to write.
     *
     * @return array<array-key, mixed> Modified copy of the data.
     *
     * @throws \SafeAccess\Inline\Exceptions\SecurityException When a key violates security rules.
     */
    private function writeAt(array $data, array $keys, int $idx, mixed $value): array
    {
        $result = $data;
        $key = (string) $keys[$idx];
        $this->securityGuard->assertSafeKey($key);

        if ($idx === count($keys) - 1) {
            $result[$key] = $value;
        } else {
            $nested = isset($result[$key]) && is_array($result[$key]) ? $result[$key] : [];
            $result[$key] = $this->writeAt($nested, $keys, $idx + 1, $value);
        }

        return $result;
    }

    /**
     * Recursively remove a key at the given key path.
     *
     * @param array<array-key, mixed>      $data Current level data.
     * @param array<array-key, int|string> $keys Flat key segments.
     * @param int                          $idx  Current depth index.
     *
     * @return array<array-key, mixed> Modified copy of the data.
     *
     * @throws \SafeAccess\Inline\Exceptions\SecurityException When a key violates security rules.
     */
    private function eraseAt(array $data, array $keys, int $idx): array
    {
        $result = $data;
        $key = (string) $keys[$idx];
        $this->securityGuard->assertSafeKey($key);

        if ($idx === count($keys) - 1) {
            unset($result[$key]);
        } elseif (isset($result[$key]) && is_array($result[$key])) {
            $result[$key] = $this->eraseAt($result[$key], $keys, $idx + 1);
        }

        return $result;
    }

    /**
     * Recursively merge two associative arrays preserving nested structure.
     *
     * @param array<array-key, mixed> $target Base array.
     * @param array<array-key, mixed> $source Array to merge on top.
     * @param int                     $depth  Current recursion depth.
     *
     * @return array<array-key, mixed> Merged result.
     *
     * @throws \SafeAccess\Inline\Exceptions\SecurityException When max resolve depth is exceeded.
     */
    private function deepMerge(array $target, array $source, int $depth = 0): array
    {
        $this->securityParser->assertMaxResolveDepth($depth);

        $result = $target;

        foreach ($source as $key => $srcVal) {
            if (is_string($key)) {
                $this->securityGuard->assertSafeKey($key);
            }

            if (
                is_array($srcVal)
                && !array_is_list($srcVal)
                && isset($result[$key])
                && is_array($result[$key])
                && !array_is_list($result[$key])
            ) {
                $result[$key] = $this->deepMerge($result[$key], $srcVal, $depth + 1);
            } else {
                $result[$key] = $srcVal;
            }
        }

        return $result;
    }
}
