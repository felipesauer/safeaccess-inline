import { describe, expect, it } from 'vitest';
import { YamlParser } from '../../src/parser/yaml-parser.js';
import { YamlParseException } from '../../src/exceptions/yaml-parse-exception.js';

function makeParser(): YamlParser {
    return new YamlParser();
}

describe(`${YamlParser.name} > mutation killing - assertNoUnsafeConstructs`, () => {
    // Kills L50 trimStart→trimEnd: indented comment with tag syntax must be skipped
    it('does not throw for indented comment containing !! tag syntax', () => {
        expect(() => makeParser().parse('key: value\n  # !!python/object foo')).not.toThrow();
    });

    it('does not throw for indented comment containing & anchor syntax', () => {
        expect(() => makeParser().parse('key: value\n  # &anchor reference')).not.toThrow();
    });

    it('does not throw for indented comment containing * alias syntax', () => {
        expect(() => makeParser().parse('key: value\n  # *alias reference')).not.toThrow();
    });

    // Kills L52 || → && and BlockStatement → {}: comment with tag is skipped
    it('does not throw for root comment line with !! tag', () => {
        expect(() => makeParser().parse('# !!str tagged\nkey: value')).not.toThrow();
    });

    it('does not throw for root comment line with anchor', () => {
        expect(() => makeParser().parse('# &ref anchored\nkey: value')).not.toThrow();
    });

    it('does not throw for root comment line with alias', () => {
        expect(() => makeParser().parse('# *ref aliased\nkey: value')).not.toThrow();
    });

    // Kills L52:29 StringLiteral '' → "Stryker was here!": whitespace-only line
    // with unsafe construct on same line (would fail if empty check is broken AND
    // the blank line somehow reaches the regex)
    it('parses correctly with blank line between keys', () => {
        const result = makeParser().parse('a: 1\n\nb: 2');
        expect(result).toEqual({ a: 1, b: 2 });
    });
});

describe(`${YamlParser.name} > mutation killing - parseLines comment/blank handling`, () => {
    // Kills L106 ConditionalExpression→false: comment with colon must be ignored
    it('ignores comment lines containing colons in nested blocks', () => {
        const yaml = 'root:\n  # comment: with colon\n  key: value';
        expect(makeParser().parse(yaml)).toEqual({ root: { key: 'value' } });
    });

    // Kills L106:60-L109:14 BlockStatement → {}: same as above
    it('skips comment containing key-value syntax in root level', () => {
        const yaml = '# fake: entry\nreal: value';
        expect(makeParser().parse(yaml)).toEqual({ real: 'value' });
    });

    // Kills L106 || → && : empty line followed by comment with colon
    it('handles empty line then comment-with-colon in nested block', () => {
        const yaml = 'root:\n\n  # x: y\n  actual: data';
        expect(makeParser().parse(yaml)).toEqual({ root: { actual: 'data' } });
    });
});

describe(`${YamlParser.name} > mutation killing - key:value regex`, () => {
    // Kills L130 \s*→\s: key:value with no space after colon in sequence
    it('parses sequence item key:value without space after colon', () => {
        const yaml = 'items:\n  - key:value';
        const result = makeParser().parse(yaml);
        expect(result).toEqual({ items: [{ key: 'value' }] });
    });

    // Kills L164 \s*→\s: mergeChildLines key:value without space after colon
    it('parses mergeChildLines key:value without space after colon', () => {
        const yaml = 'items:\n  - name: Alice\n    role:admin';
        expect(makeParser().parse(yaml)).toEqual({
            items: [{ name: 'Alice', role: 'admin' }],
        });
    });

    // Kills L216 \s*→\s: resolveValue/map key:value without space
    it('parses root map key:value without space after colon', () => {
        const yaml = 'key:value';
        expect(makeParser().parse(yaml)).toEqual({ key: 'value' });
    });

    // Kills \s*→\S*: leading space in value should be trimmed
    it('trims value correctly when there are multiple spaces after colon', () => {
        const yaml = 'key:   spaced';
        expect(makeParser().parse(yaml)).toEqual({ key: 'spaced' });
    });

    // Kills L127 ConditionalExpression→false: empty item content should parse as null
    it('parses bare dash producing null when no block children follow', () => {
        const yaml = 'items:\n  -\nnext: key';
        const result = makeParser().parse(yaml);
        expect((result['items'] as unknown[])[0]).toBeNull();
    });

    // Kills L127:49 StringLiteral '' → "": itemContent check for dash-only
    it('distinguishes bare dash from dash with content', () => {
        const yaml = 'items:\n  - \n  - value';
        const result = makeParser().parse(yaml);
        const items = result['items'] as unknown[];
        expect(items[0]).toBeNull();
        expect(items[1]).toBe('value');
    });

    // Kills L130:21 ConditionalExpression→true: non-empty content should try regex
    it('handles sequence item with pure scalar (no colon)', () => {
        const yaml = 'items:\n  - justtext';
        expect(makeParser().parse(yaml)).toEqual({ items: ['justtext'] });
    });

    // Kills L130:37 StringLiteral '' → "Stryker was here!": empty check
    it('correctly handles dash with space but no content', () => {
        const yaml = 'list:\n  -  \n  - real';
        const result = makeParser().parse(yaml);
        const items = result['list'] as unknown[];
        expect(items[0]).toBeNull();
        expect(items[1]).toBe('real');
    });
});

describe(`${YamlParser.name} > mutation killing - resolveValue`, () => {
    it('resolves empty value with child block as nested map', () => {
        const yaml = 'parent:\n  child: deep';
        expect(makeParser().parse(yaml)).toEqual({ parent: { child: 'deep' } });
    });

    it('resolves truly empty value after colon as nested block', () => {
        const yaml = 'wrapper:\n  inner:\n    leaf: val';
        expect(makeParser().parse(yaml)).toEqual({
            wrapper: { inner: { leaf: 'val' } },
        });
    });

    it('returns null for empty value when no children follow', () => {
        const yaml = 'top:\nempty:';
        const result = makeParser().parse(yaml);
        expect(result['empty']).toBeNull();
    });

    it('treats non-empty trimmed value as scalar (not nested block)', () => {
        const yaml = 'key: simple';
        expect(makeParser().parse(yaml)).toEqual({ key: 'simple' });
    });
});

describe(`${YamlParser.name} > mutation killing - assertNoUnsafeConstructs skip`, () => {
    it('does not throw for comment with anchor syntax preceded by whitespace', () => {
        expect(() => makeParser().parse('  # &ref anchor\nkey: val')).not.toThrow();
    });

    it('does not throw for standalone blank line between valid YAML', () => {
        expect(makeParser().parse('a: 1\n\nb: 2')).toEqual({ a: 1, b: 2 });
    });

    it('does not throw for comment containing alias syntax', () => {
        expect(() => makeParser().parse('# *alias text\nkey: value')).not.toThrow();
    });

    it('does not throw for comment containing tag syntax in assertNoUnsafeConstructs', () => {
        expect(() => makeParser().parse('# !!str tagged\nkey: value')).not.toThrow();
    });

    it('treats blank trimmed line as skip target in assertNoUnsafeConstructs', () => {
        expect(() => makeParser().parse('\n\n\nkey: value')).not.toThrow();
    });
});

describe(`${YamlParser.name} > mutation killing - parseLines comment/blank skip`, () => {
    it('skips comment with colon at root level in parseLines', () => {
        expect(makeParser().parse('# key: fakevalue\nreal: data')).toEqual({ real: 'data' });
    });

    it('skips blank line followed by comment inside nested block', () => {
        const yaml = 'root:\n\n  # comment: fake\n  key: value';
        expect(makeParser().parse(yaml)).toEqual({ root: { key: 'value' } });
    });

    it('treats bare blank line inside block as ignorable', () => {
        const yaml = 'items:\n  - a\n\n  - b';
        expect(makeParser().parse(yaml)).toEqual({ items: ['a', 'b'] });
    });
});

describe(`${YamlParser.name} > mutation killing - sequence key-value detection`, () => {
    it('detects key:value in sequence item vs plain scalar', () => {
        const yaml = 'items:\n  - key: val\n  - plaintext';
        const result = makeParser().parse(yaml);
        const items = result['items'] as unknown[];
        expect(items[0]).toEqual({ key: 'val' });
        expect(items[1]).toBe('plaintext');
    });

    it('does not apply key:value regex to empty sequence content', () => {
        const yaml = 'items:\n  -\n  - value';
        const result = makeParser().parse(yaml);
        const items = result['items'] as unknown[];
        expect(items[0]).toBeNull();
        expect(items[1]).toBe('value');
    });

    it('parses sequence item with only scalar (no colon) as plain value', () => {
        expect(makeParser().parse('list:\n  - nocolon')).toEqual({ list: ['nocolon'] });
    });
});

describe(`${YamlParser.name} > mutation killing - block scalar regex anchors`, () => {
    it('does not treat value ending with pipe as block scalar', () => {
        expect(makeParser().parse('text: a|')).toEqual({ text: 'a|' });
    });

    it('does not treat value ending with > as block scalar', () => {
        expect(makeParser().parse('text: a>')).toEqual({ text: 'a>' });
    });

    it('does not treat value starting with pipe followed by text as block scalar', () => {
        expect(makeParser().parse('text: |text')).toEqual({ text: '|text' });
    });

    it('does not treat value starting with > followed by text as block scalar', () => {
        expect(makeParser().parse('text: >text')).toEqual({ text: '>text' });
    });
});

describe(`${YamlParser.name} > mutation killing - octal regex anchors`, () => {
    it('does not parse value with prefix before 0o as octal', () => {
        expect(makeParser().parse('val: 100o7')).toEqual({ val: '100o7' });
    });

    it('does not parse 0o with trailing non-octal chars as octal', () => {
        expect(makeParser().parse('val: 0o77x')).toEqual({ val: '0o77x' });
    });

    it('does not parse single octal digit suffix as octal', () => {
        expect(makeParser().parse('val: x0o7')).toEqual({ val: 'x0o7' });
    });
});

describe(`${YamlParser.name} > mutation killing - hex regex anchors`, () => {
    it('does not parse value with prefix before 0x as hex', () => {
        expect(makeParser().parse('val: x0xFF')).toEqual({ val: 'x0xFF' });
    });

    it('does not parse 0x with trailing non-hex chars as hex', () => {
        expect(makeParser().parse('val: 0xFFg')).toEqual({ val: '0xFFg' });
    });

    it('does not parse single hex digit standalone', () => {
        expect(makeParser().parse('val: 0xG')).toEqual({ val: '0xG' });
    });
});

describe(`${YamlParser.name} > mutation killing - float regex edge cases`, () => {
    it('parses float with uppercase E notation', () => {
        expect(makeParser().parse('val: 2.0E5')).toEqual({ val: 200000 });
    });

    it('parses float without sign in exponent', () => {
        expect(makeParser().parse('val: 1.0e2')).toEqual({ val: 100 });
    });

    it('parses float with explicit positive exponent', () => {
        expect(makeParser().parse('val: 1.0e+2')).toEqual({ val: 100 });
    });

    it('parses float with negative exponent', () => {
        expect(makeParser().parse('val: 1.0e-2')).toEqual({ val: 0.01 });
    });

    it('parses float with multi-digit exponent', () => {
        expect(makeParser().parse('val: 1.0e10')).toEqual({ val: 1.0e10 });
    });

    it('does not parse value with dot but no digits after as float', () => {
        expect(makeParser().parse('val: 1.')).toEqual({ val: '1.' });
    });

    it('float regex requires includes dot in value', () => {
        const result = makeParser().parse('val: 42');
        expect(result['val']).toBe(42);
        expect(Number.isInteger(result['val'] as number)).toBe(true);
    });
});

describe(`${YamlParser.name} > mutation killing - stripInlineComment fast-path`, () => {
    it('strips hash after double-quoted value without space before hash', () => {
        expect(makeParser().parse('key: "hello"# comment')).toEqual({ key: 'hello' });
    });

    it('strips hash after single-quoted value without space before hash', () => {
        expect(makeParser().parse("key: 'hello'# comment")).toEqual({ key: 'hello' });
    });

    it('does not strip when first char repeats and hash follows second occurrence', () => {
        expect(makeParser().parse('key: a xa # comment')).toEqual({ key: 'a xa' });
    });

    it('preserves double-quote-started value when no closing quote found', () => {
        expect(makeParser().parse('key: "unclosed')).toEqual({ key: '"unclosed' });
    });

    it('preserves single-quote-started value when no closing quote found', () => {
        expect(makeParser().parse("key: 'unclosed")).toEqual({ key: "'unclosed" });
    });

    it('returns full quoted value when nothing follows closing quote', () => {
        expect(makeParser().parse('key: "complete"')).toEqual({ key: 'complete' });
    });

    it('returns full single-quoted value when nothing follows closing quote', () => {
        expect(makeParser().parse("key: 'complete'")).toEqual({ key: 'complete' });
    });

    it('falls through to general loop when afterQuote is not empty or hash', () => {
        expect(makeParser().parse('key: "word" extra')).toEqual({ key: '"word" extra' });
    });
});

describe(`${YamlParser.name} > mutation killing - stripInlineComment general loop`, () => {
    it('does not strip hash at position 0 even with following space', () => {
        expect(makeParser().parse('key: #value rest')).toEqual({ key: '#value rest' });
    });

    it('strips hash preceded by space in unquoted value', () => {
        expect(makeParser().parse('key: abc # rest')).toEqual({ key: 'abc' });
    });

    it('does not strip hash immediately after text without space', () => {
        expect(makeParser().parse('key: test#value')).toEqual({ key: 'test#value' });
    });

    it('does not strip hash when preceded by non-space (hash after text# space)', () => {
        expect(makeParser().parse('key: test# value')).toEqual({ key: 'test# value' });
    });

    it('single-quote protects hash in general loop', () => {
        expect(makeParser().parse("key: 'x # y'")).toEqual({ key: 'x # y' });
    });

    it('double-quote protects hash in general loop', () => {
        expect(makeParser().parse('key: "x # y"')).toEqual({ key: 'x # y' });
    });
});

describe(`${YamlParser.name} > mutation killing - folded block edge cases`, () => {
    it('folded block with leading blank line joins subsequent lines with space', () => {
        const yaml = 'text: >\n\n  a\n  b';
        expect(makeParser().parse(yaml)).toEqual({ text: '\na b\n' });
    });

    it('folded block endsWith newline check prevents double space after newline', () => {
        const yaml = 'text: >\n  first\n\n  second\n  third';
        const result = makeParser().parse(yaml);
        expect(result['text']).toBe('first\nsecond third\n');
    });

    it('folded block single line gets trailing newline with clip chomping', () => {
        expect(makeParser().parse('text: >\n  only')).toEqual({ text: 'only\n' });
    });

    it('literal block preserves exact indentation stripping from first line', () => {
        const yaml = 'text: |\n    deep\n    also';
        const result = makeParser().parse(yaml);
        expect(result['text']).toBe('deep\nalso\n');
        expect((result['text'] as string).startsWith(' ')).toBe(false);
    });

    it('block scalar trim vs trimStart matters for indent detection', () => {
        const yaml = 'text: |\n  with trailing   \n  spaces   ';
        const result = makeParser().parse(yaml);
        expect(result['text']).toBe('with trailing   \nspaces   \n');
    });
});

describe(`${YamlParser.name} > mutation killing - parseLines sequence edge cases`, () => {
    it('bare dash (no space) treated as sequence item', () => {
        const yaml = 'items:\n  -\n  -\n  - c';
        const result = makeParser().parse(yaml);
        const items = result['items'] as unknown[];
        expect(items[0]).toBeNull();
        expect(items[1]).toBeNull();
        expect(items[2]).toBe('c');
    });

    it('dash with space and trailing whitespace parses content correctly', () => {
        const yaml = 'items:\n  -  value  ';
        const result = makeParser().parse(yaml);
        expect((result['items'] as unknown[])[0]).toBe('value');
    });

    it('sequence item regex match captures key and value groups', () => {
        const yaml = 'items:\n  - k1: v1\n  - k2: v2';
        const result = makeParser().parse(yaml);
        const items = result['items'] as Record<string, unknown>[];
        expect(items[0]).toEqual({ k1: 'v1' });
        expect(items[1]).toEqual({ k2: 'v2' });
    });

    it('sequence item with empty value after colon parses nested block', () => {
        const yaml = 'items:\n  - parent:\n    child: value';
        const result = makeParser().parse(yaml);
        const items = result['items'] as Record<string, unknown>[];
        expect(items[0]['parent']).toEqual({ child: 'value' });
        expect(items[0]['child']).toBe('value');
    });
});

describe(`${YamlParser.name} > mutation killing - splitFlowItems trailing`, () => {
    it('does not push whitespace-only trailing item (trim check)', () => {
        const result = makeParser().parse('items: [a,  ]');
        expect((result['items'] as unknown[]).length).toBe(1);
    });

    it('does not push empty trailing item after last comma', () => {
        const result = makeParser().parse('items: [x, y,]');
        expect((result['items'] as unknown[]).length).toBe(2);
    });

    it('pushes non-empty trailing item without comma', () => {
        const result = makeParser().parse('items: [x, y]');
        expect((result['items'] as unknown[]).length).toBe(2);
    });
});

describe(`${YamlParser.name} > mutation killing - flow map value trim`, () => {
    it('trims value after colon in flow map entry', () => {
        expect(makeParser().parse('m: {k:  v  }')).toEqual({ m: { k: 'v' } });
    });

    it('flow map entry with no colon is skipped', () => {
        const result = makeParser().parse('m: {nocolon}');
        expect(result).toEqual({ m: {} });
    });

    it('flow map with multiple entries including colon-less', () => {
        expect(makeParser().parse('m: {skip, a: 1, skip2, b: 2}')).toEqual({
            m: { a: 1, b: 2 },
        });
    });
});

describe(`${YamlParser.name} > mutation killing - castScalar trim and length`, () => {
    it('castScalar trims whitespace from value before type detection', () => {
        expect(makeParser().parse('val:  true  ')).toEqual({ val: true });
    });

    it('castScalar handles exactly length 2 quoted string ""', () => {
        const result = makeParser().parse('val: ""');
        expect(result['val']).toBe('');
        expect(typeof result['val']).toBe('string');
    });

    it("castScalar handles exactly length 2 quoted string ''", () => {
        const result = makeParser().parse("val: ''");
        expect(result['val']).toBe('');
        expect(typeof result['val']).toBe('string');
    });

    it('castScalar does not unquote length 1 strings', () => {
        expect(makeParser().parse("val: '")).toEqual({ val: "'" });
    });
});

describe(`${YamlParser.name} > mutation killing - mergeChildLines regex`, () => {
    it('child key:value regex does not match bare text in sibling', () => {
        const yaml = 'items:\n  - key: val\n    bareword';
        const result = makeParser().parse(yaml);
        const items = result['items'] as Record<string, unknown>[];
        expect(items[0]['key']).toBe('val');
        expect(items[0]['bareword']).toBeUndefined();
    });
});

describe(`${YamlParser.name} > mutation killing - parseLines indentation and comment skip`, () => {
    it('comment line is skipped at all indent levels in parseLines', () => {
        const yaml = '# L1 comment\nkey: val\n  # L3 nested comment';
        expect(makeParser().parse(yaml)).toEqual({ key: 'val' });
    });

    it('blank line is skipped at all indent levels in parseLines', () => {
        const yaml = '\nkey: val\n\n';
        expect(makeParser().parse(yaml)).toEqual({ key: 'val' });
    });

    it('comment line between sequence items is skipped', () => {
        const yaml = 'items:\n  - a\n  # comment\n  - b';
        expect(makeParser().parse(yaml)).toEqual({ items: ['a', 'b'] });
    });

    it('blank line between map keys is skipped', () => {
        const yaml = 'a: 1\n\nb: 2\n\nc: 3';
        expect(makeParser().parse(yaml)).toEqual({ a: 1, b: 2, c: 3 });
    });
});

describe(`${YamlParser.name} > mutation killing - resolveValue trimming`, () => {
    it('resolveValue trims rawValue before checking block scalar indicator', () => {
        const yaml = 'text: |   \n  content';
        expect(makeParser().parse(yaml)).toEqual({ text: 'content\n' });
    });

    it('resolveValue trims rawValue before checking flow sequence', () => {
        const yaml = 'items: [a, b]   ';
        expect(makeParser().parse(yaml)).toEqual({ items: ['a', 'b'] });
    });

    it('resolveValue trims rawValue before checking flow map', () => {
        const yaml = 'config: {a: 1}   ';
        expect(makeParser().parse(yaml)).toEqual({ config: { a: 1 } });
    });
});

describe(`${YamlParser.name} > mutation killing - assertNoUnsafeConstructs startsWith`, () => {
    it('rejects ! tag syntax on non-comment non-empty line', () => {
        expect(() => makeParser().parse('val: !ruby/hash {}')).toThrow(YamlParseException);
    });

    it('does not reject ! inside string value (no tag syntax)', () => {
        expect(() => makeParser().parse('val: hello!')).not.toThrow();
    });

    it('rejects !! tag on first line', () => {
        expect(() => makeParser().parse('!!map\nkey: val')).toThrow(YamlParseException);
    });
});

describe(`${YamlParser.name} > mutation killing - flow sequence item casting`, () => {
    it('casts each flow sequence item individually', () => {
        expect(makeParser().parse('items: [1, true, null, hello]')).toEqual({
            items: [1, true, null, 'hello'],
        });
    });

    it('flow sequence item trim removes whitespace before casting', () => {
        expect(makeParser().parse('items: [  42  ]')).toEqual({ items: [42] });
    });
});

describe(`${YamlParser.name} > mutation killing - block scalar empty line push`, () => {
    it('pushes empty string for blank line in block scalar', () => {
        const yaml = 'text: |\n  line1\n\n  line3';
        const result = makeParser().parse(yaml);
        expect(result['text']).toBe('line1\n\nline3\n');
    });

    it('block scalar with only blank lines and strip chomping returns empty', () => {
        const yaml = 'text: |-\n\n\n';
        const result = makeParser().parse(yaml);
        expect(result['text']).toBe('');
    });

    it('block scalar detects indentation from first non-blank content line', () => {
        const yaml = 'text: |\n\n  first\n  second';
        const result = makeParser().parse(yaml);
        expect(result['text']).toBe('\nfirst\nsecond\n');
    });
});

describe(`${YamlParser.name} > mutation killing - scientific notation without dot`, () => {
    it('does not parse 1e5 as number (no dot, returned as string)', () => {
        const result = makeParser().parse('val: 1e5');
        expect(result['val']).toBe('1e5');
        expect(typeof result['val']).toBe('string');
    });

    it('does not parse -1e5 as number (no dot)', () => {
        expect(makeParser().parse('val: -1e5')).toEqual({ val: '-1e5' });
    });

    it('does not parse 2E3 as number (no dot)', () => {
        expect(makeParser().parse('val: 2E3')).toEqual({ val: '2E3' });
    });
});

describe(`${YamlParser.name} > mutation killing - assertNoUnsafeConstructs condition`, () => {
    it('skips blank line before a line with !! tag', () => {
        expect(() => makeParser().parse('\n!!seq [a]')).toThrow(YamlParseException);
    });

    it('skips comment-only line before a line with !! tag', () => {
        expect(() => makeParser().parse('# safe\n!!str hello')).toThrow(YamlParseException);
    });

    it('skips comment containing tag syntax followed by real tag', () => {
        expect(() => makeParser().parse('# !!safe comment\n!!str real')).toThrow(
            YamlParseException,
        );
    });

    it('does not throw for blank-then-comment-then-valid YAML', () => {
        const result = makeParser().parse('\n# comment\nkey: val');
        expect(result).toEqual({ key: 'val' });
    });

    it('does not throw when only blank and comment lines are present with unsafe syntax in them', () => {
        const result = makeParser().parse('# !!tag\n# &anchor\n# *alias\nkey: val');
        expect(result).toEqual({ key: 'val' });
    });
});

describe(`${YamlParser.name} > mutation killing - parseLines blank/comment condition`, () => {
    it('skips comment with sequence syntax inside nested block', () => {
        const yaml = 'root:\n  # - fake item\n  key: val';
        expect(makeParser().parse(yaml)).toEqual({ root: { key: 'val' } });
    });

    it('skips blank line then processes next valid line at same indent', () => {
        const yaml = 'root:\n  a: 1\n\n  b: 2';
        expect(makeParser().parse(yaml)).toEqual({ root: { a: 1, b: 2 } });
    });

    it('comment in sequence position does not create item', () => {
        const yaml = 'items:\n  - a\n  # not an item\n  - b';
        const result = makeParser().parse(yaml);
        expect((result['items'] as unknown[]).length).toBe(2);
    });
});

describe(`${YamlParser.name} > mutation killing - sequence bare dash handling`, () => {
    it('bare dash without following content becomes null', () => {
        const yaml = 'list:\n  -';
        const result = makeParser().parse(yaml);
        expect((result['list'] as unknown[])[0]).toBeNull();
    });

    it('bare dash with following indented block parses as child', () => {
        const yaml = 'list:\n  -\n    key: val';
        const result = makeParser().parse(yaml);
        expect((result['list'] as unknown[])[0]).toEqual({ key: 'val' });
    });

    it('bare dash at end of document becomes null', () => {
        const yaml = 'list:\n  - a\n  -';
        const result = makeParser().parse(yaml);
        const items = result['list'] as unknown[];
        expect(items[0]).toBe('a');
        expect(items[1]).toBeNull();
    });

    it('dash with space trims content for scalar', () => {
        const yaml = 'list:\n  - hello world';
        const result = makeParser().parse(yaml);
        expect((result['list'] as unknown[])[0]).toBe('hello world');
    });

    it('sequence item content with quotes is preserved', () => {
        const yaml = "list:\n  - 'quoted value'";
        const result = makeParser().parse(yaml);
        expect((result['list'] as unknown[])[0]).toBe('quoted value');
    });
});

describe(`${YamlParser.name} > mutation killing - sequence item regex vs scalar`, () => {
    it('empty itemContent does not attempt regex match', () => {
        const yaml = 'items:\n  -\n    a: 1';
        const result = makeParser().parse(yaml);
        expect((result['items'] as unknown[])[0]).toEqual({ a: 1 });
    });

    it('non-empty itemContent without colon is pushed as scalar', () => {
        const yaml = 'items:\n  - plainvalue';
        expect(makeParser().parse(yaml)).toEqual({ items: ['plainvalue'] });
    });

    it('non-empty itemContent with colon is parsed as key-value', () => {
        const yaml = 'items:\n  - k: v';
        expect(makeParser().parse(yaml)).toEqual({ items: [{ k: 'v' }] });
    });
});

describe(`${YamlParser.name} > mutation killing - block scalar indent stripping`, () => {
    it('block scalar strips indentation based on first content line', () => {
        const yaml = 'text: |\n    indented content\n    more content';
        const result = makeParser().parse(yaml);
        expect(result['text']).toBe('indented content\nmore content\n');
    });

    it('block scalar does not include leading indentation in output', () => {
        const yaml = 'text: |\n  hello\n  world';
        const result = makeParser().parse(yaml);
        expect((result['text'] as string).startsWith('hello')).toBe(true);
        expect((result['text'] as string).includes('  hello')).toBe(false);
    });
});

describe(`${YamlParser.name} > mutation killing - flow items initial state`, () => {
    it('flow sequence first item has no prefix', () => {
        const result = makeParser().parse('items: [first]');
        const items = result['items'] as string[];
        expect(items[0]).toBe('first');
        expect(items[0].length).toBe(5);
    });

    it('flow map first key has no prefix', () => {
        const result = makeParser().parse('m: {first: val}');
        expect(Object.keys(result['m'] as Record<string, unknown>)[0]).toBe('first');
    });

    it('flow sequence with single numeric has correct value', () => {
        expect(makeParser().parse('items: [42]')).toEqual({ items: [42] });
    });

    it('flow map with single entry has correct key and value', () => {
        const result = makeParser().parse('m: {key: 42}');
        expect((result['m'] as Record<string, unknown>)['key']).toBe(42);
    });
});

describe(`${YamlParser.name} > mutation killing - stripInlineComment closePos`, () => {
    it('quoted value without trailing text is returned as-is', () => {
        expect(makeParser().parse('key: "value"')).toEqual({ key: 'value' });
    });

    it('quoted value with only whitespace after closing quote is trimmed', () => {
        expect(makeParser().parse('key: "value"   ')).toEqual({ key: 'value' });
    });

    it('quoted value followed by # is trimmed to quoted value', () => {
        expect(makeParser().parse('key: "value" # comment')).toEqual({ key: 'value' });
    });

    it('quoted value followed by text is returned including text', () => {
        expect(makeParser().parse('key: "value" text')).toEqual({ key: '"value" text' });
    });

    it('single-quoted value followed by # is trimmed to quoted value', () => {
        expect(makeParser().parse("key: 'value' # comment")).toEqual({ key: 'value' });
    });
});

describe(`${YamlParser.name} > mutation killing - stripInlineComment loop bounds`, () => {
    it('value with no hash returns entire value', () => {
        expect(makeParser().parse('key: nohash')).toEqual({ key: 'nohash' });
    });

    it('hash at first position with space after is not stripped (i=0 guard)', () => {
        expect(makeParser().parse('key: #start')).toEqual({ key: '#start' });
    });

    it('hash at second position with preceding space is stripped', () => {
        expect(makeParser().parse('key: x #rest')).toEqual({ key: 'x' });
    });

    it('substring before comment is trimmed of trailing whitespace', () => {
        expect(makeParser().parse('key: value   # comment')).toEqual({ key: 'value' });
    });
});
