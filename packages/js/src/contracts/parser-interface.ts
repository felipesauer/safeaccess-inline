/**
 * Core contract for dot-notation path operations on object data.
 *
 * Defines the fundamental CRUD operations for reading, writing, and
 * removing values from nested objects using dot-notation path strings
 * or pre-parsed segment arrays.
 *
 * @internal Not part of the public API - consumers should not implement
 *           or type-hint against this interface directly.
 */
export interface ParserInterface {
    /**
     * Retrieve a value at the given dot-notation path.
     *
     * @param data - Source data object.
     * @param path - Dot-notation path (e.g. "user.address.city").
     * @param defaultValue - Fallback value when the path does not exist.
     * @returns Resolved value or the default.
     */
    get(data: Record<string, unknown>, path: string, defaultValue?: unknown): unknown;

    /**
     * Check whether a dot-notation path exists in the data.
     *
     * @param data - Source data object.
     * @param path - Dot-notation path to check.
     * @returns True if the path resolves to an existing value.
     */
    has(data: Record<string, unknown>, path: string): boolean;

    /**
     * Set a value at the given dot-notation path.
     *
     * @param data - Source data object.
     * @param path - Dot-notation path for the target key.
     * @param value - Value to assign.
     * @returns New object with the value set.
     *
     * @throws {SecurityException} When the path contains forbidden keys.
     */
    set(data: Record<string, unknown>, path: string, value: unknown): Record<string, unknown>;

    /**
     * Remove a value at the given dot-notation path.
     *
     * @param data - Source data object.
     * @param path - Dot-notation path to remove.
     * @returns New object with the key removed.
     *
     * @throws {SecurityException} When the path contains forbidden keys.
     */
    remove(data: Record<string, unknown>, path: string): Record<string, unknown>;

    /**
     * Deep-merge an object into the value at the given path.
     *
     * @param data - Source data object.
     * @param path - Dot-notation path to the merge target.
     * @param value - Object to merge into the existing value.
     * @returns New object with merged data.
     *
     * @throws {SecurityException} When merge depth exceeds the configured maximum.
     * @throws {SecurityException} When keys contain forbidden values.
     */
    merge(
        data: Record<string, unknown>,
        path: string,
        value: Record<string, unknown>,
    ): Record<string, unknown>;

    /**
     * Retrieve a value using pre-parsed key segments.
     *
     * @param data - Source data object.
     * @param segments - Ordered list of keys to traverse.
     * @param defaultValue - Fallback value when the path does not exist.
     * @returns Resolved value or the default.
     */
    getAt(
        data: Record<string, unknown>,
        segments: Array<string | number>,
        defaultValue?: unknown,
    ): unknown;

    /**
     * Set a value using pre-parsed key segments.
     *
     * @param data - Source data object.
     * @param segments - Ordered list of keys to the target.
     * @param value - Value to assign.
     * @returns New object with the value set.
     *
     * @throws {SecurityException} When segments contain forbidden keys.
     */
    setAt(
        data: Record<string, unknown>,
        segments: Array<string | number>,
        value: unknown,
    ): Record<string, unknown>;

    /**
     * Remove a value using pre-parsed key segments.
     *
     * @param data - Source data object.
     * @param segments - Ordered list of keys to the target.
     * @returns New object with the key removed.
     *
     * @throws {SecurityException} When segments contain forbidden keys.
     */
    removeAt(
        data: Record<string, unknown>,
        segments: Array<string | number>,
    ): Record<string, unknown>;
}
