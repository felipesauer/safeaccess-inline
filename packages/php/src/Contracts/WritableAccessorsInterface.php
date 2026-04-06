<?php

declare(strict_types=1);

namespace SafeAccess\Inline\Contracts;

/**
 * Contract for immutable write operations on accessor data.
 *
 * All mutations return a new clone with the modification applied,
 * preserving the original accessor instance.
 *
 * @api
 *
 * @see AccessorsInterface  Composite interface extending this contract.
 * @see AbstractAccessor    Base implementation enforcing readonly guards.
 */
interface WritableAccessorsInterface
{
    /**
     * Set a value at a dot-notation path.
     *
     * @param string $path  Dot-notation path.
     * @param mixed  $value Value to assign.
     *
     * @return static New accessor instance with the value set.
     *
     * @throws \SafeAccess\Inline\Exceptions\ReadonlyViolationException When the accessor is readonly.
     * @throws \SafeAccess\Inline\Exceptions\SecurityException          When the path contains forbidden keys.
     */
    public function set(string $path, mixed $value): static;

    /**
     * Set a value using pre-parsed key segments.
     *
     * @param array<int|string> $segments Ordered list of keys.
     * @param mixed             $value    Value to assign.
     *
     * @return static New accessor instance with the value set.
     *
     * @throws \SafeAccess\Inline\Exceptions\ReadonlyViolationException When the accessor is readonly.
     * @throws \SafeAccess\Inline\Exceptions\SecurityException          When segments contain forbidden keys.
     */
    public function setAt(array $segments, mixed $value): static;

    /**
     * Remove a value at a dot-notation path.
     *
     * @param string $path Dot-notation path to remove.
     *
     * @return static New accessor instance without the specified path.
     *
     * @throws \SafeAccess\Inline\Exceptions\ReadonlyViolationException When the accessor is readonly.
     * @throws \SafeAccess\Inline\Exceptions\SecurityException          When the path contains forbidden keys.
     */
    public function remove(string $path): static;

    /**
     * Remove a value using pre-parsed key segments.
     *
     * @param array<int|string> $segments Ordered list of keys.
     *
     * @return static New accessor instance without the specified path.
     *
     * @throws \SafeAccess\Inline\Exceptions\ReadonlyViolationException When the accessor is readonly.
     * @throws \SafeAccess\Inline\Exceptions\SecurityException          When segments contain forbidden keys.
     */
    public function removeAt(array $segments): static;

    /**
     * Deep-merge an array into the value at a dot-notation path.
     *
     * @param string       $path  Dot-notation path to the merge target.
     * @param array<mixed> $value Array to merge into the existing value.
     *
     * @return static New accessor instance with merged data.
     *
     * @throws \SafeAccess\Inline\Exceptions\ReadonlyViolationException When the accessor is readonly.
     * @throws \SafeAccess\Inline\Exceptions\SecurityException          When the path or values contain forbidden keys.
     */
    public function merge(string $path, array $value): static;

    /**
     * Deep-merge an array into the root data.
     *
     * @param array<mixed> $value Array to merge into the root.
     *
     * @return static New accessor instance with merged data.
     *
     * @throws \SafeAccess\Inline\Exceptions\ReadonlyViolationException When the accessor is readonly.
     * @throws \SafeAccess\Inline\Exceptions\SecurityException          When values contain forbidden keys.
     */
    public function mergeAll(array $value): static;
}
