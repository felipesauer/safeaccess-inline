import { afterEach, describe, expect, it, vi } from 'vitest';
import { XmlParser } from '../../src/parser/xml-parser.js';
import { InvalidFormatException } from '../../src/exceptions/invalid-format-exception.js';
import { SecurityException } from '../../src/exceptions/security-exception.js';

function makeParser(maxDepth = 10): XmlParser {
    return new XmlParser(maxDepth);
}

type FakeAttr = { name: string; value: string };
type FakeNode = {
    nodeType: number;
    textContent?: string;
    nodeName?: string;
    attributes?: FakeAttrs;
    childNodes?: FakeChildNodes;
};
type FakeAttrs = { length: number; [index: number]: FakeAttr | undefined };
type FakeChildNodes = { length: number; [index: number]: FakeNode | undefined };

function makeTextNode(text: string): FakeNode {
    return { nodeType: 3, textContent: text };
}

function makeElement(name: string, children: FakeNode[] = [], attrs: FakeAttr[] = []): FakeNode {
    const attributes: FakeAttrs = { length: attrs.length };
    attrs.forEach((a, i) => {
        attributes[i] = a;
    });
    const childNodes: FakeChildNodes = { length: children.length };
    children.forEach((c, i) => {
        childNodes[i] = c;
    });
    return { nodeType: 1, nodeName: name, attributes, childNodes };
}

function stubDomParser(root: FakeNode | null, hasParserError = false): void {
    const parserErrorEl = hasParserError ? { textContent: 'parse failed' } : null;
    vi.stubGlobal(
        'DOMParser',
        class {
            parseFromString(): unknown {
                return {
                    querySelector: (sel: string) => (sel === 'parsererror' ? parserErrorEl : null),
                    documentElement: root,
                };
            }
        },
    );
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
        // <abc</abc> — backward scan finds 'abc' at the end, confirms '</abc',
        // but closeTagStart (4) is <= openGt (9), meaning the close marker is
        // inside the opening-tag span — structurally impossible, must throw
        expect(() => makeParser().parse('<abc</abc>')).toThrow(InvalidFormatException);
    });

    it('throws InvalidFormatException when document does not end with > (no closing tag)', () => {
        // '<root>unclosed text' ends with 't', not '>' — triggers the
        // doc[doc.length - 1] !== '>' guard in extractRootContent
        expect(() => makeParser().parse('<root>unclosed text')).toThrow(InvalidFormatException);
    });

    it('throws InvalidFormatException when opening tag has no closing > at all', () => {
        // '<root' has no '>' — openGt === -1 guard in extractRootContent
        expect(() => makeParser().parse('<root')).toThrow(InvalidFormatException);
    });

    it('throws InvalidFormatException when tag name found at end but not preceded by </ (space before tag name)', () => {
        // '<root>text root>' — backward scan finds 'root' at the end but
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

describe(`${XmlParser.name} > security — element count limit (maxElements)`, () => {
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

describe(`${XmlParser.name} > constructor — maxElements clamping (SEC-017)`, () => {
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

    it('uses the provided positive finite maxElements when within limit — no exception', () => {
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
        vi.stubGlobal(
            'DOMParser',
            class {
                parseFromString(_xml: string, type: string): unknown {
                    capturedType = type;
                    return {
                        querySelector: () => null,
                        documentElement: makeElement('root', []),
                    };
                }
            },
        );
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
        vi.stubGlobal(
            'DOMParser',
            class {
                parseFromString(): unknown {
                    return {
                        querySelector: (sel: string) =>
                            sel === 'parsererror' ? { textContent: null } : null,
                        documentElement: null,
                    };
                }
            },
        );
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
        const root: FakeNode = {
            nodeType: 1,
            nodeName: 'root',
            attributes: attrs,
            childNodes: { length: 0 },
        };
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
        const root: FakeNode = {
            nodeType: 1,
            nodeName: 'root',
            attributes: { length: 0 },
            childNodes,
        };
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
        const result = makeParser().parse(
            '<root><item>a</item><item>b</item><item>c</item></root>',
        );
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

describe(`${XmlParser.name} > linear scanner — nesting counter`, () => {
    it('extracts outer element when same-name elements nest (kills nestDepth++ mutant)', () => {
        // nestDepth must be incremented at inner <a> so the first </a> does not
        // prematurely close the outer element
        const result = makeParser().parse('<root><a><a>inner</a>rest</a></root>');
        const a = result['a'] as Record<string, unknown>;
        expect(a['a']).toBe('inner');
    });

    it('resolves 3-deep same-name nesting (kills off-by-one in nestDepth-- condition)', () => {
        // nestDepth starts at 1, increments twice, decrements 3× — only
        // when it hits exactly 0 should inner content be collected
        const result = makeParser().parse('<root><a><a><a>deep</a></a></a></root>');
        const a1 = result['a'] as Record<string, unknown>;
        const a2 = a1['a'] as Record<string, unknown>;
        expect(a2['a']).toBe('deep');
    });

    it('does not count a self-closing same-name tag as open nestDepth (kills self-closing increment mutant)', () => {
        // <a/> inside <a>…</a> must NOT increment nestDepth; if it did, the first
        // </a> would only bring nestDepth to 1 and the parser would scan past it
        const result = makeParser().parse('<root><a><a/>text</a></root>');
        const a = result['a'] as Record<string, unknown>;
        expect(a['a']).toBe('');
    });
});

describe(`${XmlParser.name} > linear scanner — self-closing detection`, () => {
    it('treats <tag   /> (spaces before />) as self-closing (kills trimEnd mutant)', () => {
        const result = makeParser().parse('<root><empty   /></root>');
        expect(result['empty']).toBe('');
    });

    it('treats <tag attr="v" /> as self-closing (attribute + space + /)', () => {
        const result = makeParser().parse('<root><flag enabled="true" /></root>');
        expect(result['flag']).toBe('');
    });
});

describe(`${XmlParser.name} > linear scanner — skip non-element tokens`, () => {
    it('skips XML comment nodes inside children (kills nextChar === "!" mutant)', () => {
        const result = makeParser().parse('<root><!-- comment --><name>Alice</name></root>');
        expect(result['name']).toBe('Alice');
        expect(Object.keys(result)).toEqual(['name']);
    });

    it('skips processing instructions inside children (kills nextChar === "?" mutant)', () => {
        const result = makeParser().parse('<root><?pi data?><name>Bob</name></root>');
        expect(result['name']).toBe('Bob');
        expect(Object.keys(result)).toEqual(['name']);
    });

    it('skips stray closing tags inside children (kills nextChar === "/" mutant)', () => {
        const result = makeParser().parse('<root></stray><name>Charlie</name></root>');
        expect(result['name']).toBe('Charlie');
        expect(Object.keys(result)).toEqual(['name']);
    });

    it('handles comment-like token with no closing > (gt === -1 ternary branch)', () => {
        // '<!no close tag' in inner content — no '>' found, so i is set to
        // content.length terminating the loop; content falls through as #text
        const result = makeParser().parse('<root><!no close tag</root>');
        expect(result['#text']).toBe('<!no close tag');
    });

    it('skips child tag whose name starts with a digit (kills !\\[a-zA-Z_\\] continue branch)', () => {
        // <1tag> — nextChar is '1', fails [a-zA-Z_] test; loop advances past it
        // and the content falls through as #text
        const result = makeParser().parse('<root><1tag>value</root>');
        expect(result['#text']).toBe('<1tag>value');
    });
});

describe(`${XmlParser.name} > linear scanner — unclosed and malformed tags`, () => {
    it('skips an unclosed child and continues parsing siblings (kills innerEnd === -1 check mutant)', () => {
        // <unclosed> has no </unclosed> — parser must skip it and continue
        const result = makeParser().parse('<root><unclosed><name>Bob</name></root>');
        expect(result['name']).toBe('Bob');
    });

    it('accepts closing tag at end of string with no trailing > (c === undefined branch)', () => {
        // </a is the last token with no > — charAfter is undefined; the undefined
        // branch must accept this as the close tag or the inner value is lost
        const result = makeParser().parse('<root><a>1</a</root>');
        expect(result['a']).toBe('1');
    });

    it('skips close-tag prefix that matches a longer tag name', () => {
        // </a matches the prefix of </ab> — the char after </a is 'b', not
        // a delimiter, so the scanner must skip it and keep looking for </a>
        const result = makeParser().parse('<root><a><ab>inner</ab>rest</a></root>');
        const a = result['a'] as Record<string, unknown>;
        expect(a['ab']).toBe('inner');
    });

    it('handles a trailing bare < in inner content gracefully (nextChar === undefined break)', () => {
        // Bare < at the very end of inner content — nextChar is undefined, the
        // outer loop must terminate without crashing
        const result = makeParser().parse('<root><name>Alice</name><</root>');
        expect(result['name']).toBe('Alice');
    });
});
