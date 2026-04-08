import { describe, expect, it, beforeEach } from 'vitest';
import { SegmentParser } from '../../src/path-query/segment-parser.js';
import { SegmentFilterParser } from '../../src/path-query/segment-filter-parser.js';
import { SegmentType } from '../../src/path-query/segment-type.js';
import { SecurityGuard } from '../../src/security/security-guard.js';
import { InvalidFormatException } from '../../src/exceptions/invalid-format-exception.js';

describe(SegmentParser.name, () => {
    let parser: SegmentParser;

    beforeEach(() => {
        parser = new SegmentParser(new SegmentFilterParser(new SecurityGuard()));
    });

    describe(`${SegmentParser.name} > parseSegments`, () => {
        it('parses a simple key path', () => {
            const result = parser.parseSegments('name');

            expect(result).toHaveLength(1);
            expect(result[0]).toEqual({ type: SegmentType.Key, value: 'name' });
        });

        it('returns empty array for an empty path', () => {
            const result = parser.parseSegments('');

            expect(result).toHaveLength(0);
        });

        it('strips a leading $ prefix', () => {
            const result = parser.parseSegments('$.name');

            expect(result).toHaveLength(1);
            expect(result[0]).toEqual({ type: SegmentType.Key, value: 'name' });
        });

        it('strips a leading $ prefix without a dot', () => {
            const result = parser.parseSegments('$name');

            expect(result).toHaveLength(1);
            expect(result[0]).toEqual({ type: SegmentType.Key, value: 'name' });
        });

        it('parses a two-level dot-notation path', () => {
            const result = parser.parseSegments('user.name');

            expect(result).toHaveLength(2);
            expect(result[0]).toEqual({ type: SegmentType.Key, value: 'user' });
            expect(result[1]).toEqual({ type: SegmentType.Key, value: 'name' });
        });

        it('parses a three-level dot-notation path', () => {
            const result = parser.parseSegments('user.address.city');

            expect(result).toHaveLength(3);
            expect(result[2]).toEqual({ type: SegmentType.Key, value: 'city' });
        });

        it('parses a wildcard * segment', () => {
            const result = parser.parseSegments('users.*');

            expect(result[1]).toEqual({ type: SegmentType.Wildcard });
        });

        it('parses a bracket wildcard [*] segment', () => {
            const result = parser.parseSegments('users[*]');

            expect(result[1]).toEqual({ type: SegmentType.Wildcard });
        });

        it('parses a bracket numeric index [0]', () => {
            const result = parser.parseSegments('items[0]');

            expect(result[1]).toEqual({ type: SegmentType.Key, value: '0' });
        });

        it('parses a bracket quoted string key', () => {
            const result = parser.parseSegments("data['key-with-dash']");

            expect(result[1]).toEqual({ type: SegmentType.Key, value: 'key-with-dash' });
        });

        it('parses a multi-index segment [0,1,2]', () => {
            const result = parser.parseSegments('items[0,1,2]');

            expect(result[1].type).toBe(SegmentType.MultiIndex);
            expect((result[1] as { indices: number[] }).indices).toEqual([0, 1, 2]);
        });

        it("parses a multi-key segment ['a','b']", () => {
            const result = parser.parseSegments("data['a','b']");

            expect(result[1].type).toBe(SegmentType.MultiKey);
            expect((result[1] as { keys: string[] }).keys).toEqual(['a', 'b']);
        });

        it('parses a slice segment [1:5]', () => {
            const result = parser.parseSegments('items[1:5]');

            expect(result[1].type).toBe(SegmentType.Slice);
            const slice = result[1] as {
                start: number | null;
                end: number | null;
                step: number | null;
            };
            expect(slice.start).toBe(1);
            expect(slice.end).toBe(5);
            expect(slice.step).toBeNull();
        });

        it('parses a slice segment with a step [0:10:2]', () => {
            const result = parser.parseSegments('items[0:10:2]');

            expect(result[1].type).toBe(SegmentType.Slice);
            expect((result[1] as { step: number }).step).toBe(2);
        });

        it('parses a slice with open start [::2]', () => {
            const result = parser.parseSegments('items[::2]');

            expect(result[1].type).toBe(SegmentType.Slice);
            const slice = result[1] as {
                start: number | null;
                end: number | null;
                step: number | null;
            };
            expect(slice.start).toBeNull();
            expect(slice.end).toBeNull();
            expect(slice.step).toBe(2);
        });

        it('throws InvalidFormatException when slice step is zero', () => {
            expect(() => parser.parseSegments('items[0:5:0]')).toThrow(InvalidFormatException);
        });

        it('parses a recursive descent segment ..key', () => {
            const result = parser.parseSegments('data..name');

            const descent = result.filter((s) => s.type === SegmentType.Descent);
            expect(descent).not.toHaveLength(0);
            expect((descent[0] as { key: string }).key).toBe('name');
        });

        it("parses a recursive descent with bracket key ..['key']", () => {
            const result = parser.parseSegments("data..['nested']");

            const descent = result.filter((s) => s.type === SegmentType.Descent);
            expect((descent[0] as { key: string }).key).toBe('nested');
        });

        it("parses a DescentMulti segment ..['a','b']", () => {
            const result = parser.parseSegments("data..['a','b']");

            const dm = result.filter((s) => s.type === SegmentType.DescentMulti);
            expect(dm).not.toHaveLength(0);
            expect((dm[0] as { keys: string[] }).keys).toEqual(['a', 'b']);
        });

        it('parses a filter segment [?condition]', () => {
            const result = parser.parseSegments('users[?age>18]');

            expect(result[1].type).toBe(SegmentType.Filter);
            const filter = result[1] as { expression: { conditions: unknown[] } };
            expect(filter.expression.conditions).not.toHaveLength(0);
        });

        it('parses a projection segment .{name,age}', () => {
            const result = parser.parseSegments('users.{name,age}');

            const proj = result.filter((s) => s.type === SegmentType.Projection);
            expect(proj).not.toHaveLength(0);
            const fields = (proj[0] as { fields: Array<{ alias: string }> }).fields;
            expect(fields).toHaveLength(2);
            expect(fields[0].alias).toBe('name');
            expect(fields[1].alias).toBe('age');
        });

        it('parses a projection with an alias .{fullName: name}', () => {
            const result = parser.parseSegments('users.{fullName: name}');

            const proj = result.filter((s) => s.type === SegmentType.Projection);
            const fields = (proj[0] as { fields: Array<{ alias: string; source: string }> }).fields;
            expect(fields[0].alias).toBe('fullName');
            expect(fields[0].source).toBe('name');
        });

        it('parses a path with an escaped dot as a literal key', () => {
            const result = parser.parseSegments('data.key\\.with\\.dots');

            expect((result[1] as { value: string }).value).toBe('key.with.dots');
        });
    });

    describe(`${SegmentParser.name} > parseKeys`, () => {
        it('splits a simple dot-notation path into keys', () => {
            const result = parser.parseKeys('user.address.city');

            expect(result).toEqual(['user', 'address', 'city']);
        });

        it('converts bracket notation to dot-notation keys', () => {
            const result = parser.parseKeys('a[0][1]');

            expect(result).toEqual(['a', '0', '1']);
        });

        it('preserves escaped dots as literal dots in keys', () => {
            const result = parser.parseKeys('data.key\\.dot');

            expect(result).toEqual(['data', 'key.dot']);
        });

        it('returns a single key for a path without separators', () => {
            const result = parser.parseKeys('name');

            expect(result).toEqual(['name']);
        });
    });

    describe(`${SegmentParser.name} > parseSegments edge cases`, () => {
        it('parses an unquoted bracket descent key as a plain Descent segment', () => {
            const result = parser.parseSegments('..[0]');

            expect(result[0].type).toBe(SegmentType.Descent);
            expect((result[0] as { key: string }).key).toBe('0');
        });

        it('includes an escaped dot as a literal dot in a descent key', () => {
            const result = parser.parseSegments('..key\\.sub');

            expect(result[0].type).toBe(SegmentType.Descent);
            expect((result[0] as { key: string }).key).toBe('key.sub');
        });

        it('tracks depth for a nested bracket inside a filter expression', () => {
            const result = parser.parseSegments('[?(items[0] == 1)]');

            expect(result[0].type).toBe(SegmentType.Filter);
        });

        it('falls through to Key type for an unquoted non-numeric comma-separated bracket', () => {
            const result = parser.parseSegments('data[a,b]');

            expect(result[1].type).toBe(SegmentType.Key);
            expect((result[1] as { value: string }).value).toBe('a,b');
        });

        it('parses a bracket with double-quoted keys', () => {
            const result = parser.parseSegments('data["key"]');

            expect(result[1]).toEqual({ type: SegmentType.Key, value: 'key' });
        });

        it('parses a multi-key with double-quoted strings', () => {
            const result = parser.parseSegments('data["a","b"]');

            expect(result[1].type).toBe(SegmentType.MultiKey);
            expect((result[1] as { keys: string[] }).keys).toEqual(['a', 'b']);
        });
    });

    describe(`${SegmentParser.name} > mutation boundary tests`, () => {
        it('treats a bare $ as empty segments (no dot follows)', () => {
            const result = parser.parseSegments('$');

            expect(result).toHaveLength(0);
        });

        it('parses $ without a dot followed by a key segment', () => {
            const result = parser.parseSegments('$name');

            expect(result).toHaveLength(1);
            expect(result[0]).toEqual({ type: SegmentType.Key, value: 'name' });
        });

        it('skips the dot after $ when followed by a path', () => {
            const result = parser.parseSegments('$.a.b');

            expect(result).toHaveLength(2);
            expect(result[0]).toEqual({ type: SegmentType.Key, value: 'a' });
            expect(result[1]).toEqual({ type: SegmentType.Key, value: 'b' });
        });

        it('does not skip the second char after $ when it is not a dot', () => {
            const r1 = parser.parseSegments('$abc');
            const r2 = parser.parseSegments('$.abc');

            expect(r1).toEqual(r2);
        });

        it('distinguishes a single dot from a double dot at path end', () => {
            const result = parser.parseSegments('a.');

            expect(result).toHaveLength(1);
            expect(result[0]).toEqual({ type: SegmentType.Key, value: 'a' });
        });

        it('parses descent when double dot is at the end of path', () => {
            const result = parser.parseSegments('a..');

            expect(result).toHaveLength(2);
            expect(result[0]).toEqual({ type: SegmentType.Key, value: 'a' });
            expect(result[1]).toEqual({ type: SegmentType.Descent, key: '' });
        });

        it('parses [? at end of path without closing bracket', () => {
            const result = parser.parseSegments('[?x>1]');

            expect(result[0].type).toBe(SegmentType.Filter);
        });

        it('parses a bare [ at the last character as a key segment', () => {
            const result = parser.parseSegments('a[0]');

            expect(result).toHaveLength(2);
            expect(result[0]).toEqual({ type: SegmentType.Key, value: 'a' });
            expect(result[1]).toEqual({ type: SegmentType.Key, value: '0' });
        });

        it('handles a descent bracket where the bracket is at the exact pos.i boundary', () => {
            const result = parser.parseSegments('..[key]');

            expect(result[0].type).toBe(SegmentType.Descent);
            expect((result[0] as { key: string }).key).toBe('key');
        });

        it('handles a descent bracket where inner is empty', () => {
            const result = parser.parseSegments('..[]');

            expect(result[0].type).toBe(SegmentType.Descent);
            expect((result[0] as { key: string }).key).toBe('');
        });

        it('parses projection when { appears right after a dot', () => {
            const result = parser.parseSegments('.{name,age}');

            expect(result[0].type).toBe(SegmentType.Projection);
        });

        it('returns null projection when pos is at end of string', () => {
            const result = parser.parseSegments('key.');

            expect(result).toHaveLength(1);
        });

        it('skips non-quoted comma-separated parts where one trim result is empty', () => {
            const result = parser.parseSegments('data[1, ,3]');

            expect(result[1].type).toBe(SegmentType.Key);
            expect((result[1] as { value: string }).value).toBe('1, ,3');
        });

        it('detects that trimmed parts with spaces are not all numeric', () => {
            const result = parser.parseSegments('data[ 1, 2 ]');

            expect(result[1].type).toBe(SegmentType.MultiIndex);
            expect((result[1] as { indices: number[] }).indices).toEqual([1, 2]);
        });

        it('handles slice where end part is an empty string', () => {
            const result = parser.parseSegments('items[1:]');

            expect(result[1].type).toBe(SegmentType.Slice);
            const slice = result[1] as {
                start: number | null;
                end: number | null;
                step: number | null;
            };
            expect(slice.start).toBe(1);
            expect(slice.end).toBeNull();
        });

        it('handles slice with only start [3:]', () => {
            const sliceResult = parser.parseSegments('items[3:]');
            const slice = sliceResult[1] as {
                start: number | null;
                end: number | null;
                step: number | null;
            };

            expect(slice.start).toBe(3);
            expect(slice.end).toBeNull();
            expect(slice.step).toBeNull();
        });

        it('correctly detects allQuoted with mixed single and double quotes', () => {
            const result = parser.parseSegments('data[\'a\',"b"]');

            expect(result[1].type).toBe(SegmentType.MultiKey);
            expect((result[1] as { keys: string[] }).keys).toEqual(['a', 'b']);
        });

        it('detects non-quoted parts in allQuoted check when a part starts with quote but not ends', () => {
            const result = parser.parseSegments('data["abc]');

            expect(result[1].type).toBe(SegmentType.Key);
            expect((result[1] as { value: string }).value).toBe('"abc');
        });

        it('returns false in allQuoted when a part starts with double-quote but ends without it', () => {
            const result = parser.parseSegments('data["abc,def]');

            expect(result[1].type).toBe(SegmentType.Key);
            expect((result[1] as { value: string }).value).toBe('"abc,def');
        });

        it('returns false in allQuoted for parts starting and ending with empty string', () => {
            const result = parser.parseSegments('data[,]');

            expect(result[1].type).toBe(SegmentType.Key);
            expect((result[1] as { value: string }).value).toBe(',');
        });

        it('handles escaped dot at the very end of a key path', () => {
            const result = parser.parseSegments('key\\.');

            expect(result[0]).toEqual({ type: SegmentType.Key, value: 'key.' });
        });

        it('handles escaped dot at the very end of a descent key', () => {
            const result = parser.parseSegments('..key\\.');

            expect(result[0]).toEqual({ type: SegmentType.Descent, key: 'key.' });
        });

        it('does not treat backslash as escape when not followed by dot', () => {
            const result = parser.parseSegments('ke\\y');

            expect(result[0]).toEqual({ type: SegmentType.Key, value: 'ke\\y' });
        });

        it('does not treat backslash as escape in descent when not followed by dot', () => {
            const result = parser.parseSegments('..ke\\y');

            expect(result[0]).toEqual({ type: SegmentType.Descent, key: 'ke\\y' });
        });

        it('handles backslash at the very last character of the path in parseKey', () => {
            const result = parser.parseSegments('key\\');

            expect(result[0]).toEqual({ type: SegmentType.Key, value: 'key\\' });
        });

        it('handles backslash at the very last character in a descent key', () => {
            const result = parser.parseSegments('..key\\');

            expect(result[0]).toEqual({ type: SegmentType.Descent, key: 'key\\' });
        });

        it('produces correct replacement in parseKeys for escaped dots in brackets', () => {
            const result = parser.parseKeys('a\\.b');

            expect(result).toEqual(['a.b']);
        });

        it('handles parseKeys with no special characters', () => {
            const result = parser.parseKeys('simple');

            expect(result).toEqual(['simple']);
        });

        it('handles parseKeys with a dot followed by a bracket', () => {
            const result = parser.parseKeys('a.b[0]');

            expect(result).toEqual(['a', 'b', '0']);
        });

        it('resolves regex placeholder replacement correctly for special chars', () => {
            const result = parser.parseKeys('data\\.key\\.more');

            expect(result).toEqual(['data.key.more']);
        });

        it('handles multikey in descent with spaces around quoted parts', () => {
            const result = parser.parseSegments("..[ 'a' , 'b' ]");

            expect(result[0].type).toBe(SegmentType.DescentMulti);
            expect((result[0] as { keys: string[] }).keys).toEqual(['a', 'b']);
        });

        it('handles projection when pos.i is past len (empty projection)', () => {
            const result = parser.parseSegments('.{}');

            expect(result[0].type).toBe(SegmentType.Projection);
            const proj = result[0] as { fields: Array<{ alias: string; source: string }> };
            expect(proj.fields).toHaveLength(0);
        });

        it('handles bracket parse when inner string has no closing bracket', () => {
            const result = parser.parseSegments('[abc');

            expect(result[0].type).toBe(SegmentType.Key);
            expect((result[0] as { value: string }).value).toBe('abc');
        });

        it('correctly distinguishes multi-index with spaces from non-numeric', () => {
            const r1 = parser.parseSegments('data[ 0 , 1 ]');
            expect(r1[1].type).toBe(SegmentType.MultiIndex);
            expect((r1[1] as { indices: number[] }).indices).toEqual([0, 1]);
        });

        it('parses filter where the bracket depth needs tracking with nested brackets', () => {
            const result = parser.parseSegments('[?items[0] == 1 && items[1] == 2]');

            expect(result[0].type).toBe(SegmentType.Filter);
        });

        it('treats first bracket-close correctly in parseFilter depth tracking', () => {
            const result = parser.parseSegments('[?a[0]>1]');

            expect(result[0].type).toBe(SegmentType.Filter);
        });

        it('returns false for allQuoted when a part has empty string content', () => {
            const result = parser.parseSegments("data['',1]");

            expect(result[1].type).toBe(SegmentType.Key);
        });

        it('checks allQuoted with double-quoted parts that do not endsWith double-quote', () => {
            const result = parser.parseSegments('data["x","y"]');

            expect(result[1].type).toBe(SegmentType.MultiKey);
            expect((result[1] as { keys: string[] }).keys).toEqual(['x', 'y']);
        });

        it('check allQuoted returns false when part starts with empty prefix test', () => {
            const result = parser.parseSegments('data[ab,cd]');

            expect(result[1].type).toBe(SegmentType.Key);
            expect((result[1] as { value: string }).value).toBe('ab,cd');
        });

        it('allQuoted rejects parts that start with single quote but do not end with single quote', () => {
            const result = parser.parseSegments("data[b','a']");

            expect(result[1].type).toBe(SegmentType.Key);
            expect((result[1] as { value: string }).value).toBe("b','a'");
        });

        it('allQuoted rejects parts that end with single quote but do not start with single quote', () => {
            const result = parser.parseSegments("data[abc','def']");

            expect(result[1].type).toBe(SegmentType.Key);
            expect((result[1] as { value: string }).value).toBe("abc','def'");
        });

        it('allQuoted rejects parts that start with double quote but do not end with double quote', () => {
            const result = parser.parseSegments('data[b","a"]');

            expect(result[1].type).toBe(SegmentType.Key);
            expect((result[1] as { value: string }).value).toBe('b","a"');
        });

        it('allQuoted uses endsWith for double-quoted second check not startsWith', () => {
            const result = parser.parseSegments('data["a","b"]');

            expect(result[1].type).toBe(SegmentType.MultiKey);
            expect((result[1] as { keys: string[] }).keys).toEqual(['a', 'b']);
        });

        it('allQuoted identifies properly quoted multi-key in descent brackets', () => {
            const result = parser.parseSegments("..['x','y']");

            expect(result[0].type).toBe(SegmentType.DescentMulti);
            expect((result[0] as { keys: string[] }).keys).toEqual(['x', 'y']);
        });

        it('quotedMatch regex requires ^ anchor (rejects text before quote)', () => {
            const result = parser.parseSegments("..[x'key']");

            expect(result[0].type).toBe(SegmentType.Descent);
            expect((result[0] as { key: string }).key).toBe("x'key'");
        });

        it('quotedMatch regex requires $ anchor (rejects text after quote)', () => {
            const result = parser.parseSegments("..['key'x]");

            expect(result[0].type).toBe(SegmentType.Descent);
            expect((result[0] as { key: string }).key).toBe("'key'x");
        });

        it('quotedMatch in parseBracket requires ^ anchor', () => {
            const result = parser.parseSegments("[x'key']");

            expect(result[0]).toEqual({ type: SegmentType.Key, value: "x'key'" });
        });

        it('quotedMatch in parseBracket requires $ anchor', () => {
            const result = parser.parseSegments("['key'x]");

            expect(result[0]).toEqual({ type: SegmentType.Key, value: "'key'x" });
        });

        it('parseKeys placeholder regex escapes special characters correctly', () => {
            const result = parser.parseKeys('a\\.b.c');

            expect(result).toEqual(['a.b', 'c']);
        });

        it('parseKeys escape regex replacement uses backslash-escaped char not empty string', () => {
            const result = parser.parseKeys('x\\.y\\.z');

            expect(result).toEqual(['x.y.z']);
        });
    });
});
