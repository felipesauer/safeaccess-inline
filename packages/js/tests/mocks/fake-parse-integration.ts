import type { ParseIntegrationInterface } from '../../src/contracts/parse-integration-interface.js';

/**
 * Fake ParseIntegrationInterface for use in tests.
 *
 * @internal
 */
export class FakeParseIntegration implements ParseIntegrationInterface {
    private readonly accepts: boolean;
    private readonly parsed: Record<string, unknown>;

    constructor(accepts: boolean = true, parsed: Record<string, unknown> = {}) {
        this.accepts = accepts;
        this.parsed = parsed;
    }

    assertFormat(_raw: unknown): boolean {
        return this.accepts;
    }

    parse(_raw: unknown): Record<string, unknown> {
        return this.parsed;
    }
}
