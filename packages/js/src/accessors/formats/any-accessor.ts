import { AbstractAccessor } from '../abstract-accessor.js';
import type { ParseIntegrationInterface } from '../../contracts/parse-integration-interface.js';
import type { DotNotationParser } from '../../core/dot-notation-parser.js';
import { InvalidFormatException } from '../../exceptions/invalid-format-exception.js';

/**
 * Accessor for arbitrary formats via a custom {@link ParseIntegrationInterface}.
 *
 * Delegates format detection and parsing to a user-provided integration.
 * Validates string payloads against security constraints before parsing.
 *
 * @example
 * const integration = new MyCsvIntegration();
 * const accessor = Inline.withParserIntegration(integration).fromAny(csvString);
 * accessor.get('0.name'); // first row, name column
 */
export class AnyAccessor extends AbstractAccessor {
    private readonly integration: ParseIntegrationInterface;

    /**
     * @param parser      - Dot-notation parser with security configuration.
     * @param integration - Custom format parser for detecting and parsing input.
     */
    constructor(parser: DotNotationParser, integration: ParseIntegrationInterface) {
        super(parser);
        this.integration = integration;
    }

    /**
     * Hydrate from raw data via the custom integration.
     *
     * @param data - Raw input data in any format supported by the integration.
     * @returns Populated accessor instance.
     * @throws {InvalidFormatException} When the integration rejects the format.
     * @throws {SecurityException} When string input violates payload-size limits.
     */
    from(data: unknown): this {
        if (!this.integration.assertFormat(data)) {
            throw new InvalidFormatException(`AnyAccessor failed, got ${typeof data}`);
        }

        return this.ingest(data);
    }

    /**
     * @internal
     */
    protected parse(raw: unknown): Record<string, unknown> {
        return this.integration.parse(raw);
    }
}
