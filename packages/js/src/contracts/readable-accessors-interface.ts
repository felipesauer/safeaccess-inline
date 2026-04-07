/**
 * Contract for read-only data access operations.
 *
 * Defines methods for retrieving, checking existence, counting,
 * and inspecting keys within the accessor's internal data store.
 */
export interface ReadableAccessorsInterface {
    /**
     * Retrieve the original raw input data before parsing.
     *
     * @returns Original input passed to {@link FactoryAccessorsInterface.from}.
     */
    getRaw(): unknown;

    /**
     * Retrieve a value at a dot-notation path.
     *
     * @param path - Dot-notation path (e.g. "user.name").
     * @param defaultValue - Fallback when the path does not exist.
     * @returns Resolved value or the default.
     */
    get(path: string, defaultValue?: unknown): unknown;

    /**
     * Retrieve a value or throw when the path does not exist.
     *
     * @param path - Dot-notation path.
     * @returns Resolved value.
     * @throws {PathNotFoundException} When the path is missing.
     */
    getOrFail(path: string): unknown;

    /**
     * Retrieve a value using pre-parsed key segments.
     *
     * @param segments - Ordered list of keys.
     * @param defaultValue - Fallback when the path does not exist.
     * @returns Resolved value or the default.
     */
    getAt(segments: Array<string | number>, defaultValue?: unknown): unknown;

    /**
     * Check whether a dot-notation path exists.
     *
     * @param path - Dot-notation path.
     * @returns True if the path resolves to a value.
     */
    has(path: string): boolean;

    /**
     * Check whether a path exists using pre-parsed key segments.
     *
     * @param segments - Ordered list of keys.
     * @returns True if the path resolves to a value.
     */
    hasAt(segments: Array<string | number>): boolean;

    /**
     * Retrieve multiple values by their paths with individual defaults.
     *
     * @param paths - Map of path to default value.
     * @returns Map of path to resolved value.
     */
    getMany(paths: Record<string, unknown>): Record<string, unknown>;

    /**
     * Return all parsed data as a plain object.
     *
     * @returns Complete internal data.
     */
    all(): Record<string, unknown>;

    /**
     * Count elements at a path, or the root if undefined.
     *
     * @param path - Dot-notation path, or undefined for root.
     * @returns Number of elements.
     */
    count(path?: string): number;

    /**
     * Retrieve array keys at a path, or root keys if undefined.
     *
     * @param path - Dot-notation path, or undefined for root.
     * @returns List of keys.
     */
    keys(path?: string): string[];
}
