/**
 * Contract for custom format detection and parsing integration.
 *
 * Enables the {@link AnyAccessor} to accept arbitrary input by delegating
 * format validation and parsing to a user-provided implementation.
 *
 * @example
 * class CsvIntegration implements ParseIntegrationInterface {
 *   assertFormat(raw: unknown): boolean { return typeof raw === 'string' && raw.includes(','); }
 *   parse(raw: unknown): Record<string, unknown> { ... }
 * }
 * const accessor = Inline.withParserIntegration(new CsvIntegration()).fromAny(csvString);
 */
export interface ParseIntegrationInterface {
    /**
     * Determine whether the given raw input is in a supported format.
     *
     * @param raw - Raw input data to validate.
     * @returns `true` if the input can be parsed by this integration.
     */
    assertFormat(raw: unknown): boolean;

    /**
     * Parse raw input data into a normalized plain object.
     *
     * Called only after {@link assertFormat} returns `true`.
     *
     * @param raw - Raw input data previously validated by {@link assertFormat}.
     * @returns Parsed data as a nested plain object.
     */
    parse(raw: unknown): Record<string, unknown>;
}
