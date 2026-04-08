import type { ParserInterface } from './parser-interface.js';

/**
 * Extended parser contract adding security validation capabilities.
 *
 * Adds structural validation and payload size assertion on top of
 * the base {@link ParserInterface} CRUD operations.
 *
 * @internal Not part of the public API - used only by AbstractAccessor internally.
 */
export interface ValidatableParserInterface extends ParserInterface {
    /**
     * Retrieve a value at the given path, throwing when not found.
     *
     * @param data - Source data object.
     * @param path - Dot-notation path.
     * @returns Resolved value.
     *
     * @throws {PathNotFoundException} When the path does not exist.
     */
    getStrict(data: Record<string, unknown>, path: string): unknown;

    /**
     * Validate data structure against security constraints.
     *
     * Assert key safety, maximum keys, and structural depth
     * using configured security guards and parser options.
     *
     * @param data - Data to validate.
     *
     * @throws {SecurityException} When any constraint is violated.
     */
    validate(data: Record<string, unknown>): void;

    /**
     * Assert that a raw string payload does not exceed size limits.
     *
     * @param input - Raw input string to check.
     *
     * @throws {SecurityException} When the payload exceeds the configured maximum.
     */
    assertPayload(input: string): void;

    /**
     * Return the configured maximum structural nesting depth.
     *
     * Used by accessors that perform their own recursive traversal
     * (e.g. ObjectAccessor) before the post-parse validation step runs.
     *
     * @returns Maximum allowed structural depth.
     */
    getMaxDepth(): number;

    /**
     * Return the configured maximum total key count.
     *
     * Used by format parsers that enforce a document element-count limit before
     * structural traversal runs. Accessor implementations that wrap XML parsers
     * can pass this value as an upper bound to prevent document-bombing attacks.
     *
     * @returns Maximum allowed key count.
     */
    getMaxKeys(): number;
}
