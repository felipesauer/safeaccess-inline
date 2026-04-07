<?php

declare(strict_types=1);

namespace SafeAccess\Inline\Contracts;

/**
 * Contract for read-only data access operations.
 *
 * Defines methods for retrieving, checking existence, counting,
 * and inspecting keys within the accessor's internal data store.
 *
 * @api
 *
 * @see AbstractAccessor    Base implementation.
 * @see AccessorsInterface  Composite interface extending this contract.
 */
interface ReadableAccessorsInterface
{
    /**
     * Retrieve the original raw input data before parsing.
     *
     * @return mixed Original input passed to {@see FactoryAccessorsInterface::from()}.
     */
    public function getRaw(): mixed;

    /**
     * Retrieve a value at a dot-notation path.
     *
     * @param string $path    Dot-notation path (e.g. "user.name").
     * @param mixed  $default Fallback when the path does not exist.
     *
     * @return mixed Resolved value or the default.
     */
    public function get(string $path, mixed $default = null): mixed;

    /**
     * Retrieve a value or throw when the path does not exist.
     *
     * @param string $path Dot-notation path.
     *
     * @return mixed Resolved value.
     *
     * @throws \SafeAccess\Inline\Exceptions\PathNotFoundException When the path is missing.
     */
    public function getOrFail(string $path): mixed;

    /**
     * Retrieve a value using pre-parsed key segments.
     *
     * @param array<int|string> $segments Ordered list of keys.
     * @param mixed             $default  Fallback when the path does not exist.
     *
     * @return mixed Resolved value or the default.
     */
    public function getAt(array $segments, mixed $default = null): mixed;

    /**
     * Check whether a dot-notation path exists.
     *
     * @param string $path Dot-notation path.
     *
     * @return bool True if the path resolves to a value.
     */
    public function has(string $path): bool;

    /**
     * Check whether a path exists using pre-parsed key segments.
     *
     * @param array<int|string> $segments Ordered list of keys.
     *
     * @return bool True if the path resolves to a value.
     */
    public function hasAt(array $segments): bool;

    /**
     * Retrieve multiple values by their paths with individual defaults.
     *
     * @param array<string, mixed> $paths Map of path => default value.
     *
     * @return array<string, mixed> Map of path => resolved value.
     */
    public function getMany(array $paths): array;

    /**
     * Return all parsed data as a flat or nested array.
     *
     * @return array<mixed> Complete internal data.
     */
    public function all(): array;

    /**
     * Count elements at a path, or the root if null.
     *
     * @param string|null $path Dot-notation path, or null for root.
     *
     * @return int Number of elements.
     */
    public function count(?string $path = null): int;

    /**
     * Retrieve array keys at a path, or root keys if null.
     *
     * @param string|null $path Dot-notation path, or null for root.
     *
     * @return array<string> List of keys. Integer keys (e.g. from numeric arrays)
     *   are cast to strings so the return type is symmetric with the JS implementation,
     *   which always returns string[] via Object.keys().
     */
    public function keys(?string $path = null): array;
}
