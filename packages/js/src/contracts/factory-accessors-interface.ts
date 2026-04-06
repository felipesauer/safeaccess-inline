/**
 * Contract for creating accessor instances from raw input.
 *
 * Note: this `from(data)` is the per-accessor hydrator, not
 * {@link Inline.from} which selects an accessor by TypeFormat.
 */
export interface FactoryAccessorsInterface {
    /**
     * Hydrate the accessor from raw input data.
     *
     * @param data - Raw input in the format expected by the accessor.
     * @returns Populated accessor instance.
     * @throws {InvalidFormatException} When the input cannot be parsed.
     */
    from(data: unknown): this;
}
