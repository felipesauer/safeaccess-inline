import { describe, expect, it } from 'vitest';
import { YamlAccessor } from '../../../src/accessors/formats/yaml-accessor.js';
import { DotNotationParser } from '../../../src/core/dot-notation-parser.js';
import { SecurityGuard } from '../../../src/security/security-guard.js';
import { SecurityParser } from '../../../src/security/security-parser.js';
import { InvalidFormatException } from '../../../src/exceptions/invalid-format-exception.js';

function makeParser(secParser?: SecurityParser): DotNotationParser {
    return new DotNotationParser(new SecurityGuard(), secParser ?? new SecurityParser());
}

describe(YamlAccessor.name, () => {
    it('parses a valid YAML string', () => {
        const a = new YamlAccessor(makeParser()).from('name: Alice\nage: 30');
        expect(a.get('name')).toBe('Alice');
        expect(a.get('age')).toBe(30);
    });

    it('throws InvalidFormatException for non-string input', () => {
        expect(() => new YamlAccessor(makeParser()).from(null)).toThrow(InvalidFormatException);
    });

    it('throws InvalidFormatException for number input', () => {
        expect(() => new YamlAccessor(makeParser()).from(42)).toThrow(InvalidFormatException);
    });

    it('resolves a nested path', () => {
        const a = new YamlAccessor(makeParser()).from('user:\n  name: Bob');
        expect(a.get('user.name')).toBe('Bob');
    });

    it('returns null for a missing path', () => {
        const a = new YamlAccessor(makeParser()).from('key: value');
        expect(a.get('missing')).toBeNull();
    });
});
