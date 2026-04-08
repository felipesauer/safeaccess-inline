import { describe, expect, it } from 'vitest';
import { EnvAccessor } from '../../../src/accessors/formats/env-accessor.js';
import { DotNotationParser } from '../../../src/core/dot-notation-parser.js';
import { SecurityGuard } from '../../../src/security/security-guard.js';
import { SecurityParser } from '../../../src/security/security-parser.js';
import { InvalidFormatException } from '../../../src/exceptions/invalid-format-exception.js';

function makeParser(secParser?: SecurityParser): DotNotationParser {
    return new DotNotationParser(new SecurityGuard(), secParser ?? new SecurityParser());
}

describe(EnvAccessor.name, () => {
    it('parses KEY=VALUE pairs', () => {
        const a = new EnvAccessor(makeParser()).from('DB_HOST=localhost\nPORT=5432');
        expect(a.get('DB_HOST')).toBe('localhost');
        expect(a.get('PORT')).toBe('5432');
    });

    it('skips comment lines', () => {
        const a = new EnvAccessor(makeParser()).from('# comment\nKEY=value');
        expect(a.has('# comment')).toBe(false);
        expect(a.get('KEY')).toBe('value');
    });

    it('skips blank lines', () => {
        const a = new EnvAccessor(makeParser()).from('\nKEY=value\n');
        expect(a.get('KEY')).toBe('value');
    });

    it('strips double quotes from values', () => {
        const a = new EnvAccessor(makeParser()).from('MSG="hello world"');
        expect(a.get('MSG')).toBe('hello world');
    });

    it('strips single quotes from values', () => {
        const a = new EnvAccessor(makeParser()).from("MSG='hello world'");
        expect(a.get('MSG')).toBe('hello world');
    });

    it('skips lines without = sign', () => {
        const a = new EnvAccessor(makeParser()).from('INVALID_LINE\nKEY=value');
        expect(a.has('INVALID_LINE')).toBe(false);
        expect(a.get('KEY')).toBe('value');
    });

    it('throws InvalidFormatException for non-string input', () => {
        expect(() => new EnvAccessor(makeParser()).from(123)).toThrow(InvalidFormatException);
    });

    it('throws InvalidFormatException for null input', () => {
        expect(() => new EnvAccessor(makeParser()).from(null)).toThrow(InvalidFormatException);
    });

    it('handles KEY= with no value (empty string)', () => {
        const a = new EnvAccessor(makeParser()).from('EMPTY=');
        expect(a.get('EMPTY')).toBe('');
    });

    it('handles value with multiple = signs', () => {
        const a = new EnvAccessor(makeParser()).from('JWT=a=b=c');
        expect(a.get('JWT')).toBe('a=b=c');
    });

    it('trims whitespace from key names', () => {
        const a = new EnvAccessor(makeParser()).from('  KEY  =value');
        expect(a.get('KEY')).toBe('value');
    });

    it('trims whitespace from values', () => {
        const a = new EnvAccessor(makeParser()).from('KEY=  trimmed  ');
        expect(a.get('KEY')).toBe('trimmed');
    });

    it('does not strip double quotes when only one side is present', () => {
        const a = new EnvAccessor(makeParser()).from('KEY=hello"');
        expect(a.get('KEY')).toBe('hello"');
    });

    it('does not strip double quotes when value starts without quote', () => {
        const a = new EnvAccessor(makeParser()).from('KEY="hello');
        expect(a.get('KEY')).toBe('"hello');
    });

    it('does not strip single quotes when only one side is present', () => {
        const a = new EnvAccessor(makeParser()).from("KEY=hello'");
        expect(a.get('KEY')).toBe("hello'");
    });

    it('does not strip single quotes when value starts without quote', () => {
        const a = new EnvAccessor(makeParser()).from("KEY='hello");
        expect(a.get('KEY')).toBe("'hello");
    });

    it('skips lines starting with # even if they contain =', () => {
        const a = new EnvAccessor(makeParser()).from('# KEY=value\nREAL=ok');
        expect(a.has('# KEY')).toBe(false);
        expect(a.get('REAL')).toBe('ok');
    });

    it('error message from from() includes the actual typeof data', () => {
        expect(() => new EnvAccessor(makeParser()).from(42)).toThrow(/number/);
    });
});
