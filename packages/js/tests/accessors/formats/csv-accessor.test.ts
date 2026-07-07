import { describe, expect, it } from 'vitest';
import { CsvAccessor } from '../../../src/accessors/formats/csv-accessor.js';
import { DotNotationParser } from '../../../src/core/dot-notation-parser.js';
import { SecurityGuard } from '../../../src/security/security-guard.js';
import { SecurityParser } from '../../../src/security/security-parser.js';
import { InvalidFormatException } from '../../../src/exceptions/invalid-format-exception.js';
import { SecurityException } from '../../../src/exceptions/security-exception.js';

function makeParser(secParser?: SecurityParser): DotNotationParser {
    return new DotNotationParser(new SecurityGuard(), secParser ?? new SecurityParser());
}

describe(CsvAccessor.name, () => {
    it('parses a valid CSV string', () => {
        const a = new CsvAccessor(makeParser()).from('name,age\nAlice,30');
        expect(a.get('0.name')).toBe('Alice');
        expect(a.get('0.age')).toBe('30');
    });

    it('resolves multiple rows by index', () => {
        const a = new CsvAccessor(makeParser()).from('name\nAlice\nBob');
        expect(a.get('0.name')).toBe('Alice');
        expect(a.get('1.name')).toBe('Bob');
    });

    it('throws InvalidFormatException for non-string input', () => {
        expect(() => new CsvAccessor(makeParser()).from(null)).toThrow(InvalidFormatException);
    });

    it('throws InvalidFormatException for number input', () => {
        expect(() => new CsvAccessor(makeParser()).from(42)).toThrow(InvalidFormatException);
    });

    it('returns null for a missing path', () => {
        const a = new CsvAccessor(makeParser()).from('name\nAlice');
        expect(a.get('5.name')).toBeNull();
    });

    it('stores the raw input', () => {
        const raw = 'name,age\nAlice,30';
        const a = new CsvAccessor(makeParser()).from(raw);
        expect(a.getRaw()).toBe(raw);
    });

    it('blocks a forbidden key used as a header column', () => {
        expect(() => new CsvAccessor(makeParser()).from('__proto__\nx')).toThrow(SecurityException);
    });
});
