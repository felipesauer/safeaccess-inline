import { describe, expect, it } from 'vitest';
import { XmlParser } from '../../src/parser/xml-parser.js';
import { InvalidFormatException } from '../../src/exceptions/invalid-format-exception.js';
import { SecurityException } from '../../src/exceptions/security-exception.js';

function makeParser(maxDepth = 10): XmlParser {
    return new XmlParser(maxDepth);
}

describe(`${XmlParser.name} > mutation killing - constructor clamping`, () => {
    it('enforces maxElements=1 so 2-element document throws', () => {
        expect(() => new XmlParser(10, 1).parse('<root><a/></root>')).toThrow(SecurityException);
    });

    it('allows single-element self-closing document when maxElements=1', () => {
        expect(new XmlParser(10, 1).parse('<a/>')).toEqual({});
    });

    it('enforces maxElements=1 with nested element document', () => {
        expect(() => new XmlParser(10, 1).parse('<r><a>v</a></r>')).toThrow(SecurityException);
    });

    it('clamps maxElements=0 to 10000 instead of rejecting all documents', () => {
        // With 0, if not clamped, `elementCount > 0` would reject every document
        expect(() => new XmlParser(10, 0).parse('<r><a>v</a></r>')).not.toThrow();
    });

    it('clamps maxElements=-1 to 10000', () => {
        expect(() => new XmlParser(10, -1).parse('<r><a>v</a></r>')).not.toThrow();
    });

    it('clamps maxElements=NaN to 10000', () => {
        expect(() => new XmlParser(10, NaN).parse('<r><a>v</a></r>')).not.toThrow();
    });

    it('clamps maxElements=Infinity to 10000', () => {
        const parser = new XmlParser(10, Infinity);
        // Would need > 10000 elements to throw if clamped; verify small doc works
        expect(() => parser.parse('<r><a>v</a></r>')).not.toThrow();
    });
});

describe(`${XmlParser.name} > mutation killing - element count regex`, () => {
    it('counts only opening tags (not closing) for element limit', () => {
        expect(() => new XmlParser(10, 2).parse('<root><a/><b/></root>')).toThrow(
            SecurityException,
        );
    });

    it('allows document when opening tag count equals maxElements', () => {
        expect(() => new XmlParser(10, 2).parse('<root><a/></root>')).not.toThrow();
    });
});

describe(`${XmlParser.name} > mutation killing - extractRootContent validation`, () => {
    it('rejects root tag starting with a digit', () => {
        expect(() => makeParser().parse('<1>data</1>')).toThrow(InvalidFormatException);
    });

    it('rejects root tag starting with a hyphen', () => {
        expect(() => makeParser().parse('<->x</->')).toThrow(InvalidFormatException);
    });

    it('includes XmlAccessor in error message for missing closing >', () => {
        expect(() => makeParser().parse('<root')).toThrow(/XmlAccessor/);
    });

    it('includes XmlAccessor in error message for self-closing with trailing content', () => {
        expect(() => makeParser().parse('<root/><extra>')).toThrow(/XmlAccessor/);
    });

    it('includes XmlAccessor in error message for non-self-closing root detected as self-closing', () => {
        expect(() => makeParser().parse('<root/ ><extra>')).toThrow(/XmlAccessor/);
    });

    it('includes XmlAccessor in error message for mismatched closing tag', () => {
        expect(() => makeParser().parse('<root>val</wrong>')).toThrow(/XmlAccessor/);
    });

    it('includes XmlAccessor in error message when closing lacks </ prefix', () => {
        expect(() => makeParser().parse('<root>text root>')).toThrow(/XmlAccessor/);
    });

    it('includes XmlAccessor in error message for close tag overlapping open tag', () => {
        expect(() => makeParser().parse('<abc</abc>')).toThrow(/XmlAccessor/);
    });

    it('includes XmlAccessor in error message for truncated document not ending with >', () => {
        expect(() => makeParser().parse('<root>text')).toThrow(/XmlAccessor/);
    });
});

describe(`${XmlParser.name} > mutation killing - backward whitespace walk in root close tag`, () => {
    it('handles space before > in closing root tag', () => {
        expect(makeParser().parse('<root><k>v</k></root >')).toEqual({ k: 'v' });
    });

    it('handles tab before > in closing root tag', () => {
        expect(makeParser().parse('<root><k>v</k></root\t>')).toEqual({ k: 'v' });
    });

    it('handles newline before > in closing root tag', () => {
        expect(makeParser().parse('<root><k>v</k></root\n>')).toEqual({ k: 'v' });
    });

    it('handles carriage return before > in closing root tag', () => {
        expect(makeParser().parse('<root><k>v</k></root\r>')).toEqual({ k: 'v' });
    });

    it('handles mixed whitespace before > in closing root tag', () => {
        expect(makeParser().parse('<root><k>v</k></root \t\n\r>')).toEqual({ k: 'v' });
    });

    it('handles pos reaching 0 during backward whitespace walk', () => {
        expect(() => makeParser().parse('<r>v</r\t\t\t\t\t\t\t\t\t\t\t\t\t>')).not.toThrow();
    });
});

describe(`${XmlParser.name} > mutation killing - close tag delimiter matching in children`, () => {
    it('matches child close tag followed by space', () => {
        expect(makeParser().parse('<root><item>val</item ></root>')).toEqual({ item: 'val' });
    });

    it('matches child close tag followed by tab', () => {
        expect(makeParser().parse('<root><item>val</item\t></root>')).toEqual({ item: 'val' });
    });

    it('matches child close tag followed by newline', () => {
        expect(makeParser().parse('<root><item>val</item\n></root>')).toEqual({ item: 'val' });
    });

    it('matches child close tag followed by carriage return', () => {
        expect(makeParser().parse('<root><item>val</item\r></root>')).toEqual({ item: 'val' });
    });

    it('matches child close tag at end of content (undefined after tag name)', () => {
        const result = makeParser().parse('<root><a>1</a</root>');
        expect(result['a']).toBe('1');
    });
});

describe(`${XmlParser.name} > mutation killing - open prefix nesting delimiter matching`, () => {
    it('increments nestDepth for opening tag followed by >', () => {
        const result = makeParser().parse('<root><a><a>inner</a>rest</a></root>');
        const a = result['a'] as Record<string, unknown>;
        expect(a['a']).toBe('inner');
    });

    it('increments nestDepth for opening tag followed by space', () => {
        const result = makeParser().parse('<root><a ><a>inner</a>rest</a></root>');
        const a = result['a'] as Record<string, unknown>;
        expect(a['a']).toBe('inner');
    });

    it('increments nestDepth for opening tag followed by tab', () => {
        const result = makeParser().parse('<root><a\t><a>inner</a>rest</a></root>');
        const a = result['a'] as Record<string, unknown>;
        expect(a['a']).toBe('inner');
    });

    it('increments nestDepth for opening tag followed by newline', () => {
        const result = makeParser().parse('<root><a\n><a>inner</a>rest</a></root>');
        const a = result['a'] as Record<string, unknown>;
        expect(a['a']).toBe('inner');
    });

    it('increments nestDepth for opening tag followed by carriage return', () => {
        const result = makeParser().parse('<root><a\r><a>inner</a>rest</a></root>');
        const a = result['a'] as Record<string, unknown>;
        expect(a['a']).toBe('inner');
    });

    it('does not increment nestDepth for self-closing same-name tag', () => {
        const result = makeParser().parse('<root><a><a/>rest</a></root>');
        const a = result['a'] as Record<string, unknown>;
        expect(a['a']).toBe('');
    });

    it('does not increment nestDepth for self-closing tag with attributes', () => {
        const result = makeParser().parse('<root><a><a id="1"/>rest</a></root>');
        const a = result['a'] as Record<string, unknown>;
        expect(a['a']).toBe('');
    });
});

describe(`${XmlParser.name} > mutation killing - self-closing child trimEnd`, () => {
    it('uses trimEnd for self-closing detection (spaces before /)', () => {
        const result = makeParser().parse('<root><empty   /></root>');
        expect(result['empty']).toBe('');
    });

    it('trimStart would fail for self-closing with leading space before /', () => {
        const result = makeParser().parse('<root><tag attr="v"  /></root>');
        expect(result['tag']).toBe('');
    });
});

describe(`${XmlParser.name} > mutation killing - parseXmlChildren loop boundaries`, () => {
    it('processes child elements without overshooting content boundary', () => {
        const result = makeParser().parse('<root><a>x</a></root>');
        expect(result['a']).toBe('x');
    });

    it('handles bare < at end of inner content', () => {
        const result = makeParser().parse('<root><name>Alice</name><</root>');
        expect(result['name']).toBe('Alice');
    });

    it('skips all three non-element token types (/, !, ?) in children', () => {
        const xml = '<root></stray><!-- comment --><?pi data?><a>v</a></root>';
        expect(makeParser().parse(xml)).toEqual({ a: 'v' });
    });

    it('advances past > correctly for skipped tokens (gt+1)', () => {
        const result = makeParser().parse('<root><!-- c1 --><!-- c2 --><a>v</a></root>');
        expect(result['a']).toBe('v');
    });

    it('skips tag name starting with digit in child content', () => {
        const result = makeParser().parse('<root><1bad>v</root>');
        expect(result['#text']).toBe('<1bad>v');
    });

    it('advances correctly after self-closing child (gt+1)', () => {
        const result = makeParser().parse('<root><a/><b>v</b></root>');
        expect(result['a']).toBe('');
        expect(result['b']).toBe('v');
    });

    it('advances correctly for nesting counter start position (gt+1)', () => {
        const result = makeParser().parse('<root><a><b>v</b></a></root>');
        expect((result['a'] as Record<string, unknown>)['b']).toBe('v');
    });

    it('terminates nesting loop when close tag is found at nestDepth=0', () => {
        const result = makeParser().parse('<root><a>text</a></root>');
        expect(result['a']).toBe('text');
    });

    it('correctly calculates inner end position for close tag', () => {
        const result = makeParser().parse('<root><item>content</item></root>');
        expect(result['item']).toBe('content');
    });

    it('correctly positions after close tag > for sequential siblings', () => {
        const result = makeParser().parse('<root><a>1</a><b>2</b></root>');
        expect(result['a']).toBe('1');
        expect(result['b']).toBe('2');
    });

    it('advances past unclosed inner tag to parse next sibling', () => {
        const result = makeParser().parse('<root><unclosed><b>v</b></root>');
        expect(result['b']).toBe('v');
    });
});

describe(`${XmlParser.name} > mutation killing - text content detection`, () => {
    it('treats text-only inner content as plain string', () => {
        const result = makeParser().parse('<root><item>plain text</item></root>');
        expect(result['item']).toBe('plain text');
        expect(typeof result['item']).toBe('string');
    });

    it('stores non-empty text as #text when no child elements', () => {
        const result = makeParser().parse('<root>just text</root>');
        expect(result['#text']).toBe('just text');
    });

    it('returns empty object when inner content has no text and no elements', () => {
        expect(makeParser().parse('<root>   </root>')).toEqual({});
    });

    it('parses child elements in inner content when elements are present', () => {
        const result = makeParser().parse('<root><item>no-elements-here</item></root>');
        expect(result['item']).toBe('no-elements-here');
    });

    it('flattens child result with only #text key to string', () => {
        const result = makeParser().parse('<root><wrap><inner>val</inner></wrap></root>');
        const wrap = result['wrap'] as Record<string, unknown>;
        expect(wrap['inner']).toBe('val');
    });

    it('does not flatten child result with multiple keys', () => {
        const result = makeParser().parse('<root><wrap><a>1</a><b>2</b></wrap></root>');
        const wrap = result['wrap'] as Record<string, unknown>;
        expect(wrap['a']).toBe('1');
        expect(wrap['b']).toBe('2');
    });

    it('handles empty inner content between open and close tag', () => {
        const result = makeParser().parse('<root><item></item></root>');
        expect(result['item']).toBe('');
    });
});

describe(`${XmlParser.name} > mutation killing - close tag length arithmetic`, () => {
    it('computes close tag search position correctly (nextLt + closeTag.length)', () => {
        const result = makeParser().parse('<root><abc>value</abc></root>');
        expect(result['abc']).toBe('value');
    });

    it('computes position after close tag > correctly (cgt + 1)', () => {
        const result = makeParser().parse('<root><x>1</x><y>2</y><z>3</z></root>');
        expect(result['x']).toBe('1');
        expect(result['y']).toBe('2');
        expect(result['z']).toBe('3');
    });
});

describe(`${XmlParser.name} > mutation killing - root extraction edge cases`, () => {
    it('handles root tag name of exactly 1 character', () => {
        expect(makeParser().parse('<r><a>v</a></r>')).toEqual({ a: 'v' });
    });

    it('handles root tag with dot in name', () => {
        expect(makeParser().parse('<r.x><a>v</a></r.x>')).toEqual({ a: 'v' });
    });

    it('handles root tag with hyphen in name', () => {
        expect(makeParser().parse('<r-x><a>v</a></r-x>')).toEqual({ a: 'v' });
    });

    it('handles root tag with underscore prefix', () => {
        expect(makeParser().parse('<_r><a>v</a></_r>')).toEqual({ a: 'v' });
    });

    it('handles close tag where nameStart is exactly 2', () => {
        expect(makeParser().parse('<a>v</a>')).toEqual({ '#text': 'v' });
    });

    it('handles close tag where nameStart calculation is at boundary', () => {
        expect(makeParser().parse('<ab>v</ab>')).toEqual({ '#text': 'v' });
    });
});

describe(`${XmlParser.name} > mutation killing - nesting counter boundary conditions`, () => {
    it('does not match close tag prefix of longer name (nestDepth boundary)', () => {
        const result = makeParser().parse('<root><a><ab>inner</ab>rest</a></root>');
        const a = result['a'] as Record<string, unknown>;
        expect(a['ab']).toBe('inner');
    });

    it('three-deep same-name nesting counts correctly', () => {
        const result = makeParser().parse('<root><a><a><a>deep</a></a></a></root>');
        const a1 = result['a'] as Record<string, unknown>;
        const a2 = a1['a'] as Record<string, unknown>;
        expect(a2['a']).toBe('deep');
    });

    it('handles no inner > found during nesting search (ogt === -1)', () => {
        const result = makeParser().parse('<root><a>text</a></root>');
        expect(result['a']).toBe('text');
    });

    it('handles tag name scanning up to content.length boundary', () => {
        const result = makeParser().parse('<root><longtagname>value</longtagname></root>');
        expect(result['longtagname']).toBe('value');
    });
});

describe(`${XmlParser.name} > mutation killing - error paths in extractRootContent`, () => {
    it('throws and includes error for empty-looking document', () => {
        expect(() => makeParser().parse('#')).toThrow(/XmlAccessor/);
    });

    it('throws for document starting with < but second char is not alpha', () => {
        expect(() => makeParser().parse('<!')).toThrow(InvalidFormatException);
    });

    it('throws for root with wrong closing tag name', () => {
        expect(() => makeParser().parse('<abc>text</xyz>')).toThrow(InvalidFormatException);
    });

    it('throws when close tag < is not preceded by /', () => {
        expect(() => makeParser().parse('<root>val<root>')).toThrow(InvalidFormatException);
    });
});

describe(`${XmlParser.name} > mutation killing - L139 doc.length boundary`, () => {
    it('rejects single-char document that is just <', () => {
        expect(() => makeParser().parse('<')).toThrow(InvalidFormatException);
    });

    it('rejects two-char document <! (no valid root)', () => {
        expect(() => makeParser().parse('<!')).toThrow(InvalidFormatException);
    });

    it('accepts shortest valid self-closing: <a/>', () => {
        expect(makeParser().parse('<a/>')).toEqual({});
    });
});

describe(`${XmlParser.name} > mutation killing - self-closing root edge cases`, () => {
    it('rejects self-closing root with trailing content after >', () => {
        expect(() => makeParser().parse('<root/>extra')).toThrow(InvalidFormatException);
    });

    it('root self-closing with attributes', () => {
        // Self-closing produces empty object even with attributes (manual parser)
        expect(makeParser().parse('<root attr="v"/>')).toEqual({});
    });

    it('root self-closing with space before slash', () => {
        expect(makeParser().parse('<root />')).toEqual({});
    });
});

describe(`${XmlParser.name} > mutation killing - L173 backward walk boundary`, () => {
    it('root close tag with no whitespace before >', () => {
        expect(makeParser().parse('<root>text</root>')).toEqual({ '#text': 'text' });
    });

    it('handles single-char root tag in close tag backward walk', () => {
        expect(makeParser().parse('<r>t</r>')).toEqual({ '#text': 't' });
    });
});

describe(`${XmlParser.name} > mutation killing - L208-218 parseXmlChildren inner loop`, () => {
    it('stops scanning when no more < found in children content', () => {
        expect(makeParser().parse('<root>plain text only</root>')).toEqual({
            '#text': 'plain text only',
        });
    });

    it('handles child content that ends right at a close tag', () => {
        const r = makeParser().parse('<root><a>1</a></root>');
        expect(r['a']).toBe('1');
    });

    it('handles consecutive comments then element', () => {
        const r = makeParser().parse('<root><!-- c1 --><!-- c2 --><!-- c3 --><a>v</a></root>');
        expect(r['a']).toBe('v');
    });

    it('handles processing instruction in children', () => {
        const r = makeParser().parse('<root><?pi data?><a>v</a></root>');
        expect(r['a']).toBe('v');
    });

    it('handles closing tag appearing in children (skipped via /)', () => {
        const r = makeParser().parse('<root></stray><a>v</a></root>');
        expect(r['a']).toBe('v');
    });
});

describe(`${XmlParser.name} > mutation killing - L255 nesting loop boundaries`, () => {
    it('correctly matches close tag when nestDepth transitions from 1 to 0', () => {
        const r = makeParser().parse('<root><item>value</item></root>');
        expect(r['item']).toBe('value');
    });

    it('handles two-level same-name nesting', () => {
        const r = makeParser().parse('<root><x><x>inner</x></x></root>');
        expect((r['x'] as Record<string, unknown>)['x']).toBe('inner');
    });

    it('handles three-level same-name nesting to stress nestDepth counter', () => {
        const r = makeParser().parse('<root><n><n><n>d</n></n></n></root>');
        const n1 = r['n'] as Record<string, unknown>;
        const n2 = n1['n'] as Record<string, unknown>;
        expect(n2['n']).toBe('d');
    });
});

describe(`${XmlParser.name} > mutation killing - L265-266 close tag arithmetic`, () => {
    it('handles multi-char tag name in close tag position calculation', () => {
        const r = makeParser().parse('<root><abcdef>val</abcdef></root>');
        expect(r['abcdef']).toBe('val');
    });

    it('handles after-close position for two siblings with long names', () => {
        const r = makeParser().parse('<root><alpha>1</alpha><beta>2</beta></root>');
        expect(r['alpha']).toBe('1');
        expect(r['beta']).toBe('2');
    });
});

describe(`${XmlParser.name} > mutation killing - L276 close delimiter chars`, () => {
    it('close tag followed by > is recognized', () => {
        const r = makeParser().parse('<root><k>v</k></root>');
        expect(r['k']).toBe('v');
    });

    it('close tag with space before > in child', () => {
        const r = makeParser().parse('<root><k>v</k ></root>');
        expect(r['k']).toBe('v');
    });

    it('close tag with tab before > in child', () => {
        const r = makeParser().parse('<root><k>v</k\t></root>');
        expect(r['k']).toBe('v');
    });

    it('close tag with newline before > in child', () => {
        const r = makeParser().parse('<root><k>v</k\n></root>');
        expect(r['k']).toBe('v');
    });

    it('close tag with CR before > in child', () => {
        const r = makeParser().parse('<root><k>v</k\r></root>');
        expect(r['k']).toBe('v');
    });
});

describe(`${XmlParser.name} > mutation killing - L278 open prefix matching`, () => {
    it('does not count non-self-closing same-name open tag in nesting', () => {
        const r = makeParser().parse('<root><a><a>deep</a>rest</a></root>');
        const a = r['a'] as Record<string, unknown>;
        expect(a['a']).toBe('deep');
    });

    it('detects self-closing same-name tag without incrementing nestDepth', () => {
        const r = makeParser().parse('<root><a><a />after</a></root>');
        const a = r['a'] as Record<string, unknown>;
        expect(a['a']).toBe('');
    });

    it('handles open prefix with attributes (space after tag name)', () => {
        const r = makeParser().parse('<root><a><a id="1">deep</a>rest</a></root>');
        const a = r['a'] as Record<string, unknown>;
        expect(a['a']).toBe('deep');
    });
});

describe(`${XmlParser.name} > mutation killing - L297-300 trimmedInner detection`, () => {
    it('treats empty inner content as empty string value (not child parse)', () => {
        const r = makeParser().parse('<root><e></e></root>');
        expect(r['e']).toBe('');
    });

    it('treats whitespace-only inner content as empty string value', () => {
        const r = makeParser().parse('<root><e>   </e></root>');
        expect(r['e']).toBe('');
    });

    it('treats non-empty text without elements as string (not record)', () => {
        const r = makeParser().parse('<root><e>text</e></root>');
        expect(typeof r['e']).toBe('string');
        expect(r['e']).toBe('text');
    });

    it('parses inner content with elements as record', () => {
        const r = makeParser().parse('<root><e><f>v</f></e></root>');
        expect(typeof r['e']).toBe('object');
        expect((r['e'] as Record<string, unknown>)['f']).toBe('v');
    });

    it('flattens single #text child to string', () => {
        const r = makeParser().parse('<root><wrap><inner>val</inner></wrap></root>');
        expect((r['wrap'] as Record<string, unknown>)['inner']).toBe('val');
    });

    it('does not flatten multi-key child', () => {
        const r = makeParser().parse('<root><wrap><a>1</a><b>2</b></wrap></root>');
        const w = r['wrap'] as Record<string, unknown>;
        expect(w['a']).toBe('1');
        expect(w['b']).toBe('2');
    });
});

describe(`${XmlParser.name} > mutation killing - L239 attribute trimming`, () => {
    it('extracts attribute content with trimEnd on attributes string', () => {
        const r = makeParser().parse('<root><item key="val" >text</item></root>');
        expect(r['item']).toBe('text');
    });

    it('parses tag with attribute and no space before >', () => {
        const r = makeParser().parse('<root><item key="val">text</item></root>');
        expect(r['item']).toBe('text');
    });
});

describe(`${XmlParser.name} > mutation killing - L189 closeTagStart boundary`, () => {
    it('rejects when close tag start equals open tag end', () => {
        // <a></a> has closeTagStart=3, openGt=2 → closeTagStart > openGt → valid
        expect(makeParser().parse('<a></a>')).toEqual({});
    });
});
