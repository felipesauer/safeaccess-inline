import { describe, expect, it } from 'vitest';
import { AbstractIntegrationAccessor } from '../../src/accessors/abstract-integration-accessor.js';
import type { ParseIntegrationInterface } from '../../src/contracts/parse-integration-interface.js';
import type { ValidatableParserInterface } from '../../src/contracts/validatable-parser-interface.js';
import { DotNotationParser } from '../../src/core/dot-notation-parser.js';
import { SecurityGuard } from '../../src/security/security-guard.js';
import { SecurityParser } from '../../src/security/security-parser.js';
import { FakeParseIntegration } from '../mocks/fake-parse-integration.js';

class ConcreteIntegrationAccessor extends AbstractIntegrationAccessor {
    protected parse(raw: unknown): Record<string, unknown> {
        return raw as Record<string, unknown>;
    }
}

function makeParser(): ValidatableParserInterface {
    return new DotNotationParser(new SecurityGuard(), new SecurityParser());
}

describe(AbstractIntegrationAccessor.name, () => {
    it('accepts a ValidatableParserInterface and ParseIntegrationInterface', () => {
        const parser = makeParser();
        const integration = new FakeParseIntegration();
        const accessor = new ConcreteIntegrationAccessor(parser, integration);

        expect(accessor).toBeInstanceOf(AbstractIntegrationAccessor);
    });

    it('exposes the integration property to subclasses', () => {
        const integration = new FakeParseIntegration(true, { key: 'value' });
        const accessor = new ConcreteIntegrationAccessor(makeParser(), integration);

        expect(
            (accessor as unknown as { integration: ParseIntegrationInterface }).integration,
        ).toBe(integration);
    });
});
