import { describe, expect, it } from 'vitest';
import { XmlAccessor } from '../../../src/accessors/formats/xml-accessor.js';
import { DotNotationParser } from '../../../src/core/dot-notation-parser.js';
import { SecurityGuard } from '../../../src/security/security-guard.js';
import { SecurityParser } from '../../../src/security/security-parser.js';
import { InvalidFormatException } from '../../../src/exceptions/invalid-format-exception.js';
import { SecurityException } from '../../../src/exceptions/security-exception.js';

function makeParser(secParser?: SecurityParser): DotNotationParser {
    return new DotNotationParser(new SecurityGuard(), secParser ?? new SecurityParser());
}

describe(XmlAccessor.name, () => {
    it('throws InvalidFormatException for non-string input', () => {
        expect(() => new XmlAccessor(makeParser()).from(null)).toThrow(InvalidFormatException);
    });

    it('throws InvalidFormatException for number input', () => {
        expect(() => new XmlAccessor(makeParser()).from(42)).toThrow(InvalidFormatException);
    });

    it('throws SecurityException for DOCTYPE declarations (XXE prevention)', () => {
        const xml = '<!DOCTYPE foo [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><root/>';
        expect(() => new XmlAccessor(makeParser()).from(xml)).toThrow(SecurityException);
    });

    it('throws SecurityException for DOCTYPE regardless of case', () => {
        const xml = '<!doctype foo><root/>';
        expect(() => new XmlAccessor(makeParser()).from(xml)).toThrow(SecurityException);
    });

    it('parses a simple XML element', () => {
        const a = new XmlAccessor(makeParser()).from('<root><name>Alice</name></root>');
        expect(a.get('name')).toBe('Alice');
    });

    it('parses sibling elements under the root', () => {
        const a = new XmlAccessor(makeParser()).from(
            '<root><name>Alice</name><age>30</age></root>',
        );
        expect(a.get('name')).toBe('Alice');
        expect(a.get('age')).toBe('30');
    });

    it('parses nested XML elements', () => {
        const a = new XmlAccessor(makeParser()).from(
            '<root><user><name>Alice</name></user></root>',
        );
        expect(a.get('user.name')).toBe('Alice');
    });

    it('throws InvalidFormatException for completely unparseable XML', () => {
        expect(() => new XmlAccessor(makeParser()).from('not xml at all !@#')).toThrow(
            InvalidFormatException,
        );
    });

    it('returns empty object for self-closing root element', () => {
        const a = new XmlAccessor(makeParser()).from('<root/>');
        expect(a.all()).toEqual({});
    });

    it('merges duplicate sibling tags into an array', () => {
        const a = new XmlAccessor(makeParser()).from('<root><item>a</item><item>b</item></root>');
        const items = a.get('item');
        expect(Array.isArray(items)).toBe(true);
        expect((items as unknown[]).length).toBe(2);
    });

    it('parses with XML declaration header', () => {
        const a = new XmlAccessor(makeParser()).from(
            '<?xml version="1.0"?><root><key>value</key></root>',
        );
        expect(a.get('key')).toBe('value');
    });

    it('throws SecurityException when XML depth exceeds the limit', () => {
        const secParser = new SecurityParser({ maxDepth: 1 });
        const parser = makeParser(secParser);
        const xml = '<root><a><b><c>deep</c></b></a></root>';
        expect(() => new XmlAccessor(parser).from(xml)).toThrow(SecurityException);
    });

    it('parses deeply nested elements correctly', () => {
        const a = new XmlAccessor(makeParser()).from(
            '<root><level1><level2><value>deep</value></level2></level1></root>',
        );
        expect(a.get('level1.level2.value')).toBe('deep');
    });

    it('parses an element with plain text content', () => {
        const a = new XmlAccessor(makeParser()).from('<root><text>hello world</text></root>');
        expect(a.get('text')).toBe('hello world');
    });

    it('merges three duplicate sibling tags into an array of 3', () => {
        const a = new XmlAccessor(makeParser()).from(
            '<root><item>a</item><item>b</item><item>c</item></root>',
        );
        const items = a.get('item') as unknown[];
        expect(Array.isArray(items)).toBe(true);
        expect(items.length).toBe(3);
        expect(items[2]).toBe('c');
    });

    it('parses self-closing child element as empty string text', () => {
        const a = new XmlAccessor(makeParser()).from('<root><empty/><name>Alice</name></root>');
        expect(a.get('name')).toBe('Alice');
    });

    it('parses multiple different child elements', () => {
        const a = new XmlAccessor(makeParser()).from(
            '<root><first>1</first><second>2</second><third>3</third></root>',
        );
        expect(a.get('first')).toBe('1');
        expect(a.get('second')).toBe('2');
        expect(a.get('third')).toBe('3');
    });

    it('returns empty object for root with only whitespace content', () => {
        const a = new XmlAccessor(makeParser()).from('<root>   </root>');
        expect(a.all()).toEqual({});
    });

    it('returns nested structure for complex XML', () => {
        const a = new XmlAccessor(makeParser()).from(
            '<root><user><name>Alice</name><role>admin</role></user></root>',
        );
        expect(a.get('user.name')).toBe('Alice');
        expect(a.get('user.role')).toBe('admin');
    });

    it('returns plain string value when child has only text content', () => {
        const a = new XmlAccessor(makeParser()).from('<root><title>Hello World</title></root>');
        expect(typeof a.get('title')).toBe('string');
        expect(a.get('title')).toBe('Hello World');
    });

    it('builds an array when the same tag appears 4 times', () => {
        const a = new XmlAccessor(makeParser()).from(
            '<root><k>1</k><k>2</k><k>3</k><k>4</k></root>',
        );
        const k = a.get('k') as unknown[];
        expect(Array.isArray(k)).toBe(true);
        expect(k.length).toBe(4);
        expect(k[3]).toBe('4');
    });

    it('throws SecurityException when opening-tag count exceeds SecurityParser.maxKeys (getMaxKeys flows to XmlParser.maxElements)', () => {
        const secParser = new SecurityParser({ maxKeys: 2 });
        const parser = makeParser(secParser);
        const xml = '<root>' + '<item>x</item>'.repeat(3) + '</root>';
        expect(() => new XmlAccessor(parser).from(xml)).toThrow(SecurityException);
    });

    it('does not throw when opening-tag count is within SecurityParser.maxKeys', () => {
        const secParser = new SecurityParser({ maxKeys: 10 });
        const parser = makeParser(secParser);
        const xml = '<root>' + '<item>x</item>'.repeat(3) + '</root>';
        expect(() => new XmlAccessor(parser).from(xml)).not.toThrow();
    });
});
