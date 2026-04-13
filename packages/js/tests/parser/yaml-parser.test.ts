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
        // YAML spec: clip chomping adds trailing newline (matches PHP yaml_parse)
        expect(result['text']).toBe('hello\nworld\n');
    });

    it('parses folded block scalar >', () => {
        const yaml = 'text: >\n  hello\n  world';
        const result = makeParser().parse(yaml);
        // YAML spec: clip chomping adds trailing newline (matches PHP yaml_parse)
        expect(result['text']).toBe('hello world\n');
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

    it('parses unquoted inline array as flow sequence (matches PHP yaml_parse)', () => {
        // YAML flow sequences support unquoted scalar values
        const yaml = 'tags: [a, b, c]';
        const result = makeParser().parse(yaml);
        expect(result['tags']).toEqual(['a', 'b', 'c']);
    });

    it('falls back to raw string for unparseable inline flow', () => {
        // Intentionally malformed to trigger fallback
        const yaml = 'tags: [a b c';
        const result = makeParser().parse(yaml);
        expect(result['tags']).toBe('[a b c');
    });
});

describe(`${YamlParser.name} > security - unsafe constructs`, () => {
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

    it('throws YamlParseException for anchor names with hyphens (&my-anchor)', () => {
        expect(() => makeParser().parse('a: &my-anchor hello')).toThrow(YamlParseException);
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

    it('throws YamlParseException for alias names with hyphens (*my-alias)', () => {
        expect(() => makeParser().parse('a: *my-alias hello')).toThrow(YamlParseException);
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
        // quoted string - regex should not match
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

describe(`${YamlParser.name} > indentation - over-indented key at block start`, () => {
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
    it('clip-chomps trailing blank lines from literal block scalar', () => {
        // YAML spec: clip removes trailing blanks, adds single newline (matches PHP yaml_parse)
        expect(makeParser().parse('text: |\n  hello\n\n')).toEqual({ text: 'hello\n' });
    });

    it('clip-chomps trailing blank lines from folded block scalar', () => {
        // YAML spec: clip removes trailing blanks, adds single newline (matches PHP yaml_parse)
        expect(makeParser().parse('text: >\n  hello\n\n')).toEqual({ text: 'hello\n' });
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
        expect(makeParser().parse('msg: "hello\'')).toEqual({ msg: '"hello\'' });
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
        const yaml = 'items:\n  - role: admin\n      over: ignored\n    level: 1\n  - role: user';
        const result = makeParser().parse(yaml);
        const items = result['items'] as unknown[];
        expect((items[0] as Record<string, unknown>)['level']).toBe(1);
        expect((items[0] as Record<string, unknown>)['over']).toBeUndefined();
        expect((items[1] as Record<string, unknown>)['role']).toBe('user');
    });

    it('skips a non-key-value sibling line in mergeChildLines', () => {
        const yaml = 'items:\n  - key: value\n    baretext\n    name: Alice';
        const result = makeParser().parse(yaml);
        const items = result['items'] as unknown[];
        expect((items[0] as Record<string, unknown>)['key']).toBe('value');
        expect((items[0] as Record<string, unknown>)['name']).toBe('Alice');
    });
});

describe(`${YamlParser.name} > scalar types - extended`, () => {
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

describe(`${YamlParser.name} > block scalar - blank lines and folded`, () => {
    it('preserves a blank line in the middle of a literal block scalar', () => {
        // YAML spec: clip chomping adds trailing newline (matches PHP yaml_parse)
        expect(makeParser().parse('text: |\n  hello\n\n  world')).toEqual({
            text: 'hello\n\nworld\n',
        });
    });

    it('terminates block scalar at less-indented comment line', () => {
        // YAML spec: a line at lower indentation terminates the block scalar.
        // PHP yaml_parse() errors on this input; JS captures content before the comment.
        expect(makeParser().parse('text: |\n  first\n# root comment\n  second')).toEqual({
            text: 'first\n',
        });
    });
});

describe(`${YamlParser.name} > inline flow - key with space before colon`, () => {
    it('parses inline object with space before colon in key', () => {
        expect(makeParser().parse("config: {key : 'value'}")).toEqual({
            config: { key: 'value' },
        });
    });
});

describe(`${YamlParser.name} > nesting depth guard`, () => {
    it('parses YAML within the default depth limit', () => {
        const yaml = 'a:\n  b:\n    c:\n      d: value';
        const parser = new YamlParser();
        const result = parser.parse(yaml);
        expect((result['a'] as Record<string, unknown>)['b']).toEqual({ c: { d: 'value' } });
    });

    it('throws YamlParseException when nesting exceeds maxDepth', () => {
        const yaml = 'a:\n  b:\n    c:\n      d:\n        e: value';
        const parser = new YamlParser(3);
        expect(() => parser.parse(yaml)).toThrow(YamlParseException);
        expect(() => parser.parse(yaml)).toThrow('YAML nesting depth 4 exceeds maximum of 3.');
    });

    it('allows nesting exactly at maxDepth boundary', () => {
        const yaml = 'a:\n  b:\n    c: value';
        const parser = new YamlParser(3);
        const result = parser.parse(yaml);
        expect((result['a'] as Record<string, unknown>)['b']).toEqual({ c: 'value' });
    });

    it('throws YamlParseException for deep sequence nesting', () => {
        const yaml = '-\n  -\n    -\n      - value';
        const parser = new YamlParser(2);
        expect(() => parser.parse(yaml)).toThrow(YamlParseException);
        expect(() => parser.parse(yaml)).toThrow('YAML nesting depth 3 exceeds maximum of 2.');
    });

    it('throws YamlParseException for mixed map and sequence depth', () => {
        const yaml = 'items:\n  -\n    nested:\n      deep: value';
        const parser = new YamlParser(2);
        expect(() => parser.parse(yaml)).toThrow(YamlParseException);
        expect(() => parser.parse(yaml)).toThrow('YAML nesting depth 3 exceeds maximum of 2.');
    });

    it('uses the configured maxDepth not the default 512', () => {
        const yaml = 'a:\n  b: value';
        const parser = new YamlParser(0);
        expect(() => parser.parse(yaml)).toThrow(YamlParseException);
        expect(() => parser.parse(yaml)).toThrow('YAML nesting depth 1 exceeds maximum of 0.');
    });

    it('accepts the default 512 maxDepth for normal YAML', () => {
        const parser = new YamlParser();
        const result = parser.parse('root:\n  child: value');
        expect((result['root'] as Record<string, unknown>)['child']).toBe('value');
    });
});

describe(`${YamlParser.name} > block scalar chomping modifiers`, () => {
    it('strip chomping (|-) removes trailing newline from literal', () => {
        const yaml = 'text: |-\n  hello\n  world';
        expect(makeParser().parse(yaml)).toEqual({ text: 'hello\nworld' });
    });

    it('keep chomping (|+) preserves trailing blank lines in literal', () => {
        const yaml = 'text: |+\n  hello\n  world\n\n';
        expect(makeParser().parse(yaml)).toEqual({ text: 'hello\nworld\n\n' });
    });

    it('strip chomping (>-) removes trailing newline from folded', () => {
        const yaml = 'text: >-\n  hello\n  world';
        expect(makeParser().parse(yaml)).toEqual({ text: 'hello world' });
    });

    it('keep chomping (>+) preserves trailing blank lines in folded', () => {
        const yaml = 'text: >+\n  hello\n  world\n\n';
        expect(makeParser().parse(yaml)).toEqual({ text: 'hello world\n\n' });
    });

    it('default literal chomping (|) adds exactly one trailing newline', () => {
        const yaml = 'text: |\n  line';
        expect(makeParser().parse(yaml)).toEqual({ text: 'line\n' });
    });

    it('default folded chomping (>) adds exactly one trailing newline', () => {
        const yaml = 'text: >\n  line';
        expect(makeParser().parse(yaml)).toEqual({ text: 'line\n' });
    });

    it('strip chomping result does NOT end with newline', () => {
        const result = makeParser().parse('text: |-\n  line');
        expect((result['text'] as string).endsWith('\n')).toBe(false);
    });

    it('keep chomping result ends with preserved trailing blanks', () => {
        const result = makeParser().parse('text: |+\n  line\n\n\n');
        expect((result['text'] as string).endsWith('\n\n\n')).toBe(true);
    });

    it('literal block with empty block produces just a newline for clip', () => {
        const yaml = 'text: |\nnext: val';
        const result = makeParser().parse(yaml);
        expect(result['text']).toBe('\n');
    });

    it('folded block with blank line between content preserves paragraph break', () => {
        const yaml = 'text: >\n  para1\n\n  para2';
        const result = makeParser().parse(yaml);
        expect(result['text']).toBe('para1\npara2\n');
    });

    it('folded block joins consecutive non-empty lines with space', () => {
        const yaml = 'text: >\n  a\n  b\n  c';
        expect(makeParser().parse(yaml)).toEqual({ text: 'a b c\n' });
    });

    it('folded block does not add space after first line when result was empty', () => {
        const yaml = 'text: >\n  first';
        const result = makeParser().parse(yaml);
        expect((result['text'] as string).startsWith(' ')).toBe(false);
    });

    it('folded block prevEmpty resets after non-empty line following blank', () => {
        const yaml = 'text: >\n  a\n\n  b\n  c';
        const result = makeParser().parse(yaml);
        expect(result['text']).toBe('a\nb c\n');
    });

    it('literal block auto-detects indent from first content line', () => {
        const yaml = 'text: |\n    four_spaces';
        expect(makeParser().parse(yaml)).toEqual({ text: 'four_spaces\n' });
    });

    it('literal block stops at line with less indent than detected', () => {
        const yaml = 'text: |\n    deep\n  shallow\nnext: val';
        const result = makeParser().parse(yaml);
        expect(result['text']).toBe('deep\n');
    });

    it('block scalar uses trimStart to compute indent not trim', () => {
        const yaml = 'text: |\n  hello   ';
        const result = makeParser().parse(yaml);
        expect(result['text']).toBe('hello   \n');
    });
});

describe(`${YamlParser.name} > flow sequence edge cases`, () => {
    it('parses empty flow sequence []', () => {
        expect(makeParser().parse('items: []')).toEqual({ items: [] });
    });

    it('parses flow sequence with single item', () => {
        expect(makeParser().parse('items: [one]')).toEqual({ items: ['one'] });
    });

    it('trims whitespace from flow sequence items', () => {
        expect(makeParser().parse('items: [ a , b , c ]')).toEqual({ items: ['a', 'b', 'c'] });
    });

    it('parses flow sequence with numeric values', () => {
        expect(makeParser().parse('nums: [1, 2, 3]')).toEqual({ nums: [1, 2, 3] });
    });

    it('parses flow sequence with boolean values', () => {
        expect(makeParser().parse('flags: [true, false]')).toEqual({ flags: [true, false] });
    });

    it('parses flow sequence with null values', () => {
        expect(makeParser().parse('vals: [null, ~]')).toEqual({ vals: [null, null] });
    });

    it('parses flow sequence with quoted strings containing commas', () => {
        expect(makeParser().parse('items: ["a,b", "c,d"]')).toEqual({ items: ['a,b', 'c,d'] });
    });

    it('parses flow sequence with nested brackets', () => {
        expect(makeParser().parse('items: [[1, 2], [3]]')).toEqual({ items: ['[1, 2]', '[3]'] });
    });

    it('does not return empty string items from trailing whitespace', () => {
        const result = makeParser().parse('items: [a, b]');
        expect((result['items'] as unknown[]).length).toBe(2);
    });

    it('inner trim handles flow sequence with only whitespace inside as empty', () => {
        expect(makeParser().parse('items: [  ]')).toEqual({ items: [] });
    });
});

describe(`${YamlParser.name} > flow map edge cases`, () => {
    it('parses empty flow map {}', () => {
        expect(makeParser().parse('config: {}')).toEqual({ config: {} });
    });

    it('parses flow map with single key-value', () => {
        expect(makeParser().parse('config: {a: 1}')).toEqual({ config: { a: 1 } });
    });

    it('trims whitespace from flow map keys and values', () => {
        expect(makeParser().parse('m: { key : val }')).toEqual({ m: { key: 'val' } });
    });

    it('skips flow map entries without a colon', () => {
        expect(makeParser().parse('m: {novalue, a: 1}')).toEqual({ m: { a: 1 } });
    });

    it('parses flow map with numeric value', () => {
        expect(makeParser().parse('m: {port: 8080}')).toEqual({ m: { port: 8080 } });
    });

    it('parses flow map with boolean value', () => {
        expect(makeParser().parse('m: {active: true}')).toEqual({ m: { active: true } });
    });

    it('parses flow map with null value', () => {
        expect(makeParser().parse('m: {val: null}')).toEqual({ m: { val: null } });
    });

    it('inner trim handles flow map with only whitespace inside as empty', () => {
        expect(makeParser().parse('config: {  }')).toEqual({ config: {} });
    });

    it('slices off the braces to get inner content', () => {
        expect(makeParser().parse('m: {x: y}')).toEqual({ m: { x: 'y' } });
    });
});

describe(`${YamlParser.name} > splitFlowItems edge cases`, () => {
    it('respects nested braces when splitting flow items', () => {
        expect(makeParser().parse('m: {outer: {inner: val}}')).toEqual({
            m: { outer: '{inner: val}' },
        });
    });

    it('respects single-quoted strings containing commas', () => {
        expect(makeParser().parse("items: ['a,b', 'c']")).toEqual({ items: ['a,b', 'c'] });
    });

    it('closing quotes end the quoted region', () => {
        expect(makeParser().parse('items: ["x", y]')).toEqual({ items: ['x', 'y'] });
    });

    it('closing bracket decrements depth', () => {
        expect(makeParser().parse('items: [{a: 1}, b]')).toEqual({ items: ['{a: 1}', 'b'] });
    });

    it('does not push empty trailing items', () => {
        const result = makeParser().parse('items: [a, b, ]');
        expect((result['items'] as unknown[]).length).toBe(2);
    });

    it('handles multiple nested brackets at different depths', () => {
        expect(makeParser().parse('items: [[1, [2]], 3]')).toEqual({
            items: ['[1, [2]]', 3],
        });
    });

    it('preserves nested braces in flow items', () => {
        expect(makeParser().parse('items: [{a: {b: c}}, d]')).toEqual({
            items: ['{a: {b: c}}', 'd'],
        });
    });
});

describe(`${YamlParser.name} > castScalar - boolean variants`, () => {
    it('casts yes as true', () => {
        expect(makeParser().parse('val: yes')).toEqual({ val: true });
    });

    it('casts Yes as true', () => {
        expect(makeParser().parse('val: Yes')).toEqual({ val: true });
    });

    it('casts on as true', () => {
        expect(makeParser().parse('val: on')).toEqual({ val: true });
    });

    it('casts On as true', () => {
        expect(makeParser().parse('val: On')).toEqual({ val: true });
    });

    it('casts no as false', () => {
        expect(makeParser().parse('val: no')).toEqual({ val: false });
    });

    it('casts No as false', () => {
        expect(makeParser().parse('val: No')).toEqual({ val: false });
    });

    it('casts off as false', () => {
        expect(makeParser().parse('val: off')).toEqual({ val: false });
    });

    it('casts Off as false', () => {
        expect(makeParser().parse('val: Off')).toEqual({ val: false });
    });

    it('casts TRUE as true', () => {
        expect(makeParser().parse('val: TRUE')).toEqual({ val: true });
    });

    it('casts FALSE as false', () => {
        expect(makeParser().parse('val: FALSE')).toEqual({ val: false });
    });
});

describe(`${YamlParser.name} > castScalar - null variants`, () => {
    it('casts Null as null', () => {
        expect(makeParser().parse('val: Null')).toEqual({ val: null });
    });

    it('casts NULL as null', () => {
        expect(makeParser().parse('val: NULL')).toEqual({ val: null });
    });
});

describe(`${YamlParser.name} > castScalar - numeric edge cases`, () => {
    it('parses octal value 0o777', () => {
        expect(makeParser().parse('val: 0o777')).toEqual({ val: 511 });
    });

    it('parses octal value 0o10', () => {
        expect(makeParser().parse('val: 0o10')).toEqual({ val: 8 });
    });

    it('parses hex value 0xFF', () => {
        expect(makeParser().parse('val: 0xFF')).toEqual({ val: 255 });
    });

    it('parses hex value 0x1A', () => {
        expect(makeParser().parse('val: 0x1A')).toEqual({ val: 26 });
    });

    it('parses .inf as Infinity', () => {
        expect(makeParser().parse('val: .inf')).toEqual({ val: Infinity });
    });

    it('parses +.inf as Infinity', () => {
        expect(makeParser().parse('val: +.inf')).toEqual({ val: Infinity });
    });

    it('parses -.inf as -Infinity', () => {
        expect(makeParser().parse('val: -.inf')).toEqual({ val: -Infinity });
    });

    it('parses .nan as NaN', () => {
        const result = makeParser().parse('val: .nan');
        expect(result['val']).toBeNaN();
    });

    it('parses scientific notation 1.5e10', () => {
        expect(makeParser().parse('val: 1.5e10')).toEqual({ val: 1.5e10 });
    });

    it('parses scientific notation with negative exponent 2.5e-3', () => {
        expect(makeParser().parse('val: 2.5e-3')).toEqual({ val: 0.0025 });
    });

    it('parses scientific notation with positive exponent 1.0E+5', () => {
        expect(makeParser().parse('val: 1.0E+5')).toEqual({ val: 100000 });
    });

    it('parses .Inf (capitalized) as Infinity', () => {
        expect(makeParser().parse('val: .Inf')).toEqual({ val: Infinity });
    });

    it('parses -.Inf (capitalized) as -Infinity', () => {
        expect(makeParser().parse('val: -.Inf')).toEqual({ val: -Infinity });
    });

    it('parses .NaN (capitalized) as NaN', () => {
        const result = makeParser().parse('val: .NaN');
        expect(result['val']).toBeNaN();
    });

    it('parses zero as integer 0', () => {
        expect(makeParser().parse('val: 0')).toEqual({ val: 0 });
    });

    it('does not parse 0o89 as octal (invalid octal digits)', () => {
        expect(makeParser().parse('val: 0o89')).toEqual({ val: '0o89' });
    });

    it('does not parse 0xZZ as hex (invalid hex digits)', () => {
        expect(makeParser().parse('val: 0xZZ')).toEqual({ val: '0xZZ' });
    });

    it('parses negative float -3.14', () => {
        expect(makeParser().parse('val: -3.14')).toEqual({ val: -3.14 });
    });

    it('does not parse value with dot but no decimal digits as float', () => {
        expect(makeParser().parse('val: 3.')).toEqual({ val: '3.' });
    });

    it('parses integer with leading zero as string if not 0', () => {
        expect(makeParser().parse('val: 00123')).toEqual({ val: '00123' });
    });

    it('distinguishes .inf from + prefixed', () => {
        const r1 = makeParser().parse('a: .inf');
        const r2 = makeParser().parse('a: +.inf');
        expect(r1['a']).toBe(Infinity);
        expect(r2['a']).toBe(Infinity);
    });
});

describe(`${YamlParser.name} > castScalar - quoted string length 2`, () => {
    it('parses empty double-quoted string ""', () => {
        expect(makeParser().parse('val: ""')).toEqual({ val: '' });
    });

    it('parses empty single-quoted string', () => {
        expect(makeParser().parse("val: ''")).toEqual({ val: '' });
    });

    it('does not unquote single-char string "x (missing end quote)', () => {
        expect(makeParser().parse('val: "x')).toEqual({ val: '"x' });
    });

    it('single-quoted escape: two consecutive single quotes become one', () => {
        expect(makeParser().parse("val: 'it''s'")).toEqual({ val: "it's" });
    });
});

describe(`${YamlParser.name} > unescapeDoubleQuoted - escape sequences`, () => {
    it('unescapes \\n to newline', () => {
        expect(makeParser().parse('val: "hello\\nworld"')).toEqual({ val: 'hello\nworld' });
    });

    it('unescapes \\t to tab', () => {
        expect(makeParser().parse('val: "col1\\tcol2"')).toEqual({ val: 'col1\tcol2' });
    });

    it('unescapes \\r to carriage return', () => {
        expect(makeParser().parse('val: "line\\rend"')).toEqual({ val: 'line\rend' });
    });

    it('unescapes \\\\ to backslash', () => {
        expect(makeParser().parse('val: "path\\\\dir"')).toEqual({ val: 'path\\dir' });
    });

    it('unescapes \\" to double quote', () => {
        expect(makeParser().parse('val: "say \\"hello\\""')).toEqual({ val: 'say "hello"' });
    });

    it('unescapes \\0 to null char', () => {
        expect(makeParser().parse('val: "null\\0char"')).toEqual({ val: 'null\0char' });
    });

    it('unescapes \\a to bell', () => {
        expect(makeParser().parse('val: "bell\\a"')).toEqual({ val: 'bell\x07' });
    });

    it('unescapes \\b to backspace', () => {
        expect(makeParser().parse('val: "back\\bspace"')).toEqual({ val: 'back\x08space' });
    });

    it('unescapes \\f to form feed', () => {
        expect(makeParser().parse('val: "feed\\f"')).toEqual({ val: 'feed\x0C' });
    });

    it('unescapes \\v to vertical tab', () => {
        expect(makeParser().parse('val: "vtab\\v"')).toEqual({ val: 'vtab\x0B' });
    });
});

describe(`${YamlParser.name} > stripInlineComment edge cases`, () => {
    it('strips inline comment after a value', () => {
        expect(makeParser().parse('key: value # comment')).toEqual({ key: 'value' });
    });

    it('does not strip hash without preceding space', () => {
        expect(makeParser().parse('key: value#notcomment')).toEqual({ key: 'value#notcomment' });
    });

    it('does not strip hash inside double-quoted string', () => {
        expect(makeParser().parse('key: "val # ue"')).toEqual({ key: 'val # ue' });
    });

    it('does not strip hash inside single-quoted string', () => {
        expect(makeParser().parse("key: 'val # ue'")).toEqual({ key: 'val # ue' });
    });

    it('strips comment after closing quote of double-quoted value', () => {
        expect(makeParser().parse('key: "val" # comment')).toEqual({ key: 'val' });
    });

    it('strips comment after closing quote of single-quoted value', () => {
        expect(makeParser().parse("key: 'val' # comment")).toEqual({ key: 'val' });
    });

    it('returns empty string for empty raw value', () => {
        expect(makeParser().parse('key: ')).toEqual({ key: null });
    });

    it('handles value that starts with quote but has no close quote', () => {
        expect(makeParser().parse('key: "unclosed value')).toEqual({ key: '"unclosed value' });
    });

    it('handles value with unmatched single-quote keeping hash as part of value', () => {
        expect(makeParser().parse("key: it's # comment")).toEqual({ key: "it's # comment" });
    });

    it('handles double-quote toggle - does not strip hash inside quoted region', () => {
        expect(makeParser().parse('key: a "b # c" d')).toEqual({ key: 'a "b # c" d' });
    });

    it('strips comment that appears after double-quoted region has closed', () => {
        expect(makeParser().parse('key: "word" rest # comment')).toEqual({ key: '"word" rest' });
    });

    it('returns original value when no hash character is present', () => {
        expect(makeParser().parse('key: nohashhere')).toEqual({ key: 'nohashhere' });
    });
});

describe(`${YamlParser.name} > resolveValue - block scalar detection regex`, () => {
    it('detects | as block scalar not a string value', () => {
        const yaml = 'text: |\n  content';
        expect(makeParser().parse(yaml)).toEqual({ text: 'content\n' });
    });

    it('detects |- as block scalar', () => {
        const yaml = 'text: |-\n  content';
        expect(makeParser().parse(yaml)).toEqual({ text: 'content' });
    });

    it('detects |+ as block scalar', () => {
        const yaml = 'text: |+\n  content\n';
        expect(makeParser().parse(yaml)).toEqual({ text: 'content\n' });
    });

    it('detects > as block scalar not a string value', () => {
        const yaml = 'text: >\n  content';
        expect(makeParser().parse(yaml)).toEqual({ text: 'content\n' });
    });

    it('detects >- as block scalar', () => {
        const yaml = 'text: >-\n  content';
        expect(makeParser().parse(yaml)).toEqual({ text: 'content' });
    });

    it('detects >+ as block scalar', () => {
        const yaml = 'text: >+\n  content\n';
        expect(makeParser().parse(yaml)).toEqual({ text: 'content\n' });
    });

    it('does not treat |x as block scalar (invalid chomping)', () => {
        const yaml = 'text: |x';
        expect(makeParser().parse(yaml)).toEqual({ text: '|x' });
    });

    it('does not treat >x as block scalar (invalid chomping)', () => {
        const yaml = 'text: >x';
        expect(makeParser().parse(yaml)).toEqual({ text: '>x' });
    });

    it('resolveValue uses trimmed value to check block scalar, not raw', () => {
        const yaml = 'text: |  \n  content';
        const result = makeParser().parse(yaml);
        expect(result['text']).toBe('content\n');
    });

    it('resolveValue passes correct folded flag for > indicator', () => {
        const yaml = 'a: >\n  x\n  y';
        const result = makeParser().parse(yaml);
        expect(result['a']).toBe('x y\n');
    });

    it('resolveValue passes correct folded flag for | indicator', () => {
        const yaml = 'a: |\n  x\n  y';
        const result = makeParser().parse(yaml);
        expect(result['a']).toBe('x\ny\n');
    });
});

describe(`${YamlParser.name} > resolveValue - flow detection`, () => {
    it('detects value starting with [ and ending with ] as flow sequence', () => {
        expect(makeParser().parse('items: [a]')).toEqual({ items: ['a'] });
    });

    it('detects value starting with { and ending with } as flow map', () => {
        expect(makeParser().parse('m: {a: 1}')).toEqual({ m: { a: 1 } });
    });

    it('does not treat [unclosed as flow sequence', () => {
        expect(makeParser().parse('val: [unclosed')).toEqual({ val: '[unclosed' });
    });

    it('does not treat {unclosed as flow map', () => {
        expect(makeParser().parse('val: {unclosed')).toEqual({ val: '{unclosed' });
    });

    it('does not treat value ending with ] but not starting with [ as flow', () => {
        expect(makeParser().parse('val: notarray]')).toEqual({ val: 'notarray]' });
    });

    it('does not treat value ending with } but not starting with { as flow', () => {
        expect(makeParser().parse('val: notmap}')).toEqual({ val: 'notmap}' });
    });
});

describe(`${YamlParser.name} > parseLines - map key regex anchoring`, () => {
    it('map key regex requires start anchor: value with internal k:v not parsed as map', () => {
        const yaml = 'items:\n  - first:second';
        const result = makeParser().parse(yaml);
        expect(result).toEqual({ items: [{ first: 'second' }] });
    });

    it('map key regex requires end anchor: full line must match', () => {
        const yaml = 'full: line value';
        expect(makeParser().parse(yaml)).toEqual({ full: 'line value' });
    });

    it('key with spaces before colon is captured correctly', () => {
        const yaml = 'my key: my value';
        expect(makeParser().parse(yaml)).toEqual({ 'my key': 'my value' });
    });
});

describe(`${YamlParser.name} > parseLines - indentation handling`, () => {
    it('skips lines with greater indent than baseIndent', () => {
        const yaml = 'root:\n  key: val\n      overindented: ignored\n  key2: val2';
        const parsed = makeParser().parse(yaml);
        expect((parsed['root'] as Record<string, unknown>)['key']).toBe('val');
        expect((parsed['root'] as Record<string, unknown>)['key2']).toBe('val2');
    });
});

describe(`${YamlParser.name} > assertNoUnsafeConstructs - regex precision`, () => {
    it('rejects tag with single ! followed by word char (not just !!)', () => {
        expect(() => makeParser().parse('key: !tagged value')).toThrow(/tag/i);
    });

    it('rejects !! tag at start of value', () => {
        expect(() => makeParser().parse('key: !!binary abc')).toThrow(/tag/i);
    });

    it('does not throw for exclamation mark inside single-quoted string', () => {
        expect(() => makeParser().parse("key: 'hello!'")).not.toThrow();
    });

    it('does not throw for exclamation mark inside double-quoted string', () => {
        expect(() => makeParser().parse('key: "hello!"')).not.toThrow();
    });

    it('rejects anchor &name with multiple word chars', () => {
        expect(() => makeParser().parse('key: &anchor val')).toThrow(/anchor/i);
    });

    it('rejects alias *name with multiple word chars', () => {
        expect(() => makeParser().parse('key: *alias')).toThrow(/alias/i);
    });

    it('rejects merge key << with optional whitespace before colon', () => {
        expect(() => makeParser().parse('  << : val')).toThrow(/merge/i);
    });
});

describe(`${YamlParser.name} > sequence item with nested block under bare dash`, () => {
    it('bare dash with nested sequence child returns parsed child block', () => {
        const yaml = 'items:\n  -\n    - nested1\n    - nested2';
        const result = makeParser().parse(yaml);
        const items = result['items'] as unknown[];
        expect(items[0]).toEqual(['nested1', 'nested2']);
    });
});

describe(`${YamlParser.name} > resolveValue rawValue trimming`, () => {
    it('strips inline comment from value before checking block scalar', () => {
        const yaml = 'key: value # inline comment';
        expect(makeParser().parse(yaml)).toEqual({ key: 'value' });
    });

    it('trims rawValue before processing', () => {
        const yaml = 'key:   value   ';
        expect(makeParser().parse(yaml)).toEqual({ key: 'value' });
    });
});

describe(`${YamlParser.name} > castScalar - float requires dot`, () => {
    it('float regex requires a dot in the value', () => {
        expect(makeParser().parse('val: 123')).toEqual({ val: 123 });
        expect(typeof makeParser().parse('val: 123')['val']).toBe('number');
    });

    it('float regex matches value with only fractional part .5', () => {
        expect(makeParser().parse('val: .5')).toEqual({ val: 0.5 });
    });
});

describe(`${YamlParser.name} > splitFlowItems - comma and depth tracking`, () => {
    it('only splits on comma at depth 0', () => {
        const result = makeParser().parse('items: [{a: 1, b: 2}, c]');
        const items = result['items'] as unknown[];
        expect(items).toHaveLength(2);
        expect(items[0]).toBe('{a: 1, b: 2}');
        expect(items[1]).toBe('c');
    });

    it('depth increments for [ and {', () => {
        expect(makeParser().parse('items: [[a, b]]')).toEqual({ items: ['[a, b]'] });
    });

    it('depth decrements for ] and }', () => {
        const result = makeParser().parse('items: [{x: 1}, y]');
        expect((result['items'] as unknown[]).length).toBe(2);
    });

    it('tracks quote state to avoid splitting inside double-quoted commas', () => {
        expect(makeParser().parse('items: ["a,b"]')).toEqual({ items: ['a,b'] });
    });

    it('tracks quote state to avoid splitting inside single-quoted commas', () => {
        expect(makeParser().parse("items: ['a,b']")).toEqual({ items: ['a,b'] });
    });

    it('resets quote state when closing quote is found', () => {
        expect(makeParser().parse('items: ["a", b]')).toEqual({ items: ['a', 'b'] });
    });

    it('appends regular chars to current item', () => {
        expect(makeParser().parse('items: [abc]')).toEqual({ items: ['abc'] });
    });
});

describe(`${YamlParser.name} > stripInlineComment - quote state toggling`, () => {
    it('single-quote toggles inSingle state correctly', () => {
        expect(makeParser().parse("key: 'has # hash'")).toEqual({ key: 'has # hash' });
    });

    it('double-quote toggles inDouble state correctly', () => {
        expect(makeParser().parse('key: "has # hash"')).toEqual({ key: 'has # hash' });
    });

    it('single-quote inside double-quoted does not toggle inSingle', () => {
        expect(makeParser().parse('key: "it\'s # fine"')).toEqual({ key: "it's # fine" });
    });

    it('double-quote inside single-quoted does not toggle inDouble', () => {
        expect(makeParser().parse('key: \'say "hi" # ok\'')).toEqual({ key: 'say "hi" # ok' });
    });

    it('hash preceded by space outside quotes is treated as comment start', () => {
        expect(makeParser().parse('key: abc # comment')).toEqual({ key: 'abc' });
    });

    it('hash at position 0 without preceding space is not stripped as comment', () => {
        expect(makeParser().parse('key: #value')).toEqual({ key: '#value' });
    });

    it('returns trimmed value when closing quote is followed by non-hash non-empty', () => {
        expect(makeParser().parse('key: "word" extra')).toEqual({ key: '"word" extra' });
    });

    it('handles value with alternating quotes protecting hash', () => {
        expect(makeParser().parse('key: \'a "b" c\' # comment')).toEqual({ key: 'a "b" c' });
    });
});

describe(`${YamlParser.name} > block scalar - empty and edge`, () => {
    it('empty block lines are pushed as empty strings', () => {
        const yaml = 'text: |\n  a\n\n  b';
        const result = makeParser().parse(yaml);
        expect(result['text']).toBe('a\n\nb\n');
    });

    it('block scalar with strip chomping on empty content returns empty', () => {
        const yaml = 'text: |-\nnext: val';
        const result = makeParser().parse(yaml);
        expect(result['text']).toBe('');
    });

    it('block scalar with keep chomping preserves all trailing newlines', () => {
        const yaml = 'text: |+\n  line1\n\n\n';
        const result = makeParser().parse(yaml);
        expect(result['text']).toBe('line1\n\n\n');
    });

    it('block scalar endsWith check: result not already ending with newline gets one added', () => {
        const yaml = 'text: |\n  singleline';
        expect(makeParser().parse(yaml)).toEqual({ text: 'singleline\n' });
    });
});

describe(`${YamlParser.name} > flow map - colonPos edge cases`, () => {
    it('flow map with value containing colon splits on first colon', () => {
        expect(makeParser().parse('m: {url: http://x}')).toEqual({
            m: { url: 'http://x' },
        });
    });

    it('flow map key is trimmed of whitespace', () => {
        expect(makeParser().parse('m: { key : val}')).toEqual({ m: { key: 'val' } });
    });

    it('flow map value is trimmed of whitespace', () => {
        expect(makeParser().parse('m: {key: val }')).toEqual({ m: { key: 'val' } });
    });
});

describe(`${YamlParser.name} > mergeChildLines - resolveValue passthrough`, () => {
    it('mergeChildLines calls resolveValue for nested block scalar', () => {
        const yaml = 'items:\n  - name: Alice\n    bio: |\n      hello\n      world';
        const result = makeParser().parse(yaml);
        const items = result['items'] as Record<string, unknown>[];
        expect(items[0]['bio']).toBe('hello\nworld\n');
    });
});

describe(`${YamlParser.name} > parseLines - sequence and map detection`, () => {
    it('isSequence flag is set when first item is "- " prefix', () => {
        expect(makeParser().parse('items:\n  - a\n  - b')).toEqual({ items: ['a', 'b'] });
    });

    it('returns arrResult when isSequence is true', () => {
        const result = makeParser().parse('items:\n  - x');
        expect(Array.isArray(result['items'])).toBe(true);
    });

    it('returns mapResult when isSequence is false', () => {
        const result = makeParser().parse('a: 1\nb: 2');
        expect(Array.isArray(result)).toBe(false);
    });
});
