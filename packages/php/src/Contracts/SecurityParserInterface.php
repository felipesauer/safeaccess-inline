<?php

declare(strict_types=1);

namespace SafeAccess\Inline\Contracts;

/**
 * Contract for security validation during parsing and path resolution.
 *
 * Defines methods for asserting payload size, maximum key counts,
 * and recursion depth limits to prevent resource exhaustion and
 * injection attacks during data access operations.
 *
 * @api
 */
interface SecurityParserInterface
{
    /**
     * Assert that a raw string payload does not exceed the byte limit.
     *
     * @param string   $input    Raw input string to measure.
     * @param int|null $maxBytes Override limit, or null to use configured default.
     *
     * @throws \SafeAccess\Inline\Exceptions\SecurityException When the payload exceeds the limit.
     */
    public function assertPayloadSize(string $input, ?int $maxBytes = null): void;

    /**
     * Assert that resolve depth does not exceed the configured limit.
     *
     * @param int $depth Current depth counter.
     *
     * @throws \SafeAccess\Inline\Exceptions\SecurityException When depth exceeds the maximum.
     */
    public function assertMaxResolveDepth(int $depth): void;

    /**
     * Assert that total key count does not exceed the limit.
     *
     * @param array<mixed> $data          Data to count keys in.
     * @param int|null     $maxKeys       Override limit, or null to use configured default.
     * @param int|null     $maxCountDepth Override recursion depth limit, or null for default.
     *
     * @throws \SafeAccess\Inline\Exceptions\SecurityException When key count exceeds the limit.
     */
    public function assertMaxKeys(array $data, ?int $maxKeys = null, ?int $maxCountDepth = null): void;

    /**
     * Assert that current recursion depth does not exceed the limit.
     *
     * @param int      $currentDepth Current depth counter.
     * @param int|null $maxDepth     Override limit, or null to use configured default.
     *
     * @throws \SafeAccess\Inline\Exceptions\SecurityException When the depth exceeds the limit.
     */
    public function assertMaxDepth(int $currentDepth, ?int $maxDepth = null): void;

    /**
     * Assert that structural nesting depth does not exceed the policy limit.
     *
     * @param mixed $data     Data to measure structural depth of.
     * @param int   $maxDepth Maximum allowed structural depth.
     *
     * @throws \SafeAccess\Inline\Exceptions\SecurityException When structural depth exceeds the limit.
     */
    public function assertMaxStructuralDepth(mixed $data, int $maxDepth): void;

    /**
     * Return the configured maximum structural nesting depth.
     *
     * @return int Maximum allowed depth.
     */
    public function getMaxDepth(): int;

    /**
     * Return the configured maximum path-resolve recursion depth.
     *
     * @return int Maximum allowed resolve depth.
     */
    public function getMaxResolveDepth(): int;

    /**
     * Return the configured maximum total key count.
     *
     * @return int Maximum allowed key count.
     */
    public function getMaxKeys(): int;
}
