import { describe, expect, it } from 'vitest';
import { IniAccessor } from '../../../src/accessors/formats/ini-accessor.js';
import { DotNotationParser } from '../../../src/core/dot-notation-parser.js';
import { SecurityGuard } from '../../../src/security/security-guard.js';
import { SecurityParser } from '../../../src/security/security-parser.js';
import { InvalidFormatException } from '../../../src/exceptions/invalid-format-exception.js';

function makeParser(secParser?: SecurityParser): DotNotationParser {
    return new DotNotationParser(new SecurityGuard(), secParser ?? new SecurityParser());
}

describe(IniAccessor.name, () => {
    it('parses flat key=value pairs', () => {
        const a = new IniAccessor(makeParser()).from('name=Alice\nage=30');
        expect(a.get('name')).toBe('Alice');
        expect(a.get('age')).toBe(30);
    });

    it('parses sections as nested keys', () => {
        const a = new IniAccessor(makeParser()).from('[db]\nhost=localhost\nport=5432');
        expect(a.get('db.host')).toBe('localhost');
        expect(a.get('db.port')).toBe(5432);
    });

    it('throws InvalidFormatException for non-string input', () => {
        expect(() => new IniAccessor(makeParser()).from(null)).toThrow(InvalidFormatException);
    });

    it('throws InvalidFormatException for number input', () => {
        expect(() => new IniAccessor(makeParser()).from(42)).toThrow(InvalidFormatException);
    });

    it('skips comment lines starting with #', () => {
        const a = new IniAccessor(makeParser()).from('# comment\nkey=value');
        expect(a.has('# comment')).toBe(false);
        expect(a.get('key')).toBe('value');
    });

    it('skips comment lines starting with ;', () => {
        const a = new IniAccessor(makeParser()).from('; comment\nkey=value');
        expect(a.get('key')).toBe('value');
    });

    it('skips blank lines', () => {
        const a = new IniAccessor(makeParser()).from('\nkey=value\n');
        expect(a.get('key')).toBe('value');
    });

    it('casts true, yes, on to boolean true', () => {
        const a = new IniAccessor(makeParser()).from('a=true\nb=yes\nc=on');
        expect(a.get('a')).toBe(true);
        expect(a.get('b')).toBe(true);
        expect(a.get('c')).toBe(true);
    });

    it('casts false, no, off, none to boolean false', () => {
        const a = new IniAccessor(makeParser()).from('a=false\nb=no\nc=off\nd=none');
        expect(a.get('a')).toBe(false);
        expect(a.get('b')).toBe(false);
        expect(a.get('c')).toBe(false);
        expect(a.get('d')).toBe(false);
    });

    it('casts null and empty string to null', () => {
        const a = new IniAccessor(makeParser()).from('a=null\nb=');
        expect(a.get('a')).toBeNull();
        expect(a.get('b')).toBeNull();
    });

    it('strips surrounding double quotes', () => {
        const a = new IniAccessor(makeParser()).from('msg="hello world"');
        expect(a.get('msg')).toBe('hello world');
    });

    it('strips surrounding single quotes', () => {
        const a = new IniAccessor(makeParser()).from("msg='hello world'");
        expect(a.get('msg')).toBe('hello world');
    });

    it('casts integer values', () => {
        const a = new IniAccessor(makeParser()).from('port=3306');
        expect(a.get('port')).toBe(3306);
    });

    it('casts float values', () => {
        const a = new IniAccessor(makeParser()).from('ratio=3.14');
        expect(a.get('ratio')).toBe(3.14);
    });

    it('skips lines without = sign', () => {
        const a = new IniAccessor(makeParser()).from('badline\nkey=value');
        expect(a.has('badline')).toBe(false);
    });

    it('parses multiple sections', () => {
        const a = new IniAccessor(makeParser()).from('[app]\nname=MyApp\n[db]\nhost=localhost');
        expect(a.get('app.name')).toBe('MyApp');
        expect(a.get('db.host')).toBe('localhost');
    });

    it('error message from from() includes the actual typeof data', () => {
        expect(() => new IniAccessor(makeParser()).from(42)).toThrow(/number/);
    });

    it('preserves existing section keys when section header appears twice', () => {
        const a = new IniAccessor(makeParser()).from('[db]\nhost=localhost\n[db]\nport=5432');
        expect(a.get('db.host')).toBe('localhost');
        expect(a.get('db.port')).toBe(5432);
    });

    it('trims whitespace from key names and raw values', () => {
        const a = new IniAccessor(makeParser()).from('  name  =  Alice  ');
        expect(a.get('name')).toBe('Alice');
    });

    it('parses section with underscored name', () => {
        const a = new IniAccessor(makeParser()).from('[my_section]\nkey=val');
        expect(a.get('my_section.key')).toBe('val');
    });

    it('does not strip double quotes when only one side is present', () => {
        const a = new IniAccessor(makeParser()).from('key=hello"');
        expect(a.get('key')).toBe('hello"');
    });

    it('does not strip single quotes when only one side is present', () => {
        const a = new IniAccessor(makeParser()).from("key=hello'");
        expect(a.get('key')).toBe("hello'");
    });

    it('does not strip double quotes when value starts without quote', () => {
        const a = new IniAccessor(makeParser()).from('key="hello');
        expect(a.get('key')).toBe('"hello');
    });

    it('does not strip single quotes when value starts without quote', () => {
        const a = new IniAccessor(makeParser()).from("key='hello");
        expect(a.get('key')).toBe("'hello");
    });

    it('does not cast string with trailing non-digit characters as integer', () => {
        const a = new IniAccessor(makeParser()).from('version=3.0-beta');
        expect(typeof a.get('version')).toBe('string');
    });

    it('does not cast string with leading non-digit chars as integer', () => {
        const a = new IniAccessor(makeParser()).from('version=v42');
        expect(typeof a.get('version')).toBe('string');
    });

    it('does not cast a version string like 3.1.4 as float', () => {
        const a = new IniAccessor(makeParser()).from('ver=3.1.4');
        expect(typeof a.get('ver')).toBe('string');
    });

    it('casts "yes" to boolean true', () => {
        const a = new IniAccessor(makeParser()).from('flag=yes');
        expect(a.get('flag')).toBe(true);
    });

    it('casts "no" to boolean false', () => {
        const a = new IniAccessor(makeParser()).from('flag=no');
        expect(a.get('flag')).toBe(false);
    });

    it('casts "none" to boolean false', () => {
        const a = new IniAccessor(makeParser()).from('flag=none');
        expect(a.get('flag')).toBe(false);
    });

    it('does not treat key=value containing [brackets] as section header', () => {
        const a = new IniAccessor(makeParser()).from('key=value[brackets]\nother=1');
        expect(a.get('key')).toBe('value[brackets]');
        expect(a.get('other')).toBe(1);
    });

    it('casts a two-digit integer before decimal point to float', () => {
        const a = new IniAccessor(makeParser()).from('ratio=10.5');
        expect(a.get('ratio')).toBe(10.5);
    });

    it('casts negative float with two-digit integer part correctly', () => {
        const a = new IniAccessor(makeParser()).from('offset=-12.75');
        expect(a.get('offset')).toBe(-12.75);
    });
});
