<?php

declare(strict_types=1);

namespace SafeAccess\Inline\Contracts;

/**
 * Contract for validating keys against a forbidden-key security list.
 *
 * Prevents injection attacks by rejecting PHP magic methods, superglobals,
 * stream wrapper keys, and prototype pollution vectors during data access
 * and mutation operations.
 *
 * @api
 */
interface SecurityGuardInterface
{
    /**
     * Check whether a key is in the forbidden list.
     *
     * @param string $key Key name to check.
     *
     * @return bool True if the key is forbidden.
     */
    public function isForbiddenKey(string $key): bool;

    /**
     * Assert that a single key is safe, throwing on violation.
     *
     * @param string $key Key name to validate.
     *
     * @throws \SafeAccess\Inline\Exceptions\SecurityException When the key is forbidden.
     */
    public function assertSafeKey(string $key): void;

    /**
     * Recursively assert that all keys in a data structure are safe.
     *
     * @param mixed $data  Data to scan for forbidden keys.
     * @param int   $depth Current recursion depth (internal use).
     *
     * @throws \SafeAccess\Inline\Exceptions\SecurityException When a forbidden key is found or depth is exceeded.
     */
    public function assertSafeKeys(mixed $data, int $depth = 0): void;

    /**
     * Remove all forbidden keys from a data structure recursively.
     *
     * @param array<string, mixed> $data  Data to sanitize.
     * @param int                  $depth Current recursion depth (internal).
     *
     * @return array<string, mixed> Sanitized data without forbidden keys.
     *
     * @throws \SafeAccess\Inline\Exceptions\SecurityException When recursion depth exceeds the limit.
     */
    public function sanitize(array $data, int $depth = 0): array;
}
