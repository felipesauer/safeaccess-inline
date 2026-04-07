/**
 * Contract for validating keys against a forbidden-key security list.
 *
 * Prevents injection attacks by rejecting prototype pollution vectors,
 * legacy prototype manipulation methods, stream wrapper / protocol URI schemes,
 * and Node.js globals during data access and mutation operations.
 */
export interface SecurityGuardInterface {
    /**
     * Check whether a key is in the forbidden list.
     *
     * @param key - Key name to check.
     * @returns True if the key is forbidden.
     */
    isForbiddenKey(key: string): boolean;

    /**
     * Assert that a single key is safe, throwing on violation.
     *
     * @param key - Key name to validate.
     * @throws {SecurityException} When the key is forbidden.
     */
    assertSafeKey(key: string): void;

    /**
     * Recursively assert that all keys in a data structure are safe.
     *
     * @param data - Data to scan for forbidden keys.
     * @param depth - Current recursion depth (internal use).
     * @throws {SecurityException} When a forbidden key is found or depth is exceeded.
     */
    assertSafeKeys(data: unknown, depth?: number): void;

    /**
     * Remove all forbidden keys from a data structure recursively.
     *
     * @param data - Data to sanitize.
     * @param depth - Current recursion depth.
     * @returns Sanitized data without forbidden keys.
     * @throws {SecurityException} When recursion depth exceeds the limit.
     */
    sanitize(data: Record<string, unknown>, depth?: number): Record<string, unknown>;
}
