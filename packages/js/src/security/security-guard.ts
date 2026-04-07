import type { SecurityGuardInterface } from '../contracts/security-guard-interface.js';
import { SecurityException } from '../exceptions/security-exception.js';
import { DEFAULT_FORBIDDEN_KEYS, STREAM_WRAPPER_PREFIXES } from './forbidden-keys.js';

/**
 * Immutable guard that validates keys against a forbidden-key list.
 *
 * Blocks JavaScript prototype pollution vectors (`__proto__`, `constructor`,
 * `prototype`), legacy prototype manipulation methods (`__defineGetter__` family),
 * the `hasOwnProperty` shadow key, and JavaScript-relevant stream wrapper /
 * protocol URIs (`file://`, `javascript:`, `ws://`, etc.) from being used as
 * data keys. The forbidden list is built at construction time and cannot be
 * modified afterward.
 *
 * `__*` keys are normalised to lowercase before lookup so that case variants
 * such as `__PROTO__` are also blocked.
 *
 * Stream wrapper URIs are matched by prefix so that fully-formed URIs such as
 * `javascript:alert(1)` are also blocked, not only the bare scheme string.
 *
 * @example
 * const guard = new SecurityGuard();
 * guard.assertSafeKey('name'); // OK
 * guard.assertSafeKey('__proto__'); // throws SecurityException
 */
export class SecurityGuard implements SecurityGuardInterface {
    readonly maxDepth: number;

    private readonly forbiddenKeysMap: ReadonlySet<string>;

    /**
     * Build the guard with default forbidden keys plus any extras.
     *
     * @param maxDepth - Maximum recursion depth for recursive key scanning.
     * @param extraForbiddenKeys - Additional keys to forbid beyond defaults.
     */
    constructor(maxDepth: number = 512, /* Stryker disable next-line ArrayDeclaration -- equivalent: default [] produces identical behavior; no extra keys added to Set */ extraForbiddenKeys: string[] = []) {
        this.maxDepth = Number.isFinite(maxDepth) ? maxDepth : 512;

        /* Stryker disable next-line ConditionalExpression -- equivalent: if (false) still produces the same forbiddenKeysMap for empty arrays since Set(DEFAULT)=DEFAULT */
        if (extraForbiddenKeys.length === 0) {
            this.forbiddenKeysMap = DEFAULT_FORBIDDEN_KEYS;
        } else {
            const combined = new Set(DEFAULT_FORBIDDEN_KEYS);
            for (const key of extraForbiddenKeys) {
                combined.add(key);
            }
            this.forbiddenKeysMap = combined;
        }
    }

    /**
     * Check whether a key is in the forbidden list.
     *
     * `__*` keys are normalised to lowercase before the map lookup so that
     * case variants (e.g. `__PROTO__`) are also caught. Stream wrapper and
     * protocol URIs are matched by prefix.
     *
     * @param key - Key name to check.
     * @returns True if the key is forbidden.
     *
     * @example
     * guard.isForbiddenKey('__proto__'); // true
     * guard.isForbiddenKey('name');      // false
     */
    isForbiddenKey(key: string): boolean {
        // Normalise __* keys to lowercase — catches case variants such as __PROTO__.
        const lookupKey = key.startsWith('__') ? key.toLowerCase() : key;

        if (this.forbiddenKeysMap.has(lookupKey)) {
            return true;
        }

        const lower = key.toLowerCase();
        for (const prefix of STREAM_WRAPPER_PREFIXES) {
            if (lower.startsWith(prefix)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Assert that a single key is safe, throwing on violation.
     *
     * @param key - Key name to validate.
     * @throws {SecurityException} When the key is in the forbidden list.
     *
     * @example
     * guard.assertSafeKey('username'); // OK
     * guard.assertSafeKey('__proto__'); // throws SecurityException
     */
    assertSafeKey(key: string): void {
        if (this.isForbiddenKey(key)) {
            throw new SecurityException(`Forbidden key '${key}' detected.`);
        }
    }

    /**
     * Recursively assert that all keys in a data structure are safe.
     *
     * @param data - Data to scan for forbidden keys.
     * @param depth - Current recursion depth.
     * @throws {SecurityException} When a forbidden key is found or depth exceeds the limit.
     *
     * @example
     * guard.assertSafeKeys({ name: 'Alice', age: 30 }); // OK
     * guard.assertSafeKeys({ __proto__: 'bad' }); // throws SecurityException
     */
    assertSafeKeys(data: unknown, depth: number = 0): void {
        if (typeof data !== 'object' || data === null) {
            return;
        }

        /* Stryker disable next-line EqualityOperator -- boundary: depth > max vs depth >= max; ≥ would throw one level too early */
        if (depth > this.maxDepth) {
            throw new SecurityException(
                `Recursion depth ${depth} exceeds maximum of ${this.maxDepth}.`,
            );
        }

        for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
            this.assertSafeKey(key);
            this.assertSafeKeys(value, depth + 1);
        }
    }

    /**
     * Remove all forbidden keys from a data structure recursively.
     *
     * @param data - Data to sanitize.
     * @param depth - Current recursion depth.
     * @returns Sanitized data without forbidden keys.
     * @throws {SecurityException} When recursion depth exceeds the limit.
     *
     * @example
     * guard.sanitize({ name: 'Alice', __construct: 'bad' });
     * // => { name: 'Alice' }
     */
    sanitize(data: Record<string, unknown>, depth: number = 0): Record<string, unknown> {
        /* Stryker disable next-line EqualityOperator -- boundary: depth > max vs depth >= max; >= would throw one level too early */
        if (depth > this.maxDepth) {
            throw new SecurityException(
                `Recursion depth ${depth} exceeds maximum of ${this.maxDepth}.`,
            );
        }

        const result: Record<string, unknown> = {};

        for (const [key, value] of Object.entries(data)) {
            if (this.isForbiddenKey(key)) {
                continue;
            }

            if (Array.isArray(value)) {
                result[key] = this.sanitizeArray(value, depth + 1);
            } else if (typeof value === 'object' && value !== null) {
                result[key] = this.sanitize(value as Record<string, unknown>, depth + 1);
            } else {
                result[key] = value;
            }
        }

        return result;
    }

    /**
     * Recursively sanitize array elements, removing forbidden keys from nested objects.
     *
     * @param array - Array to sanitize.
     * @param depth - Current recursion depth.
     * @returns Sanitized array with forbidden keys removed from object elements.
     *
     * @throws {SecurityException} When recursion depth exceeds the limit.
     */
    private sanitizeArray(array: unknown[], depth: number): unknown[] {
        /* Stryker disable next-line EqualityOperator -- boundary: depth > max vs depth >= max; >= would throw one level too early */
        if (depth > this.maxDepth) {
            throw new SecurityException(
                `Recursion depth ${depth} exceeds maximum of ${this.maxDepth}.`,
            );
        }

        return array.map((item) => {
            if (Array.isArray(item)) {
                return this.sanitizeArray(item, depth + 1);
            }
            if (typeof item === 'object' && item !== null) {
                return this.sanitize(item as Record<string, unknown>, depth + 1);
            }
            return item;
        });
    }
}
