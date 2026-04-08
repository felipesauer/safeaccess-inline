<?php

declare(strict_types=1);

namespace SafeAccess\Inline\Security;

use SafeAccess\Inline\Contracts\SecurityParserInterface;
use SafeAccess\Inline\Exceptions\SecurityException;

/**
 * Enforce structural security constraints on parsed data.
 *
 * Validates payload size, maximum key count, recursion depth, and
 * structural depth limits.
 *
 * @api
 *
 * @see \SafeAccess\Inline\Core\DotNotationParser      Delegates validation to this class.
 *
 * @example
 * $parser = new SecurityParser(maxDepth: 10, maxKeys: 100);
 * $parser->assertPayloadSize('{"key":"value"}');
 */
final class SecurityParser implements SecurityParserInterface
{
    /**
     * Build security options from a configuration DTO.
     *
     * @param int $maxDepth               Maximum allowed structural nesting depth.
     * @param int $maxPayloadBytes        Maximum allowed raw payload size in bytes.
     * @param int $maxKeys                Maximum total number of keys allowed across the entire structure.
     * @param int $maxCountRecursiveDepth Maximum recursion depth when counting keys.
     * @param int $maxResolveDepth        Maximum recursion depth for path resolution and deep merge.
     */
    public function __construct(
        public readonly int $maxDepth = 512,
        public readonly int $maxPayloadBytes = 10 * 1024 * 1024,
        public readonly int $maxKeys = 10_000,
        public readonly int $maxCountRecursiveDepth = 100,
        public readonly int $maxResolveDepth = 100,
    ) {
    }

    /**
     * Assert that a raw string payload does not exceed the byte limit.
     *
     * @param string   $input    Raw input string to measure.
     * @param int|null $maxBytes Override limit, or null to use configured default.
     *
     * @throws \SafeAccess\Inline\Exceptions\SecurityException When the payload exceeds the limit.
     */
    public function assertPayloadSize(string $input, ?int $maxBytes = null): void
    {
        $limit = $maxBytes ?? $this->maxPayloadBytes;
        $size = mb_strlen($input, '8bit');

        if ($size > $limit) {
            throw new SecurityException(
                "Payload size {$size} bytes exceeds maximum of {$limit} bytes."
            );
        }
    }

    /**
     * Assert that resolve depth does not exceed the configured limit.
     *
     * @param int $depth Current depth counter.
     *
     * @throws \SafeAccess\Inline\Exceptions\SecurityException When depth exceeds the maximum.
     */
    public function assertMaxResolveDepth(int $depth): void
    {
        if ($depth > $this->maxResolveDepth) {
            throw new SecurityException('Deep merge exceeded maximum depth of ' . $this->maxResolveDepth);
        }
    }

    /**
     * Assert that total key count does not exceed the limit.
     *
     * @param array<mixed> $data          Data to count keys in.
     * @param int|null     $maxKeys       Override limit, or null to use configured default.
     * @param int|null     $maxCountDepth Override recursion depth limit, or null for default.
     *
     * @throws \SafeAccess\Inline\Exceptions\SecurityException When key count exceeds the limit.
     */
    public function assertMaxKeys(array $data, ?int $maxKeys = null, ?int $maxCountDepth = null): void
    {
        $limit = $maxKeys ?? $this->maxKeys;
        $count = $this->countKeys($data, 0, $maxCountDepth ?? $this->maxCountRecursiveDepth);

        if ($count > $limit) {
            throw new SecurityException(
                "Data contains {$count} keys, exceeding maximum of {$limit}."
            );
        }
    }

    /**
     * Assert that current recursion depth does not exceed the limit.
     *
     * @param int      $currentDepth Current depth counter.
     * @param int|null $maxDepth     Override limit, or null to use configured default.
     *
     * @throws \SafeAccess\Inline\Exceptions\SecurityException When the depth exceeds the limit.
     */
    public function assertMaxDepth(int $currentDepth, ?int $maxDepth = null): void
    {
        $limit = $maxDepth ?? $this->maxDepth;
        if ($currentDepth > $limit) {
            throw new SecurityException(
                "Recursion depth {$currentDepth} exceeds maximum of {$limit}."
            );
        }
    }

    /**
     * Return the configured maximum structural nesting depth.
     *
     * @return int Maximum allowed depth.
     */
    public function getMaxDepth(): int
    {
        return $this->maxDepth;
    }

    /**
     * Return the configured maximum path-resolve recursion depth.
     *
     * @return int Maximum allowed resolve depth.
     */
    public function getMaxResolveDepth(): int
    {
        return $this->maxResolveDepth;
    }

    /**
     * Return the configured maximum total key count.
     *
     * @return int Maximum allowed key count.
     */
    public function getMaxKeys(): int
    {
        return $this->maxKeys;
    }

    /**
     * Assert that structural nesting depth does not exceed the policy limit.
     *
     * @param mixed $data     Data to measure structural depth of.
     * @param int   $maxDepth Maximum allowed structural depth.
     *
     * @throws \SafeAccess\Inline\Exceptions\SecurityException When structural depth exceeds the limit.
     */
    public function assertMaxStructuralDepth(mixed $data, int $maxDepth): void
    {
        $depth = $this->measureDepth($data, 0, $maxDepth + 1);
        if ($depth > $maxDepth) {
            throw new SecurityException(
                "Data structural depth {$depth} exceeds policy maximum of {$maxDepth}."
            );
        }
    }

    /**
     * Count total keys recursively up to a maximum depth.
     *
     * @param mixed    $obj      Data to count.
     * @param int      $depth    Current recursion depth.
     * @param int|null $maxDepth Maximum recursion depth for counting.
     *
     * @return int Total key count.
     */
    private function countKeys(mixed $obj, int $depth = 0, ?int $maxDepth = null): int
    {
        $maxDepth = $maxDepth ?? $this->maxCountRecursiveDepth;

        if ($depth > $maxDepth) {
            return 0;
        }

        if (!is_array($obj)) {
            return 0;
        }

        $count = count($obj);
        foreach ($obj as $value) {
            $count += $this->countKeys($value, $depth + 1, $maxDepth);
        }

        return $count;
    }

    /**
     * Measure the maximum structural nesting depth of a value.
     *
     * @param mixed    $value    Value to measure.
     * @param int      $current  Current depth counter.
     * @param int|null $maxDepth Early-exit ceiling.
     *
     * @return int Maximum depth reached.
     */
    private function measureDepth(mixed $value, int $current, ?int $maxDepth = null): int
    {
        $maxDepth = $maxDepth ?? $this->maxDepth;

        if ($current >= $maxDepth || !is_array($value)) {
            return $current;
        }

        $max = $current;
        foreach ($value as $child) {
            $d = $this->measureDepth($child, $current + 1, $maxDepth);

            if ($d > $max) {
                $max = $d;
            }
        }

        return $max;
    }
}
