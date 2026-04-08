import { describe, expect, it } from 'vitest';
import { ArrayAccessor } from '../../../src/accessors/formats/array-accessor.js';
import { DotNotationParser } from '../../../src/core/dot-notation-parser.js';
import { SecurityGuard } from '../../../src/security/security-guard.js';
import { SecurityParser } from '../../../src/security/security-parser.js';
import { InvalidFormatException } from '../../../src/exceptions/invalid-format-exception.js';

function makeParser(secParser?: SecurityParser): DotNotationParser {
    return new DotNotationParser(new SecurityGuard(), secParser ?? new SecurityParser());
}

describe(ArrayAccessor.name, () => {
    it('accepts a plain object', () => {
        const a = new ArrayAccessor(makeParser()).from({ key: 'value' });
        expect(a.get('key')).toBe('value');
    });

    it('accepts an array, indexing by position', () => {
        const a = new ArrayAccessor(makeParser()).from(['a', 'b', 'c']);
        expect(a.get('0')).toBe('a');
        expect(a.get('2')).toBe('c');
    });

    it('throws InvalidFormatException for string input', () => {
        expect(() => new ArrayAccessor(makeParser()).from('string')).toThrow(
            InvalidFormatException,
        );
    });

    it('throws InvalidFormatException for null input', () => {
        expect(() => new ArrayAccessor(makeParser()).from(null)).toThrow(InvalidFormatException);
    });

    it('throws InvalidFormatException for number input', () => {
        expect(() => new ArrayAccessor(makeParser()).from(42)).toThrow(InvalidFormatException);
    });

    it('resolves a nested path in an array-ingested object', () => {
        const a = new ArrayAccessor(makeParser()).from({ user: { name: 'Alice' } });
        expect(a.get('user.name')).toBe('Alice');
    });
});
