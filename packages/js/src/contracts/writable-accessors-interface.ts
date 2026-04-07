/**
 * Contract for immutable write operations on accessor data.
 *
 * All mutations return a new instance with the modification applied,
 * preserving the original accessor instance.
 */
export interface WritableAccessorsInterface {
    /**
     * Set a value at a dot-notation path.
     *
     * @param path - Dot-notation path.
     * @param value - Value to assign.
     * @returns New accessor instance with the value set.
     * @throws {ReadonlyViolationException} When the accessor is readonly.
     * @throws {SecurityException} When the path contains forbidden keys.
     */
    set(path: string, value: unknown): this;

    /**
     * Set a value using pre-parsed key segments.
     *
     * @param segments - Ordered list of keys.
     * @param value - Value to assign.
     * @returns New accessor instance with the value set.
     * @throws {ReadonlyViolationException} When the accessor is readonly.
     * @throws {SecurityException} When segments contain forbidden keys.
     */
    setAt(segments: Array<string | number>, value: unknown): this;

    /**
     * Remove a value at a dot-notation path.
     *
     * @param path - Dot-notation path to remove.
     * @returns New accessor instance without the specified path.
     * @throws {ReadonlyViolationException} When the accessor is readonly.
     * @throws {SecurityException} When the path contains forbidden keys.
     */
    remove(path: string): this;

    /**
     * Remove a value using pre-parsed key segments.
     *
     * @param segments - Ordered list of keys.
     * @returns New accessor instance without the specified path.
     * @throws {ReadonlyViolationException} When the accessor is readonly.
     * @throws {SecurityException} When segments contain forbidden keys.
     */
    removeAt(segments: Array<string | number>): this;

    /**
     * Deep-merge an object into the value at a dot-notation path.
     *
     * @param path - Dot-notation path to the merge target.
     * @param value - Object to merge into the existing value.
     * @returns New accessor instance with merged data.
     * @throws {ReadonlyViolationException} When the accessor is readonly.
     * @throws {SecurityException} When the path or values contain forbidden keys.
     */
    merge(path: string, value: Record<string, unknown>): this;

    /**
     * Deep-merge an object into the root data.
     *
     * @param value - Object to merge into the root.
     * @returns New accessor instance with merged data.
     * @throws {ReadonlyViolationException} When the accessor is readonly.
     * @throws {SecurityException} When values contain forbidden keys.
     */
    mergeAll(value: Record<string, unknown>): this;
}
