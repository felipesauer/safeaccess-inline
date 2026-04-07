import type { SecurityParserInterface } from '../contracts/security-parser-interface.js';
import { SecurityException } from '../exceptions/security-exception.js';

/**
 * Enforce structural security constraints on parsed data.
 *
 * Validates payload size, maximum key count, recursion depth, and
 * structural depth limits.
 *
 * @example
 * const parser = new SecurityParser({ maxDepth: 10, maxKeys: 100 });
 * parser.assertPayloadSize('{"key":"value"}');
 */
export class SecurityParser implements SecurityParserInterface {
    readonly maxDepth: number;
    readonly maxPayloadBytes: number;
    readonly maxKeys: number;
    readonly maxCountRecursiveDepth: number;
    readonly maxResolveDepth: number;

    /**
     * Build security options from configuration values.
     *
     * @param options - Configuration overrides.
     * @param options.maxDepth - Maximum allowed structural nesting depth. Default: 512.
     * @param options.maxPayloadBytes - Maximum allowed raw payload size in bytes. Default: 10 MB.
     * @param options.maxKeys - Maximum total number of keys across the entire structure. Default: 10000.
     *   This value is also passed to `XmlParser` as the element-count cap for the Node.js manual XML
     *   parser path. Setting it below a document's element count will cause `fromXml()` to throw
     *   `SecurityException`. Non-positive or non-finite values disable that guard — prefer the default.
     * @param options.maxCountRecursiveDepth - Maximum recursion depth when counting keys. Default: 100.
     * @param options.maxResolveDepth - Maximum recursion depth for path resolution. Default: 100.
     */
    constructor(
        options: {
            maxDepth?: number;
            maxPayloadBytes?: number;
            maxKeys?: number;
            maxCountRecursiveDepth?: number;
            maxResolveDepth?: number;
        } = {},
    ) {
        this.maxDepth = SecurityParser.clampOption(options.maxDepth, 512);
        this.maxPayloadBytes = SecurityParser.clampOption(options.maxPayloadBytes, 10 * 1024 * 1024);
        this.maxKeys = SecurityParser.clampOption(options.maxKeys, 10_000);
        this.maxCountRecursiveDepth = SecurityParser.clampOption(options.maxCountRecursiveDepth, 100);
        this.maxResolveDepth = SecurityParser.clampOption(options.maxResolveDepth, 100);
    }

    /**
     * Assert that a raw string payload does not exceed the byte limit.
     *
     * @param input - Raw input string to measure.
     * @param maxBytes - Override limit, or undefined to use configured default.
     * @throws {SecurityException} When the payload exceeds the limit.
     *
     * @example
     * parser.assertPayloadSize('small input'); // OK
     */
    assertPayloadSize(input: string, maxBytes?: number): void {
        const limit = maxBytes ?? this.maxPayloadBytes;
        const size = new TextEncoder().encode(input).length;

        if (size > limit) {
            throw new SecurityException(
                `Payload size ${size} bytes exceeds maximum of ${limit} bytes.`,
            );
        }
    }

    /**
     * Assert that resolve depth does not exceed the configured limit.
     *
     * @param depth - Current depth counter.
     * @throws {SecurityException} When depth exceeds the maximum.
     *
     * @example
     * parser.assertMaxResolveDepth(5); // OK
     */
    assertMaxResolveDepth(depth: number): void {
        if (depth > this.maxResolveDepth) {
            throw new SecurityException(
                `Deep merge exceeded maximum depth of ${this.maxResolveDepth}`,
            );
        }
    }

    /**
     * Assert that total key count does not exceed the limit.
     *
     * @param data - Data to count keys in.
     * @param maxKeys - Override limit, or undefined to use configured default.
     * @param maxCountDepth - Override recursion depth limit, or undefined for default.
     * @throws {SecurityException} When key count exceeds the limit.
     *
     * @example
     * parser.assertMaxKeys({ a: 1, b: 2 }); // OK
     */
    assertMaxKeys(data: Record<string, unknown>, maxKeys?: number, maxCountDepth?: number): void {
        const limit = maxKeys ?? this.maxKeys;
        const count = this.countKeys(data, 0, maxCountDepth ?? this.maxCountRecursiveDepth);

        if (count > limit) {
            throw new SecurityException(
                `Data contains ${count} keys, exceeding maximum of ${limit}.`,
            );
        }
    }

    /**
     * Assert that current recursion depth does not exceed the limit.
     *
     * @param currentDepth - Current depth counter.
     * @param maxDepth - Override limit, or undefined to use configured default.
     * @throws {SecurityException} When the depth exceeds the limit.
     *
     * @example
     * parser.assertMaxDepth(3); // OK
     */
    assertMaxDepth(currentDepth: number, maxDepth?: number): void {
        const limit = maxDepth ?? this.maxDepth;
        if (currentDepth > limit) {
            throw new SecurityException(
                `Recursion depth ${currentDepth} exceeds maximum of ${limit}.`,
            );
        }
    }

    /**
     * Assert that structural nesting depth does not exceed the policy limit.
     *
     * @param data - Data to measure structural depth of.
     * @param maxDepth - Maximum allowed structural depth.
     * @throws {SecurityException} When structural depth exceeds the limit.
     *
     * @example
     * parser.assertMaxStructuralDepth({ a: { b: 1 } }, 10); // OK
     */
    assertMaxStructuralDepth(data: unknown, maxDepth: number): void {
        const depth = this.measureDepth(data, 0, maxDepth + 1);
        if (depth > maxDepth) {
            throw new SecurityException(
                `Data structural depth ${depth} exceeds policy maximum of ${maxDepth}.`,
            );
        }
    }

    /**
     * Return the configured maximum structural nesting depth.
     *
     * @returns Maximum allowed depth.
     */
    getMaxDepth(): number {
        return this.maxDepth;
    }

    /**
     * Return the configured maximum path-resolve recursion depth.
     *
     * @returns Maximum allowed resolve depth.
     */
    getMaxResolveDepth(): number {
        return this.maxResolveDepth;
    }

    /**
     * Return the configured maximum total key count.
     *
     * @returns Maximum allowed key count.
     */
    getMaxKeys(): number {
        return this.maxKeys;
    }

    /**
     * Recursively count keys in a data structure.
     *
     * @param obj - Data to count keys in.
     * @param depth - Current recursion depth.
     * @param maxDepth - Maximum recursion depth for counting.
     * @returns Total number of keys found.
     */
    private countKeys(obj: unknown, depth: number, maxDepth: number): number {
        if (depth > maxDepth) {
            return 0;
        }

        if (typeof obj !== 'object' || obj === null) {
            return 0;
        }

        const entries = Object.entries(obj as Record<string, unknown>);
        let count = entries.length;

        for (const [, value] of entries) {
            count += this.countKeys(value, depth + 1, maxDepth);
        }

        return count;
    }

    /**
     * Recursively measure the maximum nesting depth of a data structure.
     *
     * @param value - Data to measure.
     * @param current - Current depth counter.
     * @param maxDepth - Ceiling to stop measuring.
     * @returns Maximum depth found.
     */
    private measureDepth(value: unknown, current: number, maxDepth: number): number {
        /* Stryker disable next-line ConditionalExpression,EqualityOperator -- equivalent: >= vs > at ceiling; both correctly stop at maxDepth */
        if (current >= maxDepth || typeof value !== 'object' || value === null) {
            return current;
        }

        let max = current;

        for (const child of Object.values(value as Record<string, unknown>)) {
            const d = this.measureDepth(child, current + 1, maxDepth);
            /* Stryker disable next-line ConditionalExpression,EqualityOperator -- equivalent: d > max vs d >= max; assigning d when d===max is a no-op */
            if (d > max) {
                max = d;
            }
        }

        return max;
    }

    private static clampOption(value: number | undefined, defaultValue: number): number {
        /* Stryker disable next-line ConditionalExpression -- equivalent: Number.isFinite covers undefined (isFinite(undefined)===false); simplest safe form */
        return Number.isFinite(value) ? (value as number) : defaultValue;
    }
}
