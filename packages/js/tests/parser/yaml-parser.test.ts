import { describe, expect, it } from 'vitest';
import { YamlParser } from '../../src/parser/yaml-parser.js';
import { YamlParseException } from '../../src/exceptions/yaml-parse-exception.js';

function makeParser(): YamlParser {
    return new YamlParser();
}

describe(YamlParser.name, () => {
    it('parses a simple key-value pair', () => {
        expect(makeParser().parse('name: Alice')).toEqual({ name: 'Alice' });
    });

    it('returns empty object for empty string', () => {
        expect(makeParser().parse('')).toEqual({});
    });

    it('returns empty object for comment-only input', () => {
        expect(makeParser().parse('# comment only')).toEqual({});
    });

    it('parses multiple root-level keys', () => {
        expect(makeParser().parse('a: 1\nb: 2')).toEqual({ a: 1, b: 2 });
    });

    it('parses nested keys', () => {
        expect(makeParser().parse('user:\n  name: Alice\n  age: 30')).toEqual({
            user: { name: 'Alice', age: 30 },
        });
    });

    it('parses a sequence of scalars', () => {
        const result = makeParser().parse('- a\n- b\n- c');
        expect(result).toEqual({});
    });
});

describe(`${YamlParser.name} > scalar types`, () => {
    it('casts integer values', () => {
        expect(makeParser().parse('count: 42')).toEqual({ count: 42 });
    });

    it('casts negative integers', () => {
        expect(makeParser().parse('offset: -10')).toEqual({ offset: -10 });
    });

    it('casts float values', () => {
        expect(makeParser().parse('ratio: 3.14')).toEqual({ ratio: 3.14 });
    });

    it('casts true boolean', () => {
        expect(makeParser().parse('active: true')).toEqual({ active: true });
    });

    it('casts false boolean', () => {
        expect(makeParser().parse('active: false')).toEqual({ active: false });
    });

    it('casts null value', () => {
        expect(makeParser().parse('value: null')).toEqual({ value: null });
    });

    it('casts tilde ~ as null', () => {
        expect(makeParser().parse('value: ~')).toEqual({ value: null });
    });

    it('casts empty value as null', () => {
        expect(makeParser().parse('value: ')).toEqual({ value: null });
    });

    it('preserves double-quoted strings without stripping content', () => {
        expect(makeParser().parse('msg: "hello world"')).toEqual({ msg: 'hello world' });
    });

    it('preserves single-quoted strings without stripping content', () => {
        expect(makeParser().parse("msg: 'hello world'")).toEqual({ msg: 'hello world' });
    });

    it('preserves string values that look like numbers (quoted)', () => {
        expect(makeParser().parse("code: '007'")).toEqual({ code: '007' });
    });
});

describe(`${YamlParser.name} > CRLF handling`, () => {
    it('parses CRLF line endings correctly', () => {
        expect(makeParser().parse('a: 1\r\nb: 2')).toEqual({ a: 1, b: 2 });
    });
});

describe(`${YamlParser.name} > sequences`, () => {
    it('parses a sequence under a key', () => {
        const result = makeParser().parse('items:\n  - apple\n  - banana');
        expect(result).toEqual({ items: ['apple', 'banana'] });
    });

    it('parses a sequence with map items', () => {
        const yaml = 'items:\n  - name: Alice\n  - name: Bob';
        const result = makeParser().parse(yaml);
        expect(result).toEqual({ items: [{ name: 'Alice' }, { name: 'Bob' }] });
    });

    it('parses empty sequence item as null', () => {
        const yaml = 'items:\n  -\n  - b';
        const result = makeParser().parse(yaml);
        expect((result['items'] as unknown[])[0]).toBeNull();
        expect((result['items'] as unknown[])[1]).toBe('b');
    });
});

describe(`${YamlParser.name} > block scalars`, () => {
    it('parses literal block scalar |', () => {
        const yaml = 'text: |\n  hello\n  world';
        const result = makeParser().parse(yaml);
        expect(result['text']).toBe('hello\nworld');
    });

    it('parses folded block scalar >', () => {
        const yaml = 'text: >\n  hello\n  world';
        const result = makeParser().parse(yaml);
        expect(result['text']).toBe('hello world');
    });
});

describe(`${YamlParser.name} > inline flow`, () => {
    it('parses simple inline array of quoted strings', () => {
        // Only JSON-compatible inline flows are parsed correctly
        const yaml = "tags: ['a', 'b', 'c']";
        const result = makeParser().parse(yaml);
        // single quotes converted to double for JSON.parse → valid JSON array
        expect(result['tags']).toEqual(['a', 'b', 'c']);
    });

    it('falls back to raw string for unquoted inline array (not JSON-compatible)', () => {
        // unquoted identifiers are not valid JSON → fallback to raw string
        const yaml = 'tags: [a, b, c]';
        const result = makeParser().parse(yaml);
        expect(result['tags']).toBe('[a, b, c]');
    });

    it('falls back to raw string for unparseable inline flow', () => {
        // Intentionally malformed to trigger fallback
        const yaml = 'tags: [a b c';
        const result = makeParser().parse(yaml);
        expect(result['tags']).toBe('[a b c');
    });
});

describe(`${YamlParser.name} > security — unsafe constructs`, () => {
    it('throws YamlParseException for !! tags', () => {
        expect(() => makeParser().parse('key: !!python/object foo')).toThrow(YamlParseException);
    });

    it('throws with a message mentioning tags for !! syntax', () => {
        expect(() => makeParser().parse('key: !!str value')).toThrow(/tag/i);
    });

    it('includes the line number in the !! tag error message', () => {
        expect(() => makeParser().parse('\nkey: !!str value')).toThrow(/line 2/);
    });

    it('throws YamlParseException for ! tags', () => {
        expect(() => makeParser().parse('key: !custom value')).toThrow(YamlParseException);
    });

    it('throws YamlParseException for anchors (&)', () => {
        expect(() => makeParser().parse('a: &anchor hello')).toThrow(YamlParseException);
    });

    it('throws YamlParseException for anchor at start of line (no preceding space)', () => {
        expect(() => makeParser().parse('&anchor: value')).toThrow(YamlParseException);
    });

    it('throws with a message mentioning anchors', () => {
        expect(() => makeParser().parse('a: &anchor hello')).toThrow(/anchor/i);
    });

    it('includes the line number in the anchor error message', () => {
        expect(() => makeParser().parse('\na: &anchor hello')).toThrow(/line 2/);
    });

    it('detects anchor on a line whose value ends with a hash character', () => {
        expect(() => makeParser().parse('a: &anchor value#')).toThrow(YamlParseException);
    });

    it('throws YamlParseException for aliases (*)', () => {
        expect(() => makeParser().parse('a: *alias')).toThrow(YamlParseException);
    });

    it('throws YamlParseException for alias at start of line (no preceding space)', () => {
        expect(() => makeParser().parse('*alias: value')).toThrow(YamlParseException);
    });

    it('throws with a message mentioning aliases', () => {
        expect(() => makeParser().parse('a: *alias')).toThrow(/alias/i);
    });

    it('includes the line number in the alias error message', () => {
        expect(() => makeParser().parse('\na: *alias')).toThrow(/line 2/);
    });

    it('throws YamlParseException for merge keys (<<)', () => {
        expect(() => makeParser().parse('<<: {a: 1}')).toThrow(YamlParseException);
    });

    it('throws YamlParseException for indented merge key', () => {
        expect(() => makeParser().parse('mapping:\n  <<: {a: 1}')).toThrow(YamlParseException);
    });

    it('throws YamlParseException for merge key with space before colon', () => {
        expect(() => makeParser().parse('<< : {a: 1}')).toThrow(YamlParseException);
    });

    it('throws with a message mentioning merge keys', () => {
        expect(() => makeParser().parse('<<: {a: 1}')).toThrow(/merge key/i);
    });

    it('includes the line number in the merge key error message', () => {
        expect(() => makeParser().parse('\n<<: {a: 1}')).toThrow(/line 2/);
    });

    it('does not throw for <<: appearing inside a string value', () => {
        expect(() => makeParser().parse('note: use <<: syntax')).not.toThrow();
    });

    it('does not throw for ! inside double-quoted string', () => {
        // quoted string — regex should not match
        expect(() => makeParser().parse('msg: "hello world"')).not.toThrow();
    });
});

describe(`${YamlParser.name} > top-level non-map`, () => {
    it('returns empty object when top-level is a sequence (not a map)', () => {
        // Top-level sequences can't be a Record, so parse returns {}
        const yaml = '- a\n- b';
        const result = makeParser().parse(yaml);
        expect(result).toEqual({});
    });
});

describe(`${YamlParser.name} > mergeChildLines`, () => {
    it('parses nested map inside sequence item with sibling keys', () => {
        const yaml = 'users:\n  - name: Alice\n    role: admin\n  - name: Bob\n    role: user';
        const result = makeParser().parse(yaml);
        expect(result).toEqual({
            users: [
                { name: 'Alice', role: 'admin' },
                { name: 'Bob', role: 'user' },
            ],
        });
    });

    it('preserves sibling key after a nested block within a sequence item', () => {
        const yaml = 'list:\n  - a: 1\n    b:\n      c: 2\n    d: 3';
        expect(makeParser().parse(yaml)).toEqual({ list: [{ a: 1, b: { c: 2 }, d: 3 }] });
    });

    it('skips a comment line containing a colon inside a sequence item child block', () => {
        const yaml = 'items:\n  - name: Alice\n    # role: admin\n    active: true';
        expect(makeParser().parse(yaml)).toEqual({ items: [{ name: 'Alice', active: true }] });
    });
});

describe(`${YamlParser.name} > comments`, () => {
    it('skips inline comment lines', () => {
        const yaml = '# comment\nname: Alice\n# another comment';
        expect(makeParser().parse(yaml)).toEqual({ name: 'Alice' });
    });

    it('parses a key whose value ends with a hash character', () => {
        expect(makeParser().parse('key: value#')).toEqual({ key: 'value#' });
    });

    it('includes child keys that follow a root-level comment inside a nested block', () => {
        const yaml = 'parent:\n  key1: value1\n# root comment\n  key2: value2';
        expect(makeParser().parse(yaml)).toEqual({ parent: { key1: 'value1', key2: 'value2' } });
    });
});

describe(`${YamlParser.name} > nested blocks with blank lines and indentation`, () => {
    it('handles empty lines inside a nested block', () => {
        expect(makeParser().parse('user:\n  name: Alice\n\n  age: 30')).toEqual({
            user: { name: 'Alice', age: 30 },
        });
    });

    it('handles comment lines inside a nested block', () => {
        expect(makeParser().parse('user:\n  name: Alice\n  # inline comment\n  age: 30')).toEqual({
            user: { name: 'Alice', age: 30 },
        });
    });

    it('ignores over-indented lines relative to current block', () => {
        const yaml = 'user:\n  name: Alice\n    extra: ignored\n  age: 30';
        const result = makeParser().parse(yaml);
        expect(result).toEqual({ user: { name: 'Alice', age: 30 } });
    });
});

describe(`${YamlParser.name} > sequence bare dash with block children`, () => {
    it('parses bare dash followed by indented map as a map item', () => {
        const yaml = 'items:\n  -\n    name: Alice\n    role: admin\n  - b';
        const result = makeParser().parse(yaml);
        expect((result['items'] as unknown[])[0]).toEqual({ name: 'Alice', role: 'admin' });
        expect((result['items'] as unknown[])[1]).toBe('b');
    });
});

describe(`${YamlParser.name} > top-level result type`, () => {
    it('result is not an array when top-level is a sequence', () => {
        expect(Array.isArray(makeParser().parse('- a\n- b'))).toBe(false);
    });
});

describe(`${YamlParser.name} > indentation — over-indented key at block start`, () => {
    it('ignores an over-indented key appearing before a properly-indented sibling', () => {
        expect(makeParser().parse('outer:\n    over_indented: ignored\n  normal: value')).toEqual({
            outer: { normal: 'value' },
        });
    });
});

describe(`${YamlParser.name} > sequence item content trimming`, () => {
    it('trims extra leading space when sequence item has multiple spaces after dash', () => {
        expect(makeParser().parse('items:\n  -  value')).toEqual({ items: ['value'] });
    });
});

describe(`${YamlParser.name} > raw value whitespace`, () => {
    it('strips trailing whitespace from a scalar value', () => {
        expect(makeParser().parse('key: value   ')).toEqual({ key: 'value' });
    });
});

describe(`${YamlParser.name} > non-key lines ignored`, () => {
    it('skips lines with no colon at root level and parses valid keys that follow', () => {
        expect(makeParser().parse('just_a_value\nkey: valid')).toEqual({ key: 'valid' });
    });
});

describe(`${YamlParser.name} > inline flow objects`, () => {
    it('parses inline flow object with single-quoted values', () => {
        expect(makeParser().parse("config: {host: 'localhost', port: '8080'}")).toEqual({
            config: { host: 'localhost', port: '8080' },
        });
    });
});

describe(`${YamlParser.name} > block scalar trailing whitespace`, () => {
    it('strips trailing newline from literal block scalar with trailing blank line', () => {
        expect(makeParser().parse('text: |\n  hello\n\n')).toEqual({ text: 'hello' });
    });

    it('strips trailing space from folded block scalar with trailing blank line', () => {
        expect(makeParser().parse('text: >\n  hello\n\n')).toEqual({ text: 'hello' });
    });
});

describe(`${YamlParser.name} > partially-quoted strings`, () => {
    it('does not strip a string that starts with double-quote but lacks closing quote', () => {
        expect(makeParser().parse('msg: "hello')).toEqual({ msg: '"hello' });
    });

    it('does not strip a string that ends with double-quote but lacks opening quote', () => {
        expect(makeParser().parse('msg: hello"')).toEqual({ msg: 'hello"' });
    });

    it('does not strip a string that starts with single-quote but lacks closing quote', () => {
        expect(makeParser().parse("msg: 'hello")).toEqual({ msg: "'hello" });
    });

    it('does not strip a string that ends with single-quote but lacks opening quote', () => {
        expect(makeParser().parse("msg: hello'")).toEqual({ msg: "hello'" });
    });

    it('does not strip a string that starts and ends with different quote chars', () => {
        expect(makeParser().parse("msg: \"hello'")).toEqual({ msg: '"hello\'' });
    });
});

describe(`${YamlParser.name} > float parsing edge cases`, () => {
    it('does not parse a string with leading digit group but extra suffix as float', () => {
        expect(makeParser().parse('val: 3.14extra')).toEqual({ val: '3.14extra' });
    });

    it('does not parse a string with trailing decimal dot as float', () => {
        expect(makeParser().parse('val: 3.')).toEqual({ val: '3.' });
    });
});

describe(`${YamlParser.name} > mergeChildLines sibling rows`, () => {
    it('parses only sibling keys at the correct indentation in mergeChildLines', () => {
        const yaml =
            'items:\n  - role: admin\n    level: 1\n    name: Alice\n  - role: user\n    name: Bob';
        const result = makeParser().parse(yaml);
        expect(result).toEqual({
            items: [
                { role: 'admin', level: 1, name: 'Alice' },
                { role: 'user', name: 'Bob' },
            ],
        });
    });

    it('stops mergeChildLines when indentation drops below child indent', () => {
        const yaml = 'items:\n  - role: admin\n    level: 1\n  - role: user';
        const result = makeParser().parse(yaml);
        const items = result['items'] as unknown[];
        expect((items[0] as Record<string, unknown>)['level']).toBe(1);
        expect((items[1] as Record<string, unknown>)['level']).toBeUndefined();
    });

    it('ignores an over-indented sibling line in mergeChildLines', () => {
        const yaml =
            'items:\n  - role: admin\n      over: ignored\n    level: 1\n  - role: user';
        const result = makeParser().parse(yaml);
        const items = result['items'] as unknown[];
        expect((items[0] as Record<string, unknown>)['level']).toBe(1);
        expect((items[0] as Record<string, unknown>)['over']).toBeUndefined();
        expect((items[1] as Record<string, unknown>)['role']).toBe('user');
    });
});

describe(`${YamlParser.name} > scalar types — extended`, () => {
    it('casts multi-digit float values', () => {
        expect(makeParser().parse('ratio: 10.5')).toEqual({ ratio: 10.5 });
    });

    it('does not parse a value with non-digit prefix as float', () => {
        expect(makeParser().parse('val: abc3.14')).toEqual({ val: 'abc3.14' });
    });

    it('parses keys with multiple spaces after colon', () => {
        expect(makeParser().parse('key:  value')).toEqual({ key: 'value' });
    });
});

describe(`${YamlParser.name} > block scalar — blank lines and folded`, () => {
    it('preserves a blank line in the middle of a literal block scalar', () => {
        expect(makeParser().parse('text: |\n  hello\n\n  world')).toEqual({
            text: 'hello\n\nworld',
        });
    });
});

describe(`${YamlParser.name} > inline flow — key with space before colon`, () => {
    it('parses inline object with space before colon in key', () => {
        expect(makeParser().parse("config: {key : 'value'}")).toEqual({
            config: { key: 'value' },
        });
    });
});

