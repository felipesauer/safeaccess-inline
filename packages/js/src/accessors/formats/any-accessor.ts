import { AbstractIntegrationAccessor } from '../abstract-integration-accessor.js';
import type { ParseIntegrationInterface } from '../../contracts/parse-integration-interface.js';
import type { ValidatableParserInterface } from '../../contracts/validatable-parser-interface.js';
import { InvalidFormatException } from '../../exceptions/invalid-format-exception.js';

/**
 * Accessor for arbitrary formats via a custom {@link ParseIntegrationInterface}.
 *
 * Delegates format detection and parsing to a user-provided integration.
 * Validates string payloads against security constraints before parsing.
 *
 * @api
 *
 * @example
 * const integration = new MyCsvIntegration();
 * const accessor = Inline.withParserIntegration(integration).fromAny(csvString);
 * accessor.get('0.name'); // first row, name column
 */
export class AnyAccessor extends AbstractIntegrationAccessor {
    /**
     * @param parser      - Dot-notation parser with security configuration.
     * @param integration - Custom format parser for detecting and parsing input.
     */
    constructor(parser: ValidatableParserInterface, integration: ParseIntegrationInterface) {
        super(parser, integration);
    }

    /**
     * Hydrate from raw data via the custom integration.
     *
     * @param data - Raw input data in any format supported by the integration.
     * @returns Populated accessor instance.
     * @throws {InvalidFormatException} When the integration rejects the format.
     * @throws {SecurityException} When string input violates payload-size limits.
     *
     * @example
     * const accessor = new AnyAccessor(parser, integration).from(rawData);
     */
    from(data: unknown): this {
        if (!this.integration.assertFormat(data)) {
            throw new InvalidFormatException(`AnyAccessor failed, got ${typeof data}`);
        }

        return this.ingest(data);
    }

    /** {@inheritDoc} */
    protected parse(raw: unknown): Record<string, unknown> {
        return this.integration.parse(raw);
    }
}
