import { describe, expect, it } from 'vitest';
import { XmlParser } from '../../src/parser/xml-parser.js';
import { InvalidFormatException } from '../../src/exceptions/invalid-format-exception.js';
import { SecurityException } from '../../src/exceptions/security-exception.js';

function makeParser(maxDepth = 10): XmlParser {
    return new XmlParser(maxDepth);
}

describe(XmlParser.name, () => {
    it('parses a single child element', () => {
        expect(makeParser().parse('<root><name>Alice</name></root>')).toEqual({
            name: 'Alice',
        });
    });

    it('parses multiple sibling elements', () => {
        expect(makeParser().parse('<root><name>Alice</name><age>30</age></root>')).toEqual({
            name: 'Alice',
            age: '30',
        });
    });

    it('returns empty object for whitespace-only root content', () => {
        expect(makeParser().parse('<root>   </root>')).toEqual({});
    });

    it('returns empty object for self-closing root element', () => {
        expect(makeParser().parse('<root/>')).toEqual({});
    });

    it('returns empty object for single-character self-closing root element', () => {
        expect(makeParser().parse('<r/>')).toEqual({});
    });

    it('strips XML declaration header before parsing', () => {
        expect(makeParser().parse('<?xml version="1.0"?><root><key>value</key></root>')).toEqual({
            key: 'value',
        });
    });

    it('throws InvalidFormatException for non-XML string', () => {
        expect(() => makeParser().parse('not xml at all')).toThrow(InvalidFormatException);
    });

    it('throws InvalidFormatException with message for non-XML string', () => {
        expect(() => makeParser().parse('not xml at all')).toThrow(
            /XmlAccessor failed to parse XML string/i,
        );
    });

    it('ignores leading and trailing whitespace around XML', () => {
        expect(makeParser().parse('  <root><key>value</key></root>  ')).toEqual({ key: 'value' });
    });

    it('returns empty object for self-closing root with surrounding whitespace', () => {
        expect(makeParser().parse('  <root/>  ')).toEqual({});
    });

    it('throws for XML with non-XML prefix', () => {
        expect(() => makeParser().parse('header<root>value</root>')).toThrow(
            InvalidFormatException,
        );
    });

    it('throws for self-closing XML with non-XML prefix', () => {
        expect(() => makeParser().parse('header<root/>')).toThrow(InvalidFormatException);
    });

    it('throws for XML with trailing garbage after close tag', () => {
        expect(() => makeParser().parse('<root>val</root><extra>')).toThrow(InvalidFormatException);
    });

    it('throws for self-closing root with trailing content', () => {
        expect(() => makeParser().parse('<root/><extra>')).toThrow(InvalidFormatException);
    });

    it('parses root element with attributes', () => {
        expect(makeParser().parse('<root id="1"><key>value</key></root>')).toEqual({
            key: 'value',
        });
    });

    it('parses self-closing root element with attributes', () => {
        expect(makeParser().parse('<root id="1"/>')).toEqual({});
    });

    it('parses self-closing root with space before closing >', () => {
        expect(makeParser().parse('<root/ >')).toEqual({});
    });

    it('parses root where closing tag has trailing whitespace before >', () => {
        expect(makeParser().parse('<root><key>value</key></root >')).toEqual({ key: 'value' });
    });

    it('throws InvalidFormatException for opening tag without closing tag', () => {
        expect(() => makeParser().parse('<root><unclosed>')).toThrow(InvalidFormatException);
    });

    it('throws InvalidFormatException when closing tag is embedded inside opening tag body (closeTagStart <= openGt)', () => {
        // <abc</abc> - backward scan finds 'abc' at the end, confirms '</abc',
        // but closeTagStart (4) is <= openGt (9), meaning the close marker is
        // inside the opening-tag span - structurally impossible, must throw
        expect(() => makeParser().parse('<abc</abc>')).toThrow(InvalidFormatException);
    });

    it('throws InvalidFormatException when document does not end with > (no closing tag)', () => {
        // '<root>unclosed text' ends with 't', not '>' - triggers the
        // doc[doc.length - 1] !== '>' guard in extractRootContent
        expect(() => makeParser().parse('<root>unclosed text')).toThrow(InvalidFormatException);
    });

    it('throws InvalidFormatException when opening tag has no closing > at all', () => {
        // '<root' has no '>' - openGt === -1 guard in extractRootContent
        expect(() => makeParser().parse('<root')).toThrow(InvalidFormatException);
    });

    it('throws InvalidFormatException when tag name found at end but not preceded by </ (space before tag name)', () => {
        // '<root>text root>' - backward scan finds 'root' at the end but
        // the preceding char is ' ' not '/', triggering the </ guard
        expect(() => makeParser().parse('<root>text root>')).toThrow(InvalidFormatException);
    });
});

describe(`${XmlParser.name} > nested elements`, () => {
    it('parses two-level nesting', () => {
        expect(makeParser().parse('<root><user><name>Alice</name></user></root>')).toEqual({
            user: { name: 'Alice' },
        });
    });

    it('parses three-level nesting', () => {
        expect(makeParser().parse('<root><a><b><c>deep</c></b></a></root>')).toEqual({
            a: { b: { c: 'deep' } },
        });
    });

    it('returns plain string when child has only text content', () => {
        const result = makeParser().parse('<root><title>Hello World</title></root>');
        expect(result['title']).toBe('Hello World');
        expect(typeof result['title']).toBe('string');
    });
});

describe(`${XmlParser.name} > duplicate sibling elements`, () => {
    it('merges two duplicate siblings into an array', () => {
        const result = makeParser().parse('<root><item>a</item><item>b</item></root>');
        expect(result['item']).toEqual(['a', 'b']);
    });

    it('merges three duplicate siblings into an array of 3', () => {
        const result = makeParser().parse(
            '<root><item>a</item><item>b</item><item>c</item></root>',
        );
        expect(Array.isArray(result['item'])).toBe(true);
        expect((result['item'] as unknown[]).length).toBe(3);
        expect((result['item'] as unknown[])[2]).toBe('c');
    });
});

describe(`${XmlParser.name} > security - depth limit`, () => {
    it('parses successfully when depth equals maxDepth', () => {
        const result = new XmlParser(1).parse('<root><a>value</a></root>');
        expect(result['a']).toBe('value');
    });

    it('parses successfully when nested depth exactly equals maxDepth (manual path)', () => {
        const result = new XmlParser(1).parse('<root><a><b>leaf</b></a></root>');
        expect((result['a'] as Record<string, unknown>)['b']).toBe('leaf');
    });

    it('throws SecurityException when nesting exceeds maxDepth', () => {
        expect(() => new XmlParser(1).parse('<root><a><b><c>deep</c></b></a></root>')).toThrow(
            SecurityException,
        );
    });

    it('includes actual depth and maxDepth in SecurityException message', () => {
        expect(() => new XmlParser(1).parse('<root><a><b><c>deep</c></b></a></root>')).toThrow(
            /XML structural depth \d+ exceeds maximum of \d+/i,
        );
    });

    it('includes depth value 2 in SecurityException message when maxDepth is 1', () => {
        expect(() => new XmlParser(1).parse('<root><a><b><c>deep</c></b></a></root>')).toThrow(/2/);
    });

    it('throws SecurityException with maxDepth=0 when nesting is encountered', () => {
        expect(() => new XmlParser(0).parse('<root><a><b>value</b></a></root>')).toThrow(
            SecurityException,
        );
    });
});

describe(`${XmlParser.name} > security - element count limit (maxElements)`, () => {
    it('throws SecurityException when element count exceeds custom maxElements', () => {
        const xml = '<root>' + '<item>x</item>'.repeat(3) + '</root>';
        expect(() => new XmlParser(10, 2).parse(xml)).toThrow(SecurityException);
    });

    it('does not throw when element count equals maxElements', () => {
        // <root> + 3 × <item> = 4 opening tags counted by the guard
        const xml = '<root>' + '<item>x</item>'.repeat(3) + '</root>';
        expect(() => new XmlParser(10, 4).parse(xml)).not.toThrow();
    });

    it('includes element count and limit in SecurityException message', () => {
        const xml = '<root>' + '<item>x</item>'.repeat(3) + '</root>';
        expect(() => new XmlParser(10, 2).parse(xml)).toThrow(
            /XML element count \d+ exceeds maximum of \d+/i,
        );
    });
});

describe(`${XmlParser.name} > constructor - maxElements clamping (SEC-017)`, () => {
    it('clamps NaN to 10 000 so the element guard still fires at 10 000', () => {
        const xml = '<root>' + '<item>x</item>'.repeat(10_001) + '</root>';
        expect(() => new XmlParser(100, NaN).parse(xml)).toThrow(SecurityException);
    });

    it('does not throw for NaN when element count is within the clamped default limit', () => {
        const xml = '<root><item>x</item></root>';
        expect(() => new XmlParser(100, NaN).parse(xml)).not.toThrow();
    });

    it('clamps Infinity to 10 000 so the element guard still fires at 10 000', () => {
        const xml = '<root>' + '<item>x</item>'.repeat(10_001) + '</root>';
        expect(() => new XmlParser(100, Infinity).parse(xml)).toThrow(SecurityException);
    });

    it('clamps zero to 10 000 so the element guard still fires at 10 000', () => {
        const xml = '<root>' + '<item>x</item>'.repeat(10_001) + '</root>';
        expect(() => new XmlParser(100, 0).parse(xml)).toThrow(SecurityException);
    });

    it('clamps negative values to 10 000 so the element guard still fires at 10 000', () => {
        const xml = '<root>' + '<item>x</item>'.repeat(10_001) + '</root>';
        expect(() => new XmlParser(100, -1).parse(xml)).toThrow(SecurityException);
    });

    it('accepts a valid positive finite maxElements and enforces it', () => {
        const xml = '<root>' + '<item>x</item>'.repeat(5) + '</root>';
        expect(() => new XmlParser(100, 4).parse(xml)).toThrow(SecurityException);
    });

    it('uses the provided positive finite maxElements when within limit - no exception', () => {
        const xml = '<root>' + '<item>x</item>'.repeat(3) + '</root>';
        expect(() => new XmlParser(100, 10).parse(xml)).not.toThrow();
    });
});

describe(`${XmlParser.name} > manual parser edge cases`, () => {
    it('maps self-closing child element to empty string', () => {
        const result = makeParser().parse('<root><empty/><name>Alice</name></root>');
        expect(result['empty']).toBe('');
        expect(result['name']).toBe('Alice');
    });

    it('parses child element with attributes discarding them', () => {
        const result = makeParser().parse('<root><item id="1">value</item></root>');
        expect(result['item']).toBe('value');
    });

    it('parses self-closing child element with attributes', () => {
        const result = makeParser().parse('<root><flag enabled="true"/><name>Alice</name></root>');
        expect(result['flag']).toBe('');
        expect(result['name']).toBe('Alice');
    });

    it('recurses into self-closing child elements nested inside parent', () => {
        expect(makeParser().parse('<root><parent><empty/></parent></root>')).toEqual({
            parent: { empty: '' },
        });
    });

    it('trims whitespace from text content in child elements', () => {
        expect(makeParser().parse('<root><item>  hello  </item></root>')).toEqual({
            item: 'hello',
        });
    });

    it('does not flatten nested elements to #text when childResult has multiple keys', () => {
        const result = makeParser().parse('<root><parent><a>1</a><b>2</b></parent></root>');
        const parent = result['parent'] as Record<string, unknown>;
        expect(parent['a']).toBe('1');
        expect(parent['b']).toBe('2');
        expect('#text' in parent).toBe(false);
    });

    it('parses text content containing partial element-like syntax as plain text', () => {
        const result = makeParser().parse('<root><item>hello <world</item></root>');
        expect(result['item']).toBe('hello <world');
    });

    it('parses elements preceded by plain text in child content', () => {
        const result = makeParser().parse('<root><wrap>prefix<a>v</a></wrap></root>');
        const wrap = result['wrap'] as Record<string, unknown>;
        expect(wrap['a']).toBe('v');
    });

    it('preserves child object with multiple keys without #text flattening', () => {
        const result = makeParser().parse('<root><w><x>1</x><y>2</y></w></root>');
        expect(result['w']).toEqual({ x: '1', y: '2' });
    });
});
