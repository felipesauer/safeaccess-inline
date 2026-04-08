import { describe, expect, it } from 'vitest';
import { NdjsonAccessor } from '../../../src/accessors/formats/ndjson-accessor.js';
import { DotNotationParser } from '../../../src/core/dot-notation-parser.js';
import { SecurityGuard } from '../../../src/security/security-guard.js';
import { SecurityParser } from '../../../src/security/security-parser.js';
import { InvalidFormatException } from '../../../src/exceptions/invalid-format-exception.js';

function makeParser(secParser?: SecurityParser): DotNotationParser {
    return new DotNotationParser(new SecurityGuard(), secParser ?? new SecurityParser());
}

describe(NdjsonAccessor.name, () => {
    it('parses two NDJSON lines', () => {
        const a = new NdjsonAccessor(makeParser()).from('{"id":1}\n{"id":2}');
        expect(a.get('0.id')).toBe(1);
        expect(a.get('1.id')).toBe(2);
    });

    it('throws InvalidFormatException for non-string input', () => {
        expect(() => new NdjsonAccessor(makeParser()).from(null)).toThrow(InvalidFormatException);
    });

    it('throws InvalidFormatException for number input', () => {
        expect(() => new NdjsonAccessor(makeParser()).from(42)).toThrow(InvalidFormatException);
    });

    it('returns empty object for blank-only input', () => {
        const a = new NdjsonAccessor(makeParser()).from('   \n  \n');
        expect(a.all()).toEqual({});
    });

    it('skips blank lines between valid lines', () => {
        const a = new NdjsonAccessor(makeParser()).from('{"id":1}\n\n{"id":2}');
        expect(a.get('0.id')).toBe(1);
        expect(a.get('1.id')).toBe(2);
    });

    it('throws InvalidFormatException for malformed JSON line', () => {
        expect(() => new NdjsonAccessor(makeParser()).from('{"ok":1}\n{not valid}')).toThrow(
            InvalidFormatException,
        );
    });

    it('error message contains the failing line number', () => {
        expect(() => new NdjsonAccessor(makeParser()).from('{"ok":1}\n{not valid}')).toThrow(
            /line 2/,
        );
    });
});
