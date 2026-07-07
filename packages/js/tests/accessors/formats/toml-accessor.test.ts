import { describe, expect, it } from 'vitest';
import { TomlAccessor } from '../../../src/accessors/formats/toml-accessor.js';
import { DotNotationParser } from '../../../src/core/dot-notation-parser.js';
import { SecurityGuard } from '../../../src/security/security-guard.js';
import { SecurityParser } from '../../../src/security/security-parser.js';
import { InvalidFormatException } from '../../../src/exceptions/invalid-format-exception.js';

function makeParser(secParser?: SecurityParser): DotNotationParser {
    return new DotNotationParser(new SecurityGuard(), secParser ?? new SecurityParser());
}

describe(TomlAccessor.name, () => {
    it('parses a valid TOML string', () => {
        const a = new TomlAccessor(makeParser()).from('name = "Alice"\nage = 30');
        expect(a.get('name')).toBe('Alice');
        expect(a.get('age')).toBe(30);
    });

    it('throws InvalidFormatException for non-string input', () => {
        expect(() => new TomlAccessor(makeParser()).from(null)).toThrow(InvalidFormatException);
    });

    it('throws InvalidFormatException for number input', () => {
        expect(() => new TomlAccessor(makeParser()).from(42)).toThrow(InvalidFormatException);
    });

    it('resolves a nested table path', () => {
        const a = new TomlAccessor(makeParser()).from('[server]\nhost = "0.0.0.0"');
        expect(a.get('server.host')).toBe('0.0.0.0');
    });

    it('resolves an array-of-tables path', () => {
        const a = new TomlAccessor(makeParser()).from('[[p]]\nn = "A"\n[[p]]\nn = "B"');
        expect(a.get('p.0.n')).toBe('A');
        expect(a.get('p.1.n')).toBe('B');
    });

    it('returns null for a missing path', () => {
        const a = new TomlAccessor(makeParser()).from('key = "value"');
        expect(a.get('missing')).toBeNull();
    });

    it('stores the raw input', () => {
        const raw = '[server]\nport = 8000';
        const a = new TomlAccessor(makeParser()).from(raw);
        expect(a.getRaw()).toBe(raw);
    });
});
