import { describe, expect, it, beforeEach } from 'vitest';
import { SegmentParser } from '../../src/path-query/segment-parser.js';
import { SegmentFilterParser } from '../../src/path-query/segment-filter-parser.js';
import { SegmentType } from '../../src/path-query/segment-type.js';
import { SecurityGuard } from '../../src/security/security-guard.js';
import { InvalidFormatException } from '../../src/exceptions/invalid-format-exception.js';

describe(`${SegmentParser.name} mutation tests`, () => {
    let parser: SegmentParser;

    beforeEach(() => {
        parser = new SegmentParser(new SegmentFilterParser(new SecurityGuard()));
    });

    describe('$ prefix handling', () => {
        it('parses "$" alone as empty segments', () => {
            const result = parser.parseSegments('$');

            expect(result).toHaveLength(0);
        });

        it('parses "$.key" stripping $ and dot', () => {
            const result = parser.parseSegments('$.key');

            expect(result).toHaveLength(1);
            expect(result[0]).toEqual({ type: SegmentType.Key, value: 'key' });
        });

        it('does not strip $ from middle of path', () => {
            const result = parser.parseSegments('price$');

            expect(result).toHaveLength(1);
            expect(result[0]).toEqual({ type: SegmentType.Key, value: 'price$' });
        });
    });

    describe('descent bracket parsing', () => {
        it('parses descent with bracket correctly reading inner content', () => {
            const result = parser.parseSegments('..[longkeyname]');

            expect(result[0].type).toBe(SegmentType.Descent);
            expect((result[0] as { key: string }).key).toBe('longkeyname');
        });

        it('parses descent bracket with single-quoted key', () => {
            const result = parser.parseSegments("..['my key']");

            expect(result[0].type).toBe(SegmentType.Descent);
            expect((result[0] as { key: string }).key).toBe('my key');
        });

        it('parses descent bracket with double-quoted key', () => {
            const result = parser.parseSegments('..[" key "]');

            expect(result[0].type).toBe(SegmentType.Descent);
            expect((result[0] as { key: string }).key).toBe(' key ');
        });

        it('parses DescentMulti with spaces around comma-separated quoted keys', () => {
            const result = parser.parseSegments("..[ 'a' , 'b' ]");

            expect(result[0].type).toBe(SegmentType.DescentMulti);
            expect((result[0] as { keys: string[] }).keys).toEqual(['a', 'b']);
        });

        it('returns non-quoted bracket as plain descent key', () => {
            const result = parser.parseSegments('..[nonquoted]');

            expect(result[0].type).toBe(SegmentType.Descent);
            expect((result[0] as { key: string }).key).toBe('nonquoted');
        });
    });

    describe('descent escaped dot handling', () => {
        it('escape at end of path in descent key', () => {
            const result = parser.parseSegments('..key');

            expect(result[0].type).toBe(SegmentType.Descent);
            expect((result[0] as { key: string }).key).toBe('key');
        });

        it('descent stops at dot boundary', () => {
            const result = parser.parseSegments('..key.child');

            expect(result).toHaveLength(2);
            expect(result[0].type).toBe(SegmentType.Descent);
            expect((result[0] as { key: string }).key).toBe('key');
            expect(result[1].type).toBe(SegmentType.Key);
            expect((result[1] as { value: string }).value).toBe('child');
        });

        it('descent stops at bracket boundary', () => {
            const result = parser.parseSegments('..key[0]');

            expect(result).toHaveLength(2);
            expect(result[0].type).toBe(SegmentType.Descent);
            expect((result[0] as { key: string }).key).toBe('key');
            expect(result[1].type).toBe(SegmentType.Key);
        });
    });

    describe('filter depth tracking', () => {
        it('handles nested brackets in filter expression', () => {
            const result = parser.parseSegments('items[?items[0]==1]');

            expect(result[1].type).toBe(SegmentType.Filter);
        });

        it('handles deeply nested brackets in filter expression', () => {
            const result = parser.parseSegments('items[?a[b[c]]==1]');

            expect(result[1].type).toBe(SegmentType.Filter);
        });
    });

    describe('[?...] filter dispatching vs [ bracket', () => {
        it('dispatches [? to filter parser and [ to bracket parser distinctly', () => {
            const filterResult = parser.parseSegments('x[?a>1]');
            const bracketResult = parser.parseSegments('x[0]');

            expect(filterResult[1].type).toBe(SegmentType.Filter);
            expect(bracketResult[1].type).toBe(SegmentType.Key);
        });

        it('does not confuse [ at end of string with filter', () => {
            const result = parser.parseSegments('x[abc]');

            expect(result[1].type).toBe(SegmentType.Key);
            expect((result[1] as { value: string }).value).toBe('abc');
        });
    });

    describe('projection parsing', () => {
        it('returns null segment for dot followed by non-brace char', () => {
            const result = parser.parseSegments('a.b');

            expect(result).toHaveLength(2);
            expect(result[0]).toEqual({ type: SegmentType.Key, value: 'a' });
            expect(result[1]).toEqual({ type: SegmentType.Key, value: 'b' });
        });

        it('reads projection inner content up to closing brace', () => {
            const result = parser.parseSegments('.{alpha, beta}');

            expect(result[0].type).toBe(SegmentType.Projection);
            const fields = (result[0] as { fields: Array<{ alias: string; source: string }> })
                .fields;
            expect(fields).toHaveLength(2);
            expect(fields[0]).toEqual({ alias: 'alpha', source: 'alpha' });
            expect(fields[1]).toEqual({ alias: 'beta', source: 'beta' });
        });

        it('filters out empty entries from trailing comma in projection', () => {
            const result = parser.parseSegments('.{name,}');

            expect(result[0].type).toBe(SegmentType.Projection);
            const fields = (result[0] as { fields: Array<{ alias: string; source: string }> })
                .fields;
            expect(fields).toHaveLength(1);
            expect(fields[0].alias).toBe('name');
        });

        it('trims spaces from projection alias', () => {
            const result = parser.parseSegments('.{  alias  :  source  }');

            expect(result[0].type).toBe(SegmentType.Projection);
            const fields = (result[0] as { fields: Array<{ alias: string; source: string }> })
                .fields;
            expect(fields[0].alias).toBe('alias');
            expect(fields[0].source).toBe('source');
        });

        it('trims spaces from projection entry without alias', () => {
            const result = parser.parseSegments('.{  field  }');

            expect(result[0].type).toBe(SegmentType.Projection);
            const fields = (result[0] as { fields: Array<{ alias: string; source: string }> })
                .fields;
            expect(fields[0].alias).toBe('field');
            expect(fields[0].source).toBe('field');
        });
    });

    describe('bracket parsing edge cases', () => {
        it('reads bracket inner content accurately for multi-char keys', () => {
            const result = parser.parseSegments('[longkey]');

            expect(result[0]).toEqual({ type: SegmentType.Key, value: 'longkey' });
        });

        it('trims spaces in multi-index parts', () => {
            const result = parser.parseSegments('items[ 0 , 1 , 2 ]');

            expect(result[1].type).toBe(SegmentType.MultiIndex);
            expect((result[1] as { indices: number[] }).indices).toEqual([0, 1, 2]);
        });

        it('trims spaces in multi-key parts', () => {
            const result = parser.parseSegments("items[ 'a' , 'b' ]");

            expect(result[1].type).toBe(SegmentType.MultiKey);
            expect((result[1] as { keys: string[] }).keys).toEqual(['a', 'b']);
        });

        it('rejects empty parts as non-numeric and falls through to Key', () => {
            const result = parser.parseSegments('items[,]');

            expect(result[1].type).toBe(SegmentType.Key);
            expect((result[1] as { value: string }).value).toBe(',');
        });

        it('rejects whitespace-only num parts and falls through to Key', () => {
            const result = parser.parseSegments('items[ , ]');

            expect(result[1].type).toBe(SegmentType.Key);
        });

        it('strips bracket quotes matching same delimiter (single)', () => {
            const result = parser.parseSegments("items['key']");

            expect(result[1]).toEqual({ type: SegmentType.Key, value: 'key' });
        });

        it('strips bracket quotes matching same delimiter (double)', () => {
            const result = parser.parseSegments('items["key"]');

            expect(result[1]).toEqual({ type: SegmentType.Key, value: 'key' });
        });

        it('does not strip mismatched quotes', () => {
            const result = parser.parseSegments('items[\'key"]');

            expect(result[1]).toEqual({ type: SegmentType.Key, value: '\'key"' });
        });

        it('does not strip quotes with extra content before', () => {
            const result = parser.parseSegments("items[x'key']");

            expect(result[1]).toEqual({ type: SegmentType.Key, value: "x'key'" });
        });

        it('does not strip quotes with extra content after', () => {
            const result = parser.parseSegments("items['key'x]");

            expect(result[1]).toEqual({ type: SegmentType.Key, value: "'key'x" });
        });
    });

    describe('slice parsing edge cases', () => {
        it('parses slice with only start [:] → end is null', () => {
            const result = parser.parseSegments('items[2:]');

            expect(result[1].type).toBe(SegmentType.Slice);
            const slice = result[1] as {
                start: number | null;
                end: number | null;
                step: number | null;
            };
            expect(slice.start).toBe(2);
            expect(slice.end).toBeNull();
            expect(slice.step).toBeNull();
        });

        it('parses slice with two colons [::] → all null parts', () => {
            const result = parser.parseSegments('items[::]');

            expect(result[1].type).toBe(SegmentType.Slice);
            const slice = result[1] as {
                start: number | null;
                end: number | null;
                step: number | null;
            };
            expect(slice.start).toBeNull();
            expect(slice.end).toBeNull();
            expect(slice.step).toBeNull();
        });

        it('throws InvalidFormatException with non-empty message for zero step', () => {
            try {
                parser.parseSegments('items[0:5:0]');
                expect.fail('Should have thrown');
            } catch (e) {
                expect(e).toBeInstanceOf(InvalidFormatException);
                expect((e as Error).message).not.toBe('');
                expect((e as Error).message).toContain('zero');
            }
        });
    });

    describe('parseKey escaped dot handling', () => {
        it('handles escaped dot at end of key path', () => {
            const result = parser.parseSegments('a\\.b');

            expect(result).toHaveLength(1);
            expect((result[0] as { value: string }).value).toBe('a.b');
        });

        it('handles multiple escaped dots', () => {
            const result = parser.parseSegments('a\\.b\\.c');

            expect(result).toHaveLength(1);
            expect((result[0] as { value: string }).value).toBe('a.b.c');
        });

        it('backslash not followed by dot is preserved as-is', () => {
            const result = parser.parseSegments('a\\x');

            expect(result).toHaveLength(1);
            expect((result[0] as { value: string }).value).toBe('a\\x');
        });
    });

    describe('allQuoted helper', () => {
        it('detects parts with only closing quote as not quoted', () => {
            const result = parser.parseSegments("data[a','b']");

            expect(result[1].type).toBe(SegmentType.Key);
        });

        it('detects parts with empty string as not quoted', () => {
            const result = parser.parseSegments("data['','']");

            expect(result[1].type).toBe(SegmentType.MultiKey);
            expect((result[1] as { keys: string[] }).keys).toEqual(['', '']);
        });

        it('rejects mixed quoted and unquoted parts', () => {
            const result = parser.parseSegments("data['a',b]");

            expect(result[1].type).toBe(SegmentType.Key);
        });

        it('rejects start-quoted-only parts', () => {
            const result = parser.parseSegments("data['a,'b']");

            expect(result[1].type).toBe(SegmentType.Key);
        });

        it('handles double-quoted multi-key with spaces', () => {
            const result = parser.parseSegments('data[ "a" , "b" ]');

            expect(result[1].type).toBe(SegmentType.MultiKey);
            expect((result[1] as { keys: string[] }).keys).toEqual(['a', 'b']);
        });
    });

    describe('parseKeys edge cases', () => {
        it('handles bracket with multi-char content', () => {
            const result = parser.parseKeys('a[longkey]');

            expect(result).toEqual(['a', 'longkey']);
        });

        it('handles escaped dot correctly in parseKeys', () => {
            const result = parser.parseKeys('a\\.b.c');

            expect(result).toEqual(['a.b', 'c']);
        });

        it('empty path returns single empty key', () => {
            const result = parser.parseKeys('');

            expect(result).toEqual(['']);
        });
    });

    describe('$ prefix with dot skip', () => {
        it('parses "$.{name}" as key not projection when dot is consumed by $', () => {
            const result = parser.parseSegments('$.{name}');

            expect(result).toHaveLength(1);
            expect(result[0].type).toBe(SegmentType.Key);
        });

        it('parses "$.." as empty segments when dot is consumed by $', () => {
            const result = parser.parseSegments('$..');

            expect(result).toHaveLength(0);
        });

        it('parses "$." followed by bracket as bracket segment', () => {
            const result = parser.parseSegments('$.[0]');

            expect(result).toHaveLength(1);
            expect(result[0].type).toBe(SegmentType.Key);
            expect((result[0] as { value: string }).value).toBe('0');
        });
    });

    describe('descent parsing - j < len boundary', () => {
        it('correctly scans bracket content up to ] boundary in descent', () => {
            const result = parser.parseSegments('..[abc]');

            expect(result[0].type).toBe(SegmentType.Descent);
            expect((result[0] as { key: string }).key).toBe('abc');
        });

        it('handles bracket content with no closing ] in descent', () => {
            const result = parser.parseSegments('..[open');

            expect(result[0].type).toBe(SegmentType.Descent);
            expect((result[0] as { key: string }).key).toBe('open');
        });
    });

    describe('filter depth tracking - j < len boundary', () => {
        it('correctly scans filter content up to ] boundary', () => {
            const result = parser.parseSegments('x[?a>1]');

            expect(result[1].type).toBe(SegmentType.Filter);
        });

        it('handles filter with no closing ]', () => {
            const result = parser.parseSegments('x[?a>1');

            expect(result[1].type).toBe(SegmentType.Filter);
        });
    });

    describe('bracket parsing - j < len boundary', () => {
        it('correctly scans bracket content up to ] boundary', () => {
            const result = parser.parseSegments('[longkey]');

            expect(result[0]).toEqual({ type: SegmentType.Key, value: 'longkey' });
        });

        it('handles bracket with no closing ]', () => {
            const result = parser.parseSegments('[open');

            expect(result[0]).toEqual({ type: SegmentType.Key, value: 'open' });
        });
    });

    describe('projection parsing - j < len boundary', () => {
        it('correctly scans projection content up to } boundary', () => {
            const result = parser.parseSegments('.{field}');

            expect(result[0].type).toBe(SegmentType.Projection);
        });

        it('handles projection with no closing }', () => {
            const result = parser.parseSegments('.{field');

            expect(result[0].type).toBe(SegmentType.Projection);
        });
    });

    describe('pos.i + 1 arithmetic in descent/bracket/filter scanners', () => {
        it('advances past descent bracket correctly', () => {
            const result = parser.parseSegments('..[key].next');

            expect(result).toHaveLength(2);
            expect(result[0].type).toBe(SegmentType.Descent);
            expect(result[1].type).toBe(SegmentType.Key);
            expect((result[1] as { value: string }).value).toBe('next');
        });

        it('advances past filter bracket correctly', () => {
            const result = parser.parseSegments('x[?a>1].next');

            expect(result).toHaveLength(3);
            expect(result[0].type).toBe(SegmentType.Key);
            expect(result[1].type).toBe(SegmentType.Filter);
            expect(result[2].type).toBe(SegmentType.Key);
        });

        it('advances past regular bracket correctly', () => {
            const result = parser.parseSegments('[key].next');

            expect(result).toHaveLength(2);
            expect(result[1].type).toBe(SegmentType.Key);
            expect((result[1] as { value: string }).value).toBe('next');
        });
    });

    describe('allQuoted - trim method', () => {
        it('trims whitespace from quoted parts in comma-separated list', () => {
            const result = parser.parseSegments("data[ 'a' , 'b' ]");

            expect(result[1].type).toBe(SegmentType.MultiKey);
            expect((result[1] as { keys: string[] }).keys).toEqual(['a', 'b']);
        });

        it('rejects parts with only one matching quote', () => {
            const result = parser.parseSegments("data['a, b']");

            expect(result[1].type).toBe(SegmentType.Key);
        });
    });

    describe('slice - sliceParts.length boundary', () => {
        it('handles single-part slice (just colon) as null:null slice', () => {
            const result = parser.parseSegments('items[:]');

            expect(result[1].type).toBe(SegmentType.Slice);
            const s = result[1] as { start: number | null; end: number | null };
            expect(s.start).toBeNull();
            expect(s.end).toBeNull();
        });

        it('sliceParts.length > 1 is needed to read end part', () => {
            const result = parser.parseSegments('items[2:]');

            expect(result[1].type).toBe(SegmentType.Slice);
            const s = result[1] as { start: number | null; end: number | null };
            expect(s.start).toBe(2);
            expect(s.end).toBeNull();
        });
    });

    describe('parseKeys - regex escape in placeholder', () => {
        it('escapes special regex characters in placeholder for parseKeys', () => {
            const result = parser.parseKeys('a\\.b');

            expect(result).toEqual(['a.b']);
        });

        it('replaces placeholder correctly in final keys', () => {
            const result = parser.parseKeys('x\\.y.z');

            expect(result).toEqual(['x.y', 'z']);
        });
    });

    describe('allQuoted - startsWith check', () => {
        it('checks both single and double quote for startsWith', () => {
            const result = parser.parseSegments('data["x","y"]');

            expect(result[1].type).toBe(SegmentType.MultiKey);
            expect((result[1] as { keys: string[] }).keys).toEqual(['x', 'y']);
        });

        it('rejects unquoted parts in allQuoted check', () => {
            const result = parser.parseSegments("data[a,'b']");

            expect(result[1].type).toBe(SegmentType.Key);
        });
    });
});
