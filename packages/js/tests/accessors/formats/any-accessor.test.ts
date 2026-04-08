import { describe, expect, it } from 'vitest';
import { AnyAccessor } from '../../../src/accessors/formats/any-accessor.js';
import { DotNotationParser } from '../../../src/core/dot-notation-parser.js';
import { SecurityGuard } from '../../../src/security/security-guard.js';
import { SecurityParser } from '../../../src/security/security-parser.js';
import { InvalidFormatException } from '../../../src/exceptions/invalid-format-exception.js';
import { SecurityException } from '../../../src/exceptions/security-exception.js';
import { FakeParseIntegration } from '../../mocks/fake-parse-integration.js';

function makeParser(secParser?: SecurityParser): DotNotationParser {
    return new DotNotationParser(new SecurityGuard(), secParser ?? new SecurityParser());
}

describe(AnyAccessor.name, () => {
    it('accepts data when integration assertFormat returns true', () => {
        const integration = new FakeParseIntegration(true, { key: 'value' });
        const a = new AnyAccessor(makeParser(), integration).from('some data');
        expect(a.get('key')).toBe('value');
    });

    it('throws InvalidFormatException when integration rejects format', () => {
        const integration = new FakeParseIntegration(false, {});
        expect(() => new AnyAccessor(makeParser(), integration).from('data')).toThrow(
            InvalidFormatException,
        );
    });

    it('validates string payloads through assertPayload', () => {
        const secParser = new SecurityParser({ maxPayloadBytes: 3 });
        const parser = makeParser(secParser);
        const integration = new FakeParseIntegration(true, {});
        expect(() => new AnyAccessor(parser, integration).from('1234')).toThrow(SecurityException);
    });

    it('does not call assertPayload for non-string data', () => {
        const secParser = new SecurityParser({ maxPayloadBytes: 1 });
        const parser = makeParser(secParser);
        const integration = new FakeParseIntegration(true, { a: 1 });
        expect(() => new AnyAccessor(parser, integration).from({ x: 1 })).not.toThrow();
    });

    it('resolves nested path from parsed data', () => {
        const integration = new FakeParseIntegration(true, { user: { name: 'Alice' } });
        const a = new AnyAccessor(makeParser(), integration).from('anything');
        expect(a.get('user.name')).toBe('Alice');
    });

    it('error message mentions typeof when format is rejected', () => {
        const integration = new FakeParseIntegration(false, {});
        expect(() => new AnyAccessor(makeParser(), integration).from(42)).toThrow(/number/);
    });

    it('FakeParseIntegration default constructor accepts any input', () => {
        const integration = new FakeParseIntegration();
        expect(integration.assertFormat('test')).toBe(true);
    });
});
