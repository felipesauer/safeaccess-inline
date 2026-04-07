/**
 * Contract for security validation during parsing and path resolution.
 *
 * Defines methods for asserting payload size, maximum key counts,
 * and recursion depth limits to prevent resource exhaustion and
 * injection attacks during data access operations.
 */
export interface SecurityParserInterface {
    /**
     * Assert that a raw string payload does not exceed the byte limit.
     *
     * @param input - Raw input string to measure.
     * @param maxBytes - Override limit, or undefined to use configured default.
     * @throws {SecurityException} When the payload exceeds the limit.
     */
    assertPayloadSize(input: string, maxBytes?: number): void;

    /**
     * Assert that resolve depth does not exceed the configured limit.
     *
     * @param depth - Current depth counter.
     * @throws {SecurityException} When depth exceeds the maximum.
     */
    assertMaxResolveDepth(depth: number): void;

    /**
     * Assert that total key count does not exceed the limit.
     *
     * @param data - Data to count keys in.
     * @param maxKeys - Override limit, or undefined to use configured default.
     * @param maxCountDepth - Override recursion depth limit, or undefined for default.
     * @throws {SecurityException} When key count exceeds the limit.
     */
    assertMaxKeys(data: Record<string, unknown>, maxKeys?: number, maxCountDepth?: number): void;

    /**
     * Assert that current recursion depth does not exceed the limit.
     *
     * @param currentDepth - Current depth counter.
     * @param maxDepth - Override limit, or undefined to use configured default.
     * @throws {SecurityException} When the depth exceeds the limit.
     */
    assertMaxDepth(currentDepth: number, maxDepth?: number): void;

    /**
     * Assert that structural nesting depth does not exceed the policy limit.
     *
     * @param data - Data to measure structural depth of.
     * @param maxDepth - Maximum allowed structural depth.
     * @throws {SecurityException} When structural depth exceeds the limit.
     */
    assertMaxStructuralDepth(data: unknown, maxDepth: number): void;

    /**
     * Return the configured maximum structural nesting depth.
     *
     * @returns Maximum allowed depth.
     */
    getMaxDepth(): number;

    /**
     * Return the configured maximum path-resolve recursion depth.
     *
     * @returns Maximum allowed resolve depth.
     */
    getMaxResolveDepth(): number;

    /**
     * Return the configured maximum total key count.
     *
     * @returns Maximum allowed key count.
     */
    getMaxKeys(): number;
}
