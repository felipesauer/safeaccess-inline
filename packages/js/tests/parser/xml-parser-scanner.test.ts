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

describe(`${XmlParser.name} > linear scanner - nesting counter`, () => {
    it('extracts outer element when same-name elements nest (kills nestDepth++ mutant)', () => {
        // nestDepth must be incremented at inner <a> so the first </a> does not
        // prematurely close the outer element
        const result = makeParser().parse('<root><a><a>inner</a>rest</a></root>');
        const a = result['a'] as Record<string, unknown>;
        expect(a['a']).toBe('inner');
    });

    it('resolves 3-deep same-name nesting (kills off-by-one in nestDepth-- condition)', () => {
        // nestDepth starts at 1, increments twice, decrements 3× - only
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

    it('increments nestDepth for same-name opening tag with tab after name', () => {
        const result = makeParser().parse('<root><a><a\t>inner</a></a></root>');
        const a = result['a'] as Record<string, unknown>;
        expect(a).toEqual({ a: 'inner' });
    });

    it('increments nestDepth for same-name opening tag with newline after name', () => {
        const result = makeParser().parse('<root><a><a\n>inner</a></a></root>');
        const a = result['a'] as Record<string, unknown>;
        expect(a).toEqual({ a: 'inner' });
    });

    it('increments nestDepth for same-name opening tag with carriage return after name', () => {
        const result = makeParser().parse('<root><a><a\r>inner</a></a></root>');
        const a = result['a'] as Record<string, unknown>;
        expect(a).toEqual({ a: 'inner' });
    });
});

describe(`${XmlParser.name} > linear scanner - self-closing detection`, () => {
    it('treats <tag   /> (spaces before />) as self-closing (kills trimEnd mutant)', () => {
        const result = makeParser().parse('<root><empty   /></root>');
        expect(result['empty']).toBe('');
    });

    it('treats <tag attr="v" /> as self-closing (attribute + space + /)', () => {
        const result = makeParser().parse('<root><flag enabled="true" /></root>');
        expect(result['flag']).toBe('');
    });

    it('treats <tag / > (space after slash before >) as self-closing', () => {
        const result = makeParser().parse('<root><empty / ></root>');
        expect(result['empty']).toBe('');
    });
});

describe(`${XmlParser.name} > linear scanner - skip non-element tokens`, () => {
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
        // '<!no close tag' in inner content - no '>' found, so i is set to
        // content.length terminating the loop; content falls through as #text
        const result = makeParser().parse('<root><!no close tag</root>');
        expect(result['#text']).toBe('<!no close tag');
    });

    it('skips child tag whose name starts with a digit (kills !\\[a-zA-Z_\\] continue branch)', () => {
        // <1tag> - nextChar is '1', fails [a-zA-Z_] test; loop advances past it
        // and the content falls through as #text
        const result = makeParser().parse('<root><1tag>value</root>');
        expect(result['#text']).toBe('<1tag>value');
    });

    it('does not parse element-like tokens inside XML comments', () => {
        const result = makeParser().parse('<root><!-- <fake>x</fake> --><name>Alice</name></root>');
        expect(result['name']).toBe('Alice');
        expect(Object.keys(result)).toEqual(['name']);
    });

    it('does not parse element-like tokens inside processing instructions', () => {
        const result = makeParser().parse('<root><?pi <data>x</data> ?><name>Bob</name></root>');
        expect(result['name']).toBe('Bob');
        expect(Object.keys(result)).toEqual(['name']);
    });

    it('ignores digit-started tag even when it has a matching close tag', () => {
        const result = makeParser().parse('<root><1>v</1><name>w</name></root>');
        expect(result['name']).toBe('w');
        expect(Object.keys(result)).toEqual(['name']);
    });

    it('does not parse elements embedded inside a stray closing tag prefix', () => {
        const result = makeParser().parse('<root></a<b>text</b><name>v</name></root>');
        expect(result['name']).toBe('v');
        expect(Object.keys(result)).toEqual(['name']);
    });
});

describe(`${XmlParser.name} > linear scanner - unclosed and malformed tags`, () => {
    it('skips an unclosed child and continues parsing siblings (kills innerEnd === -1 check mutant)', () => {
        // <unclosed> has no </unclosed> - parser must skip it and continue
        const result = makeParser().parse('<root><unclosed><name>Bob</name></root>');
        expect(result['name']).toBe('Bob');
    });

    it('accepts closing tag at end of string with no trailing > (c === undefined branch)', () => {
        // </a is the last token with no > - charAfter is undefined; the undefined
        // branch must accept this as the close tag or the inner value is lost
        const result = makeParser().parse('<root><a>1</a</root>');
        expect(result['a']).toBe('1');
    });

    it('skips close-tag prefix that matches a longer tag name', () => {
        // </a matches the prefix of </ab> - the char after </a is 'b', not
        // a delimiter, so the scanner must skip it and keep looking for </a>
        const result = makeParser().parse('<root><a><ab>inner</ab>rest</a></root>');
        const a = result['a'] as Record<string, unknown>;
        expect(a['ab']).toBe('inner');
    });

    it('handles a trailing bare < in inner content gracefully (nextChar === undefined break)', () => {
        // Bare < at the very end of inner content - nextChar is undefined, the
        // outer loop must terminate without crashing
        const result = makeParser().parse('<root><name>Alice</name><</root>');
        expect(result['name']).toBe('Alice');
    });
});
