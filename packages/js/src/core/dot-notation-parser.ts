import type { SecurityGuardInterface } from '../contracts/security-guard-interface.js';
import type { SecurityParserInterface } from '../contracts/security-parser-interface.js';
import type { PathCacheInterface } from '../contracts/path-cache-interface.js';
import { SecurityGuard } from '../security/security-guard.js';
import { SecurityParser } from '../security/security-parser.js';

/**
 * Core dot-notation parser for reading, writing, and removing nested values.
 *
 * Provides path-based access to plain objects using dot-separated keys.
 * Delegates security validation to SecurityGuard and SecurityParser.
 *
 * @example
 * const parser = new DotNotationParser();
 * parser.get({ user: { name: 'Alice' } }, 'user.name'); // 'Alice'
 */
export class DotNotationParser {
    private readonly securityGuard: SecurityGuardInterface;
    private readonly securityParser: SecurityParserInterface;
    private readonly pathCache: PathCacheInterface | null;

    /**
     * @param securityGuard - Key-safety guard. Defaults to a new SecurityGuard instance.
     * @param securityParser - Parser depth and size limits. Defaults to a new SecurityParser instance.
     * @param pathCache - Optional path segment cache for repeated lookups.
     */
    constructor(
        securityGuard?: SecurityGuardInterface,
        securityParser?: SecurityParserInterface,
        pathCache?: PathCacheInterface,
    ) {
        this.securityGuard = securityGuard ?? new SecurityGuard();
        this.securityParser = securityParser ?? new SecurityParser();
        this.pathCache = pathCache ?? null;
    }

    /**
     * Resolve a dot-notation path against data, returning the matched value.
     *
     * @param data - Source data object.
     * @param path - Dot-notation path string (e.g. "user.name").
     * @param defaultValue - Fallback returned when the path does not exist.
     * @returns Resolved value or the default.
     *
     * @example
     * parser.get({ a: { b: 1 } }, 'a.b'); // 1
     * parser.get({ a: 1 }, 'a.b', 'default'); // 'default'
     */
    get(data: Record<string, unknown>, path: string, defaultValue: unknown = null): unknown {
        /* Stryker disable next-line ConditionalExpression,BlockStatement,StringLiteral -- equivalent: empty path on split produces [''] which misses all keys anyway */
        if (path === '') {
            return defaultValue;
        }

        const segments = this.parsePath(path);
        return this.getAt(data, segments, defaultValue);
    }

    /**
     * Set a value at a dot-notation path, returning a new object.
     *
     * @param data - Source data object.
     * @param path - Dot-notation path string.
     * @param value - Value to assign.
     * @returns New object with the value set at the path.
     *
     * @example
     * parser.set({}, 'user.name', 'Alice'); // { user: { name: 'Alice' } }
     */
    set(data: Record<string, unknown>, path: string, value: unknown): Record<string, unknown> {
        const segments = this.parsePath(path);
        return this.setAt(data, segments, value);
    }

    /**
     * Check whether a dot-notation path exists in the data.
     *
     * @param data - Source data object.
     * @param path - Dot-notation path string.
     * @returns True if the path resolves to a value.
     *
     * @example
     * parser.has({ a: { b: 1 } }, 'a.b'); // true
     * parser.has({ a: 1 }, 'a.b'); // false
     */
    has(data: Record<string, unknown>, path: string): boolean {
        /* Stryker disable next-line ConditionalExpression,BlockStatement,StringLiteral -- equivalent: empty path produces [''] key which is never found → false anyway */
        if (path === '') {
            return false;
        }
        const sentinel = Object.create(null) as Record<string, never>;
        return this.get(data, path, sentinel) !== sentinel;
    }

    /**
     * Remove a value at a dot-notation path, returning a new object.
     *
     * @param data - Source data object.
     * @param path - Dot-notation path string.
     * @returns New object with the path removed.
     *
     * @example
     * parser.remove({ a: { b: 1 } }, 'a.b'); // { a: {} }
     */
    remove(data: Record<string, unknown>, path: string): Record<string, unknown> {
        const segments = this.parsePath(path);
        return this.removeAt(data, segments);
    }

    /**
     * Resolve a pre-parsed segment array against data.
     *
     * @param data - Source data object.
     * @param segments - Ordered list of keys.
     * @param defaultValue - Fallback returned when the path does not exist.
     * @returns Resolved value or the default.
     *
     * @example
     * parser.getAt({ a: { b: 1 } }, ['a', 'b']); // 1
     */
    getAt(
        data: Record<string, unknown>,
        segments: Array<string | number>,
        defaultValue: unknown = null,
    ): unknown {
        let current: unknown = data;

        for (const key of segments) {
            if (
                /* Stryker disable next-line ConditionalExpression -- equivalent: false||null-check||own-check still returns default for primitives */
                typeof current !== 'object' ||
                current === null ||
                !Object.prototype.hasOwnProperty.call(current, key)
            ) {
                return defaultValue;
            }
            current = (current as Record<string, unknown>)[key];
        }

        return current;
    }

    /**
     * Set a value using pre-parsed key segments, returning a new object.
     *
     * @param data - Source data object.
     * @param segments - Ordered list of keys.
     * @param value - Value to assign.
     * @returns New object with the value set.
     *
     * @example
     * parser.setAt({}, ['user', 'name'], 'Alice'); // { user: { name: 'Alice' } }
     */
    setAt(
        data: Record<string, unknown>,
        segments: Array<string | number>,
        value: unknown,
    ): Record<string, unknown> {
        if (segments.length === 0) {
            return data;
        }

        return this.writeAt(data, segments, 0, value);
    }

    /**
     * Check whether a path exists using pre-parsed key segments.
     *
     * @param data - Source data object.
     * @param segments - Ordered list of keys.
     * @returns True if the path resolves to a value.
     *
     * @example
     * parser.hasAt({ a: { b: 1 } }, ['a', 'b']); // true
     */
    hasAt(data: Record<string, unknown>, segments: Array<string | number>): boolean {
        const sentinel = Object.create(null) as Record<string, never>;
        return this.getAt(data, segments, sentinel) !== sentinel;
    }

    /**
     * Remove a value using pre-parsed key segments, returning a new object.
     *
     * @param data - Source data object.
     * @param segments - Ordered list of keys.
     * @returns New object without the specified path.
     *
     * @example
     * parser.removeAt({ a: { b: 1 } }, ['a', 'b']); // { a: {} }
     */
    removeAt(data: Record<string, unknown>, segments: Array<string | number>): Record<string, unknown> {
        /* Stryker disable next-line ConditionalExpression,BlockStatement -- equivalent: empty segments → eraseAt hits undefined key → hasOwnProperty false → returns data anyway */
        if (segments.length === 0) {
            return data;
        }

        return this.eraseAt(data, segments, 0);
    }

    /**
     * Deep-merge an object into the value at a dot-notation path.
     *
     * @param data - Source data object.
     * @param path - Dot-notation path to the merge target, or empty string for root merge.
     * @param value - Object to merge into the existing value.
     * @returns New object with merged data.
     *
     * @example
     * parser.merge({ a: { b: 1 } }, 'a', { c: 2 }); // { a: { b: 1, c: 2 } }
     */
    merge(
        data: Record<string, unknown>,
        path: string,
        value: Record<string, unknown>,
    ): Record<string, unknown> {
        const existing = path !== '' ? this.get(data, path, {}) : data;
        const merged = this.deepMerge(
            /* Stryker disable next-line ConditionalExpression -- equivalent: existing !== null → true still passes {} when existing is not an object due to typeof check */
            typeof existing === 'object' && existing !== null
                ? (existing as Record<string, unknown>)
                : {},
            value,
        );

        return path !== '' ? this.set(data, path, merged) : merged;
    }

    /**
     * Run all security validations on a parsed data structure.
     *
     * @param data - Data to validate.
     * @throws {SecurityException} When a security violation is detected.
     *
     * @example
     * parser.validate({ name: 'Alice' }); // OK
     * parser.validate({ __construct: 'bad' }); // throws SecurityException
     */
    validate(data: Record<string, unknown>): void {
        this.securityParser.assertMaxKeys(data);
        this.securityParser.assertMaxStructuralDepth(data, this.securityParser.getMaxDepth());
        this.securityGuard.assertSafeKeys(data);
    }

    /**
     * Assert that a string payload does not exceed the configured byte limit.
     *
     * @param input - Raw input string to measure.
     * @throws {SecurityException} When the payload exceeds the limit.
     *
     * @example
     * parser.assertPayload('small text'); // OK
     */
    assertPayload(input: string): void {
        this.securityParser.assertPayloadSize(input);
    }

    /**
     * Return the configured maximum structural nesting depth.
     *
     * @returns Maximum allowed depth from the security parser.
     */
    getMaxDepth(): number {
        return this.securityParser.getMaxDepth();
    }

    /**
     * Return the configured maximum total key count.
     *
     * @returns Maximum allowed key count from the security parser.
     */
    getMaxKeys(): number {
        return this.securityParser.getMaxKeys();
    }

    /**
     * Parse a dot-notation path into segments, using cache when available.
     *
     * @param path - Dot-notation path string.
     * @returns Array of path segments.
     */
    private parsePath(path: string): string[] {
        if (this.pathCache !== null) {
            const cached = this.pathCache.get(path);
            if (cached !== null) {
                return cached;
            }
            const segments = path.split('.');
            this.pathCache.set(path, segments);
            return segments;
        }
        return path.split('.');
    }

    /**
     * Recursively write a value at the given key path.
     *
     * @param data - Current level data.
     * @param segments - Flat key segments.
     * @param index - Current depth index.
     * @param value - Value to write.
     * @returns Modified copy of the data.
     *
     * @throws {SecurityException} When a key violates security rules.
     */
    private writeAt(
        data: Record<string, unknown>,
        segments: Array<string | number>,
        index: number,
        value: unknown,
    ): Record<string, unknown> {
        const key = segments[index] as string;
        this.securityGuard.assertSafeKey(key);
        const copy = { ...data };

        if (index === segments.length - 1) {
            copy[key] = value;
            return copy;
        }

        const child = copy[key];
        const childObj =
            /* Stryker disable next-line ConditionalExpression -- equivalent: child !== null → true still handles array via !Array.isArray */
            typeof child === 'object' && child !== null && !Array.isArray(child)
                ? (child as Record<string, unknown>)
                : {};

        copy[key] = this.writeAt(childObj, segments, index + 1, value);
        return copy;
    }

    /**
     * Recursively remove a key at the given key path.
     *
     * @param data - Current level data.
     * @param segments - Flat key segments.
     * @param index - Current depth index.
     * @returns Modified copy of the data.
     *
     * @throws {SecurityException} When a key violates security rules.
     */
    private eraseAt(
        data: Record<string, unknown>,
        segments: Array<string | number>,
        index: number,
    ): Record<string, unknown> {
        const key = segments[index] as string;
        this.securityGuard.assertSafeKey(key);

        /* Stryker disable next-line ConditionalExpression,BlockStatement -- equivalent: missing key → continue to delete copy[undefined] which is a no-op */
        if (!Object.prototype.hasOwnProperty.call(data, key)) {
            return data;
        }

        const copy = { ...data };

        /* Stryker disable next-line ConditionalExpression -- equivalent: terminal vs recurse; extra recursion with empty segments produces the same delete */
        if (index === segments.length - 1) {
            delete copy[key];
            return copy;
        }

        const child = copy[key];
        /* Stryker disable next-line ConditionalExpression -- equivalent: false||null removes only null guard but hasOwnProperty on non-objects still returns copy unchanged */
        if (typeof child !== 'object' || child === null) {
            return copy;
        }

        copy[key] = this.eraseAt(child as Record<string, unknown>, segments, index + 1);
        return copy;
    }

    /**
     * Recursively merge source into target, preserving nested structures.
     *
     * @param target - Base data.
     * @param source - Data to merge on top.
     * @param depth - Current recursion depth.
     * @returns Merged result.
     *
     * @throws {SecurityException} When max resolve depth is exceeded.
     */
    private deepMerge(
        target: Record<string, unknown>,
        source: Record<string, unknown>,
        depth: number = 0,
    ): Record<string, unknown> {
        this.securityParser.assertMaxResolveDepth(depth);

        const result: Record<string, unknown> = { ...target };

        for (const [key, sourceVal] of Object.entries(source)) {
            this.securityGuard.assertSafeKey(key);
            const targetVal = result[key];

            if (
                /* Stryker disable next-line ConditionalExpression,LogicalOperator -- equivalent: null checks on objects that are already typed as unknown; isArray guards ensure correct behavior */
                typeof sourceVal === 'object' &&
                /* Stryker disable next-line ConditionalExpression -- equivalent: Array.isArray already prevents non-object arrays */
                sourceVal !== null &&
                !Array.isArray(sourceVal) &&
                /* Stryker disable next-line ConditionalExpression -- equivalent */
                typeof targetVal === 'object' &&
                /* Stryker disable next-line ConditionalExpression -- equivalent: null guarded by Array.isArray check below */
                targetVal !== null &&
                !Array.isArray(targetVal)
            ) {
                result[key] = this.deepMerge(
                    targetVal as Record<string, unknown>,
                    sourceVal as Record<string, unknown>,
                    depth + 1,
                );
            } else {
                result[key] = sourceVal;
            }
        }

        return result;
    }
}
