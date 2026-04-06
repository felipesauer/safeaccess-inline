import { afterEach, describe, expect, it, vi } from 'vitest';
import { XmlParser } from '../../src/parser/xml-parser.js';
import { InvalidFormatException } from '../../src/exceptions/invalid-format-exception.js';
import { SecurityException } from '../../src/exceptions/security-exception.js';

function makeParser(maxDepth = 10): XmlParser {
    return new XmlParser(maxDepth);
}

type FakeAttr = { name: string; value: string };
type FakeNode = { nodeType: number; textContent?: string; nodeName?: string; attributes?: FakeAttrs; childNodes?: FakeChildNodes };
type FakeAttrs = { length: number; [index: number]: FakeAttr | undefined };
type FakeChildNodes = { length: number; [index: number]: FakeNode | undefined };

function makeTextNode(text: string): FakeNode {
    return { nodeType: 3, textContent: text };
}

function makeElement(
    name: string,
    children: FakeNode[] = [],
    attrs: FakeAttr[] = [],
): FakeNode {
    const attributes: FakeAttrs = { length: attrs.length };
    attrs.forEach((a, i) => { attributes[i] = a; });
    const childNodes: FakeChildNodes = { length: children.length };
    children.forEach((c, i) => { childNodes[i] = c; });
    return { nodeType: 1, nodeName: name, attributes, childNodes };
}

function stubDomParser(root: FakeNode | null, hasParserError = false): void {
    const parserErrorEl = hasParserError ? { textContent: 'parse failed' } : null;
    vi.stubGlobal('DOMParser', class {
        parseFromString(): unknown {
            return {
                querySelector: (sel: string) => sel === 'parsererror' ? parserErrorEl : null,
                documentElement: root,
            };
        }
    });
}

describe(XmlParser.name, () => {
    it('parses a single child element', () => {
        expect(makeParser().parse('<root><name>Alice</name></root>')).toEqual({
            name: 'Alice',
        });
    });

    it('parses multiple sibling elements', () => {
        expect(
            makeParser().parse('<root><name>Alice</name><age>30</age></root>'),
        ).toEqual({ name: 'Alice', age: '30' });
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
        expect(
            makeParser().parse('<?xml version="1.0"?><root><key>value</key></root>'),
        ).toEqual({ key: 'value' });
    });

    it('throws InvalidFormatException for non-XML string', () => {
        expect(() => makeParser().parse('not xml at all')).toThrow(InvalidFormatException);
    });

    it('throws InvalidFormatException with message for non-XML string', () => {
        expect(() => makeParser().parse('not xml at all')).toThrow(/XmlAccessor failed to parse XML string/i);
    });

    it('ignores leading and trailing whitespace around XML', () => {
        expect(makeParser().parse('  <root><key>value</key></root>  ')).toEqual({ key: 'value' });
    });

    it('returns empty object for self-closing root with surrounding whitespace', () => {
        expect(makeParser().parse('  <root/>  ')).toEqual({});
    });

    it('throws for XML with non-XML prefix', () => {
        expect(() => makeParser().parse('header<root>value</root>')).toThrow(InvalidFormatException);
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
        expect(makeParser().parse('<root id="1"><key>value</key></root>')).toEqual({ key: 'value' });
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
});

describe(`${XmlParser.name} > nested elements`, () => {
    it('parses two-level nesting', () => {
        expect(
            makeParser().parse('<root><user><name>Alice</name></user></root>'),
        ).toEqual({ user: { name: 'Alice' } });
    });

    it('parses three-level nesting', () => {
        expect(
            makeParser().parse(
                '<root><a><b><c>deep</c></b></a></root>',
            ),
        ).toEqual({ a: { b: { c: 'deep' } } });
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

describe(`${XmlParser.name} > security — depth limit`, () => {
    it('parses successfully when depth equals maxDepth', () => {
        const result = new XmlParser(1).parse('<root><a>value</a></root>');
        expect(result['a']).toBe('value');
    });

    it('parses successfully when nested depth exactly equals maxDepth (manual path)', () => {
        const result = new XmlParser(1).parse('<root><a><b>leaf</b></a></root>');
        expect((result['a'] as Record<string, unknown>)['b']).toBe('leaf');
    });

    it('throws SecurityException when nesting exceeds maxDepth', () => {
        expect(() =>
            new XmlParser(1).parse('<root><a><b><c>deep</c></b></a></root>'),
        ).toThrow(SecurityException);
    });

    it('includes actual depth and maxDepth in SecurityException message', () => {
        expect(() =>
            new XmlParser(1).parse('<root><a><b><c>deep</c></b></a></root>'),
        ).toThrow(/XML structural depth \d+ exceeds maximum of \d+/i);
    });

    it('includes depth value 2 in SecurityException message when maxDepth is 1', () => {
        expect(() =>
            new XmlParser(1).parse('<root><a><b><c>deep</c></b></a></root>'),
        ).toThrow(/2/);
    });

    it('throws SecurityException with maxDepth=0 when nesting is encountered', () => {
        expect(() =>
            new XmlParser(0).parse('<root><a><b>value</b></a></root>'),
        ).toThrow(SecurityException);
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
});

describe(`${XmlParser.name} > browser DOMParser path`, () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('delegates to DOMParser when available', () => {
        const root = makeElement('root', [makeElement('name', [makeTextNode('Alice')])]);
        stubDomParser(root);
        expect(makeParser().parse('<root><name>Alice</name></root>')).toEqual({
            name: { '#text': 'Alice' },
        });
    });

    it('passes application/xml as MIME type to DOMParser', () => {
        let capturedType = '';
        vi.stubGlobal('DOMParser', class {
            parseFromString(_xml: string, type: string): unknown {
                capturedType = type;
                return {
                    querySelector: () => null,
                    documentElement: makeElement('root', []),
                };
            }
        });
        makeParser().parse('<root/>');
        expect(capturedType).toBe('application/xml');
    });

    it('throws InvalidFormatException when DOMParser reports parsererror', () => {
        stubDomParser(null, true);
        expect(() => makeParser().parse('<root/>')).toThrow(InvalidFormatException);
    });

    it('includes the parseerror detail in the exception message', () => {
        stubDomParser(null, true);
        expect(() => makeParser().parse('<root/>')).toThrow(/parse failed/);
    });

    it('uses Unknown error when parseerror textContent is null', () => {
        vi.stubGlobal('DOMParser', class {
            parseFromString(): unknown {
                return {
                    querySelector: (sel: string) =>
                        sel === 'parsererror' ? { textContent: null } : null,
                    documentElement: null,
                };
            }
        });
        expect(() => makeParser().parse('<root/>')).toThrow(/Unknown error/);
    });

    it('returns empty object when documentElement is null', () => {
        stubDomParser(null, false);
        expect(makeParser().parse('<root/>')).toEqual({});
    });

    it('maps element attributes with @ prefix', () => {
        const root = makeElement('root', [], [{ name: 'id', value: '42' }]);
        stubDomParser(root);
        const result = makeParser().parse('<root id="42"/>');
        expect(result['@id']).toBe('42');
    });

    it('ignores undefined attribute slots', () => {
        const attrs: FakeAttrs = { length: 2, 0: { name: 'a', value: '1' }, 1: undefined };
        const root: FakeNode = { nodeType: 1, nodeName: 'root', attributes: attrs, childNodes: { length: 0 } };
        stubDomParser(root);
        expect(makeParser().parse('<root a="1"/>')).toEqual({ '@a': '1' });
    });

    it('captures non-empty text nodes as #text', () => {
        const root = makeElement('root', [makeTextNode('  hello  ')]);
        stubDomParser(root);
        const result = makeParser().parse('<root>hello</root>');
        expect(result['#text']).toBe('hello');
    });

    it('ignores whitespace-only text nodes', () => {
        const root = makeElement('root', [makeTextNode('   ')]);
        stubDomParser(root);
        expect(makeParser().parse('<root> </root>')).toEqual({});
    });

    it('handles text node with null textContent gracefully', () => {
        const nullTextNode: FakeNode = { nodeType: 3, textContent: null as unknown as string };
        const root = makeElement('root', [nullTextNode]);
        stubDomParser(root);
        expect(makeParser().parse('<root/>')).toEqual({});
    });

    it('ignores undefined child node slots', () => {
        const undef: FakeNode = undefined as unknown as FakeNode;
        const childNodes: FakeChildNodes = { length: 2, 0: makeTextNode('hello'), 1: undef };
        const root: FakeNode = { nodeType: 1, nodeName: 'root', attributes: { length: 0 }, childNodes };
        stubDomParser(root);
        const result = makeParser().parse('<root/>');
        expect(result['#text']).toBe('hello');
    });

    it('merges duplicate child elements into an array via DOMParser', () => {
        const root = makeElement('root', [
            makeElement('item', [makeTextNode('a')]),
            makeElement('item', [makeTextNode('b')]),
        ]);
        stubDomParser(root);
        const result = makeParser().parse('<root><item>a</item><item>b</item></root>');
        expect(result['item']).toEqual([{ '#text': 'a' }, { '#text': 'b' }]);
    });

    it('pushes into existing array when third duplicate appears', () => {
        const root = makeElement('root', [
            makeElement('item', [makeTextNode('a')]),
            makeElement('item', [makeTextNode('b')]),
            makeElement('item', [makeTextNode('c')]),
        ]);
        stubDomParser(root);
        const result = makeParser().parse('<root><item>a</item><item>b</item><item>c</item></root>');
        expect(Array.isArray(result['item'])).toBe(true);
        expect((result['item'] as unknown[]).length).toBe(3);
    });

    it('returns element with only #text key as-is (not flattened)', () => {
        const root = makeElement('root', [makeTextNode('only-text')]);
        stubDomParser(root);
        const result = makeParser().parse('<root>only-text</root>');
        expect(result['#text']).toBe('only-text');
        expect(Object.keys(result).length).toBe(1);
    });

    it('does not throw when DOM element depth exactly equals maxDepth', () => {
        const child = makeElement('child', [makeTextNode('v')]);
        const root = makeElement('root', [child]);
        stubDomParser(root);
        expect(() => new XmlParser(1).parse('<root/>')).not.toThrow();
    });

    it('throws SecurityException when DOM element depth exceeds maxDepth', () => {
        const deep = makeElement('c', [makeTextNode('v')]);
        const mid = makeElement('b', [deep]);
        const root = makeElement('root', [makeElement('a', [mid])]);
        stubDomParser(root);
        expect(() => new XmlParser(1).parse('<root/>')).toThrow(SecurityException);
    });

    it('includes depth information in the SecurityException message', () => {
        const deep = makeElement('c', [makeTextNode('v')]);
        const mid = makeElement('b', [deep]);
        const root = makeElement('root', [makeElement('a', [mid])]);
        stubDomParser(root);
        expect(() => new XmlParser(1).parse('<root/>')).toThrow(/exceed/i);
    });

    it('ignores child nodes with nodeType other than 1 or 3', () => {
        const unknownNode: FakeNode = { nodeType: 8 };
        const root = makeElement('root', [unknownNode, makeElement('name', [makeTextNode('Bob')])]);
        stubDomParser(root);
        const result = makeParser().parse('<root/>');
        expect(result['name']).toEqual({ '#text': 'Bob' });
    });
});
