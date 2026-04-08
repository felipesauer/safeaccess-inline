<?php

declare(strict_types=1);

namespace SafeAccess\Inline\Contracts;

/**
 * Core contract for dot-notation path operations on array data.
 *
 * Defines the fundamental CRUD operations for reading, writing, and
 * removing values from nested arrays using dot-notation path strings
 * or pre-parsed segment arrays.
 *
 * @internal Not part of the public API - consumers should not implement or type-hint against this interface directly.
 */
interface ParserInterface
{
    /**
     * Retrieve a value at the given dot-notation path.
     *
     * @param array<mixed> $data    Source data array.
     * @param string       $path    Dot-notation path (e.g. "user.address.city").
     * @param mixed        $default Fallback value when the path does not exist.
     *
     * @return mixed Resolved value or the default.
     */
    public function get(array $data, string $path, mixed $default = null): mixed;

    /**
     * Check whether a dot-notation path exists in the data.
     *
     * @param array<mixed> $data Source data array.
     * @param string       $path Dot-notation path to check.
     *
     * @return bool True if the path resolves to an existing value.
     */
    public function has(array $data, string $path): bool;

    /**
     * Set a value at the given dot-notation path.
     *
     * @param array<mixed> $data  Source data array.
     * @param string       $path  Dot-notation path for the target key.
     * @param mixed        $value Value to assign.
     *
     * @return array<mixed> New array with the value set.
     *
     * @throws \SafeAccess\Inline\Exceptions\SecurityException When the path contains forbidden keys.
     */
    public function set(array $data, string $path, mixed $value): array;

    /**
     * Remove a value at the given dot-notation path.
     *
     * @param array<mixed> $data Source data array.
     * @param string       $path Dot-notation path to remove.
     *
     * @return array<mixed> New array with the key removed.
     *
     * @throws \SafeAccess\Inline\Exceptions\SecurityException When the path contains forbidden keys.
     */
    public function remove(array $data, string $path): array;

    /**
     * Deep-merge an array into the value at the given path.
     *
     * @param array<mixed> $data  Source data array.
     * @param string       $path  Dot-notation path to the merge target.
     * @param array<mixed> $value Array to merge into the existing value.
     *
     * @return array<mixed> New array with merged data.
     *
     * @throws \SafeAccess\Inline\Exceptions\SecurityException When merge depth exceeds the configured maximum.
     * @throws \SafeAccess\Inline\Exceptions\SecurityException When keys contain forbidden values.
     */
    public function merge(array $data, string $path, array $value): array;

    /**
     * Retrieve a value using pre-parsed key segments.
     *
     * @param array<mixed>      $data     Source data array.
     * @param array<int|string> $segments Ordered list of keys to traverse.
     * @param mixed             $default  Fallback value when the path does not exist.
     *
     * @return mixed Resolved value or the default.
     */
    public function getAt(array $data, array $segments, mixed $default = null): mixed;

    /**
     * Set a value using pre-parsed key segments.
     *
     * @param array<mixed>      $data     Source data array.
     * @param array<int|string> $segments Ordered list of keys to the target.
     * @param mixed             $value    Value to assign.
     *
     * @return array<mixed> New array with the value set.
     *
     * @throws \SafeAccess\Inline\Exceptions\SecurityException When segments contain forbidden keys.
     */
    public function setAt(array $data, array $segments, mixed $value): array;

    /**
     * Remove a value using pre-parsed key segments.
     *
     * @param array<mixed>      $data     Source data array.
     * @param array<int|string> $segments Ordered list of keys to the target.
     *
     * @return array<mixed> New array with the key removed.
     *
     * @throws \SafeAccess\Inline\Exceptions\SecurityException When segments contain forbidden keys.
     */
    public function removeAt(array $data, array $segments): array;
}
