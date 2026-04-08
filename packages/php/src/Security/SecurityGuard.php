<?php

declare(strict_types=1);

namespace SafeAccess\Inline\Security;

use SafeAccess\Inline\Contracts\SecurityGuardInterface;
use SafeAccess\Inline\Exceptions\SecurityException;

/**
 * Immutable guard that validates keys against a forbidden-key list.
 *
 * Blocks PHP magic methods, superglobals, stream wrapper URIs, and
 * prototype pollution vectors (`__proto__`, `constructor`, `prototype`)
 * from being used as data keys. The forbidden list is built at construction
 * time and cannot be modified afterward.
 *
 * Magic-method keys are normalised to lowercase before lookup because PHP
 * resolves method names case-insensitively (e.g. `__GET` == `__get`).
 *
 * Stream wrapper URIs are matched by prefix so that fully-formed wrappers
 * such as `phar://shell.phar/exec.php` are also blocked, not only the bare
 * scheme string.
 *
 * @api
 *
 * @see SecurityGuardInterface  Contract this class implements.
 *
 * @example
 * $guard = new SecurityGuard();
 * $guard->assertSafeKey('name'); // OK
 * $guard->assertSafeKey('__proto__'); // throws SecurityException
 */
final class SecurityGuard implements SecurityGuardInterface
{
    /**
     * Stream-wrapper URI schemes blocked by prefix matching.
     *
     * Entries must include the `://` delimiter so that legitimate keys
     * sharing the same word prefix (e.g. `pharaoh`) are not blocked.
     *
     * @var list<string>
     */
    private const STREAM_WRAPPER_PREFIXES = [
        'php://',
        'phar://',
        'ftp://',
        'http://',
        'https://',
        'file://',
        'data://',
        'glob://',
        'zlib://',
        'expect://',
        'ogg://',
        'rar://',
        'zip://',
        'ssh2.tunnel://',
    ];

    /** @var array<string, true> Hash-map of forbidden key names for O(1) lookup. */
    private readonly array $forbiddenKeysMap;

    /**
     * Build the guard with default forbidden keys plus any extras from config.
     *
     * @param int           $maxDepth           Maximum recursion depth for recursive key scanning.
     * @param array<string> $extraForbiddenKeys Additional keys to forbid beyond defaults.
     */
    public function __construct(
        public readonly int $maxDepth = 512,
        public readonly array $extraForbiddenKeys = [],
    ) {
        $defaults = [
            '__construct'        => true,
            '__destruct'         => true,
            '__call'             => true,
            '__callstatic'       => true,
            '__get'              => true,
            '__set'              => true,
            '__isset'            => true,
            '__unset'            => true,
            '__sleep'            => true,
            '__wakeup'           => true,
            '__serialize'        => true,
            '__unserialize'      => true,
            '__tostring'         => true,
            '__invoke'           => true,
            '__set_state'        => true,
            '__debuginfo'        => true,
            '__clone'            => true,
            '__proto__'          => true,
            'constructor'        => true,
            'prototype'          => true,
            'GLOBALS'            => true,
            '_GET'               => true,
            '_POST'              => true,
            '_COOKIE'            => true,
            '_REQUEST'           => true,
            '_SERVER'            => true,
            '_ENV'               => true,
            '_FILES'             => true,
            '_SESSION'           => true,
            'php://'             => true,
            'http://'            => true,
            'https://'           => true,
            'ftp://'             => true,
            'phar://'            => true,
            'zip://'             => true,
            'rar://'             => true,
            'data://'            => true,
            'glob://'            => true,
            'zlib://'            => true,
            'expect://'          => true,
            'file://'            => true,
            'ogg://'             => true,
            'ssh2.tunnel://'     => true,
            'php://input'        => true,
            'php://output'       => true,
            'php://filter'       => true,
            'php://memory'       => true,
            'php://temp'         => true,
        ];

        $extra = array_fill_keys($extraForbiddenKeys, true);
        $this->forbiddenKeysMap = $defaults + $extra;
    }

    /**
     * Check whether a key is in the forbidden list.
     *
     * Magic-method keys (`__*`) are normalised to lowercase before the
     * hash-map lookup because PHP resolves method names case-insensitively.
     *
     * Stream wrapper URIs are matched by prefix against the lowercased key
     * so that fully-formed URIs such as `phar://shell.phar/exec.php` and
     * case variants like `PHP://filter` are blocked in addition to the
     * bare scheme strings stored in the exact-match map.
     *
     * @param string $key Key name to check.
     *
     * @return bool True if the key is forbidden.
     */
    public function isForbiddenKey(string $key): bool
    {
        // Normalise magic-method candidates - PHP resolves them case-insensitively.
        $lookupKey = str_starts_with($key, '__') ? strtolower($key) : $key;

        if (isset($this->forbiddenKeysMap[$lookupKey])) {
            return true;
        }

        // Prefix-based check blocks fully-formed stream wrapper URIs
        // (e.g. `phar://shell.phar/exec.php`) that would pass an exact lookup.
        // PHP resolves stream wrapper URIs case-insensitively, so lowercase
        // the key before comparing against the known prefixes.
        $lower = strtolower($key);
        foreach (self::STREAM_WRAPPER_PREFIXES as $prefix) {
            if (str_starts_with($lower, $prefix)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Assert that a single key is safe, throwing on violation.
     *
     * @param string $key Key name to validate.
     *
     * @throws \SafeAccess\Inline\Exceptions\SecurityException When the key is in the forbidden list.
     */
    public function assertSafeKey(string $key): void
    {
        if ($this->isForbiddenKey($key)) {
            throw new SecurityException("Forbidden key '{$key}' detected.");
        }
    }

    /**
     * Recursively assert that all keys in a data structure are safe.
     *
     * @param mixed $data  Data to scan for forbidden keys.
     * @param int   $depth Current recursion depth.
     *
     * @throws \SafeAccess\Inline\Exceptions\SecurityException When a forbidden key is found or depth exceeds the limit.
     */
    public function assertSafeKeys(mixed $data, int $depth = 0): void
    {
        if (!is_array($data)) {
            return;
        }

        if ($depth > $this->maxDepth) {
            throw new SecurityException("Recursion depth {$depth} exceeds maximum of {$this->maxDepth}.");
        }

        foreach ($data as $key => $value) {
            if (is_string($key)) {
                $this->assertSafeKey($key);
            }
            $this->assertSafeKeys($value, $depth + 1);
        }
    }

    /**
     * Remove all forbidden keys from a data structure recursively.
     *
     * @param array<string, mixed> $data  Data to sanitize.
     * @param int                  $depth Current recursion depth.
     *
     * @return array<string, mixed> Sanitized data without forbidden keys.
     *
     * @throws \SafeAccess\Inline\Exceptions\SecurityException When recursion depth exceeds the limit.
     */
    public function sanitize(array $data, int $depth = 0): array
    {
        return $this->sanitizeRecursive($data, $depth);
    }

    /**
     * Internal recursive implementation of {@see sanitize()}.
     *
     * Accepts integer-keyed sub-arrays that may appear as list values inside
     * an otherwise string-keyed payload (e.g. `{"items": [{...}, {...}]}`).
     *
     * @param array<array-key, mixed> $data  Data to sanitize.
     * @param int                     $depth Current recursion depth.
     *
     * @return array<array-key, mixed> Sanitized data without forbidden keys.
     *
     * @throws \SafeAccess\Inline\Exceptions\SecurityException When recursion depth exceeds the limit.
     *
     * @internal
     */
    private function sanitizeRecursive(array $data, int $depth): array
    {
        if ($depth > $this->maxDepth) {
            throw new SecurityException("Recursion depth {$depth} exceeds maximum of {$this->maxDepth}.");
        }

        $cleaned = [];
        foreach ($data as $key => $value) {
            if (is_string($key) && $this->isForbiddenKey($key)) {
                continue;
            }

            $cleaned[$key] = is_array($value)
                ? $this->sanitizeRecursive($value, $depth + 1)
                : $value;
        }

        return $cleaned;
    }
}
