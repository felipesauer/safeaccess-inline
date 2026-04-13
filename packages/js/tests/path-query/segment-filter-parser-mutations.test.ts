import { describe, expect, it } from 'vitest';
import { SegmentFilterParser } from '../../src/path-query/segment-filter-parser.js';
import { SecurityGuard } from '../../src/security/security-guard.js';
import { InvalidFormatException } from '../../src/exceptions/invalid-format-exception.js';

describe(`${SegmentFilterParser.name} > parse edge cases`, () => {
    it('trims whitespace from tokenized conditions', () => {
        const parser = new SegmentFilterParser(new SecurityGuard());

        const expr = parser.parse('  age  >  18  ');

        expect(expr.conditions[0].field).toBe('age');
        expect(expr.conditions[0].value).toBe(18);
    });

    it('handles double-quoted logical expression with && inside quotes', () => {
        const parser = new SegmentFilterParser(new SecurityGuard());

        const expr = parser.parse('name=="a && b"');

        expect(expr.conditions).toHaveLength(1);
        expect(expr.conditions[0].value).toBe('a && b');
    });

    it('handles double-quoted logical expression with || inside quotes', () => {
        const parser = new SegmentFilterParser(new SecurityGuard());

        const expr = parser.parse('name=="a || b"');

        expect(expr.conditions).toHaveLength(1);
        expect(expr.conditions[0].value).toBe('a || b');
    });

    it('splits && operator correctly at boundary positions', () => {
        const parser = new SegmentFilterParser(new SecurityGuard());

        const expr = parser.parse('a>1 && b>2');

        expect(expr.logicals).toEqual(['&&']);
        expect(expr.conditions).toHaveLength(2);
        expect(expr.conditions[0].field).toBe('a');
        expect(expr.conditions[1].field).toBe('b');
    });

    it('splits || operator correctly at boundary positions', () => {
        const parser = new SegmentFilterParser(new SecurityGuard());

        const expr = parser.parse('a>1 || b>2');

        expect(expr.logicals).toEqual(['||']);
        expect(expr.conditions).toHaveLength(2);
    });

    it('trims whitespace from function comparison value', () => {
        const parser = new SegmentFilterParser(new SecurityGuard());

        const expr = parser.parse("starts_with(@.name, 'Al')  >  0  ");

        expect(expr.conditions[0].value).toBe(0);
    });

    it('trims whitespace from function arguments', () => {
        const parser = new SegmentFilterParser(new SecurityGuard());

        const expr = parser.parse("starts_with( @.name , 'Al' )");

        expect(expr.conditions[0].funcArgs).toBeDefined();
        expect(expr.conditions[0].funcArgs![0]).toBe('@.name');
        expect(expr.conditions[0].funcArgs![1]).toBe("'Al'");
    });

    it('trims whitespace from boolean function arguments', () => {
        const parser = new SegmentFilterParser(new SecurityGuard());

        const expr = parser.parse('values( @.items )');

        expect(expr.conditions[0].funcArgs).toBeDefined();
        expect(expr.conditions[0].funcArgs![0]).toBe('@.items');
    });

    it('rejects mismatched single-double quote delimiters as unquoted value', () => {
        const parser = new SegmentFilterParser(new SecurityGuard());

        const expr = parser.parse('name == \'Alice"');

        expect(expr.conditions[0].value).toBe('\'Alice"');
    });

    it('rejects string starting with quote but not ending with same quote', () => {
        const parser = new SegmentFilterParser(new SecurityGuard());

        const expr = parser.parse("name == 'incomplete");

        expect(expr.conditions[0].value).toBe("'incomplete");
    });

    it('rejects string ending with quote but not starting with it', () => {
        const parser = new SegmentFilterParser(new SecurityGuard());

        const expr = parser.parse("name == incomplete'");

        expect(expr.conditions[0].value).toBe("incomplete'");
    });

    it('rejects string starting with double quote but ending without it', () => {
        const parser = new SegmentFilterParser(new SecurityGuard());

        const expr = parser.parse('name == "incomplete');

        expect(expr.conditions[0].value).toBe('"incomplete');
    });

    it('rejects string ending with double quote but not starting with it', () => {
        const parser = new SegmentFilterParser(new SecurityGuard());

        const expr = parser.parse('name == incomplete"');

        expect(expr.conditions[0].value).toBe('incomplete"');
    });

    it('parses integer value without decimal as int (not float)', () => {
        const parser = new SegmentFilterParser(new SecurityGuard());

        const expr = parser.parse('age > 25');

        expect(expr.conditions[0].value).toBe(25);
        expect(Number.isInteger(expr.conditions[0].value)).toBe(true);
    });

    it('parses float value with decimal as float', () => {
        const parser = new SegmentFilterParser(new SecurityGuard());

        const expr = parser.parse('price > 9.99');

        expect(expr.conditions[0].value).toBe(9.99);
        expect(Number.isInteger(expr.conditions[0].value)).toBe(false);
    });

    it('throws InvalidFormatException with message containing the invalid token', () => {
        const parser = new SegmentFilterParser(new SecurityGuard());

        expect(() => parser.parse('no-operator-here')).toThrow(InvalidFormatException);

        try {
            parser.parse('bad-token');
        } catch (e) {
            expect((e as Error).message).toContain('bad-token');
            expect((e as Error).message).not.toBe('');
        }
    });

    it('parses function-compare with multi-char value correctly', () => {
        const parser = new SegmentFilterParser(new SecurityGuard());

        const expr = parser.parse("starts_with(@.name, 'Alice') == true");

        expect(expr.conditions[0].value).toBe(true);
        expect(expr.conditions[0].func).toBe('starts_with');
    });
});

describe(`${SegmentFilterParser.name} > evaluate edge cases`, () => {
    it('evaluates arithmetic subtraction correctly (not addition)', () => {
        const parser = new SegmentFilterParser(new SecurityGuard());

        const expr = parser.parse('@.a - @.b > 0');

        expect(parser.evaluate({ a: 10, b: 3 }, expr)).toBe(true);
        expect(parser.evaluate({ a: 3, b: 10 }, expr)).toBe(false);
    });

    it('evaluates arithmetic division correctly (not multiplication)', () => {
        const parser = new SegmentFilterParser(new SecurityGuard());

        const expr = parser.parse('@.a / @.b > 2');

        expect(parser.evaluate({ a: 10, b: 3 }, expr)).toBe(true);
        expect(parser.evaluate({ a: 2, b: 3 }, expr)).toBe(false);
    });

    it('detects arithmetic expression without spaces around operator', () => {
        const parser = new SegmentFilterParser(new SecurityGuard());

        const expr = parser.parse('@.a+@.b > 0');

        expect(parser.evaluate({ a: 1, b: 2 }, expr)).toBe(true);
    });

    it('detects arithmetic expression with extra spaces around operator', () => {
        const parser = new SegmentFilterParser(new SecurityGuard());

        const expr = parser.parse('@.a  +  @.b > 0');

        expect(parser.evaluate({ a: 1, b: 2 }, expr)).toBe(true);
    });

    it('returns null from arithmetic when left operand is missing', () => {
        const parser = new SegmentFilterParser(new SecurityGuard());

        const expr = parser.parse('@.missing + @.b > 0');

        expect(parser.evaluate({ b: 5 }, expr)).toBe(false);
    });

    it('returns null from arithmetic when right operand is missing', () => {
        const parser = new SegmentFilterParser(new SecurityGuard());

        const expr = parser.parse('@.a + @.missing > 0');

        expect(parser.evaluate({ a: 5 }, expr)).toBe(false);
    });

    it('evaluates starts_with with non-string returns false', () => {
        const parser = new SegmentFilterParser(new SecurityGuard());

        const expr = parser.parse("starts_with(@.score, 'A')");

        expect(parser.evaluate({ score: 42 }, expr)).toBe(false);
    });

    it('evaluates contains on array with exact string match', () => {
        const parser = new SegmentFilterParser(new SecurityGuard());

        const expr = parser.parse("contains(@.tags, 'js')");

        expect(parser.evaluate({ tags: ['js', 'ts'] }, expr)).toBe(true);
        expect(parser.evaluate({ tags: ['python'] }, expr)).toBe(false);
    });

    it('evaluates contains on string with substring', () => {
        const parser = new SegmentFilterParser(new SecurityGuard());

        const expr = parser.parse("contains(@.name, 'li')");

        expect(parser.evaluate({ name: 'Alice' }, expr)).toBe(true);
        expect(parser.evaluate({ name: 'Bob' }, expr)).toBe(false);
    });

    it('evaluates values returns count of array', () => {
        const parser = new SegmentFilterParser(new SecurityGuard());

        const expr = parser.parse('values(@.items) > 2');

        expect(parser.evaluate({ items: [1, 2, 3] }, expr)).toBe(true);
        expect(parser.evaluate({ items: [1] }, expr)).toBe(false);
    });

    it('throws InvalidFormatException for unknown function with descriptive message', () => {
        const parser = new SegmentFilterParser(new SecurityGuard());
        const expr = parser.parse('unknown_fn(@.x) > 0');

        try {
            parser.evaluate({ x: 1 }, expr);
            expect.fail('Should have thrown');
        } catch (e) {
            expect(e).toBeInstanceOf(InvalidFormatException);
            expect((e as Error).message).toContain('unknown_fn');
            expect((e as Error).message).not.toBe('');
        }
    });

    it('resolves dot-separated field in non-arithmetic condition', () => {
        const parser = new SegmentFilterParser(new SecurityGuard());

        const expr = parser.parse("user.name == 'Alice'");

        expect(parser.evaluate({ user: { name: 'Alice' } }, expr)).toBe(true);
        expect(parser.evaluate({ user: { name: 'Bob' } }, expr)).toBe(false);
    });

    it('returns null for missing nested field in dot-separated path', () => {
        const parser = new SegmentFilterParser(new SecurityGuard());

        const expr = parser.parse("user.profile.name == 'Alice'");

        expect(parser.evaluate({ user: {} }, expr)).toBe(false);
    });

    it('resolves arithmetic with multi-part field names', () => {
        const parser = new SegmentFilterParser(new SecurityGuard());

        const expr = parser.parse('@.price * @.qty > 100');

        expect(parser.evaluate({ price: 50, qty: 3 }, expr)).toBe(true);
        expect(parser.evaluate({ price: 10, qty: 5 }, expr)).toBe(false);
    });

    it('evaluates funcArgs undefined fallback with correct default', () => {
        const parser = new SegmentFilterParser(new SecurityGuard());
        const expr = {
            conditions: [{ field: '@', operator: '==' as const, value: 0, func: 'values' }],
            logicals: [] as string[],
        };

        expect(parser.evaluate({ x: 1 }, expr)).toBe(true);
    });

    it('evaluates starts_with funcArgs[0] fallback to @', () => {
        const parser = new SegmentFilterParser(new SecurityGuard());
        const expr = {
            conditions: [
                {
                    field: '@',
                    operator: '==' as const,
                    value: true,
                    func: 'starts_with',
                    funcArgs: [] as string[],
                },
            ],
            logicals: [] as string[],
        };

        expect(parser.evaluate({ x: 1 }, expr)).toBe(false);
    });

    it('evaluates contains funcArgs[0] fallback to @', () => {
        const parser = new SegmentFilterParser(new SecurityGuard());
        const expr = {
            conditions: [
                {
                    field: '@',
                    operator: '==' as const,
                    value: true,
                    func: 'contains',
                    funcArgs: [] as string[],
                },
            ],
            logicals: [] as string[],
        };

        expect(parser.evaluate({ x: 1 }, expr)).toBe(false);
    });

    it('evaluates values funcArgs[0] fallback to @', () => {
        const parser = new SegmentFilterParser(new SecurityGuard());
        const expr = {
            conditions: [
                {
                    field: '@',
                    operator: '==' as const,
                    value: 0,
                    func: 'values',
                    funcArgs: [] as string[],
                },
            ],
            logicals: [] as string[],
        };

        expect(parser.evaluate({ x: 1 }, expr)).toBe(true);
    });

    it('arithmetic regex rejects multi-operator expressions', () => {
        const parser = new SegmentFilterParser(new SecurityGuard());

        const expr = parser.parse('@.a + @.b - @.c > 0');

        expect(parser.evaluate({ a: 10, b: 5, c: 3 }, expr)).toBe(false);
    });

    it('resolves plain field name without @. prefix in arithmetic', () => {
        const parser = new SegmentFilterParser(new SecurityGuard());

        const expr = parser.parse('price * qty > 100');

        expect(parser.evaluate({ price: 50, qty: 3 }, expr)).toBe(true);
    });

    it('resolves field with @ prefix as whole item reference', () => {
        const parser = new SegmentFilterParser(new SecurityGuard());

        const expr = parser.parse("contains(@, 'hello')");

        expect(parser.evaluate({ x: 1 } as unknown as Record<string, unknown>, expr)).toBe(false);
    });

    it('evaluates numeric string field value in arithmetic comparison', () => {
        const parser = new SegmentFilterParser(new SecurityGuard());

        const expr = parser.parse('@.a + @.b == 15');

        expect(parser.evaluate({ a: '10', b: '5' }, expr)).toBe(true);
    });
});

describe(`${SegmentFilterParser.name} > mutation killing - splitLogical stringChar`, () => {
    it('tracks single-quoted strings across && logical operator', () => {
        const parser = new SegmentFilterParser(new SecurityGuard());

        const expr = parser.parse("name=='a' && age>1");

        expect(expr.conditions).toHaveLength(2);
        expect(expr.conditions[0].value).toBe('a');
        expect(expr.logicals).toEqual(['&&']);
    });

    it('tracks single-quoted strings across || logical operator', () => {
        const parser = new SegmentFilterParser(new SecurityGuard());

        const expr = parser.parse("name=='x' || name=='y'");

        expect(expr.conditions).toHaveLength(2);
        expect(expr.logicals).toEqual(['||']);
    });

    it('tracks double-quoted strings followed by logical operator', () => {
        const parser = new SegmentFilterParser(new SecurityGuard());

        const expr = parser.parse('name=="val" && age>0');

        expect(expr.conditions).toHaveLength(2);
        expect(expr.conditions[0].value).toBe('val');
    });
});

describe(`${SegmentFilterParser.name} > mutation killing - funcCompare regex anchors`, () => {
    it('matches function comparison only at start of string (^ anchor)', () => {
        const parser = new SegmentFilterParser(new SecurityGuard());

        const expr = parser.parse("starts_with(@.name, 'A') == true");

        expect(expr.conditions[0].func).toBe('starts_with');
        expect(expr.conditions[0].operator).toBe('==');
        expect(expr.conditions[0].value).toBe(true);
    });

    it('matches function comparison only at end of string ($ anchor)', () => {
        const parser = new SegmentFilterParser(new SecurityGuard());

        const expr = parser.parse('values(@.items) >= 3');

        expect(expr.conditions[0].func).toBe('values');
        expect(expr.conditions[0].operator).toBe('>=');
        expect(expr.conditions[0].value).toBe(3);
    });

    it('requires whitespace before operator in function comparison (\\s not \\S)', () => {
        const parser = new SegmentFilterParser(new SecurityGuard());

        const expr = parser.parse('values(@.items) > 0');

        expect(expr.conditions[0].func).toBe('values');
        expect(expr.conditions[0].operator).toBe('>');
    });

    it('trims trailing whitespace from function comparison value', () => {
        const parser = new SegmentFilterParser(new SecurityGuard());

        const expr = parser.parse("starts_with(@.key, 'x')   >   0   ");

        expect(expr.conditions[0].value).toBe(0);
    });

    it('parses funcCompareMatch[4] after trimming', () => {
        const parser = new SegmentFilterParser(new SecurityGuard());

        const expr = parser.parse('values(@.items) == 5');

        expect(expr.conditions[0].value).toBe(5);
    });
});

describe(`${SegmentFilterParser.name} > mutation killing - funcBool regex`, () => {
    it('matches boolean function only at end of string ($ anchor)', () => {
        const parser = new SegmentFilterParser(new SecurityGuard());

        const expr = parser.parse("starts_with(@.x, 'a')");

        expect(expr.conditions[0].func).toBe('starts_with');
        expect(expr.conditions[0].operator).toBe('==');
        expect(expr.conditions[0].value).toBe(true);
    });
});

describe(`${SegmentFilterParser.name} > mutation killing - parseValueDefault`, () => {
    it('returns empty string as raw string (not number)', () => {
        const parser = new SegmentFilterParser(new SecurityGuard());

        const expr = parser.parse("key == ''");

        expect(expr.conditions[0].value).toBe('');
    });
});

describe(`${SegmentFilterParser.name} > mutation killing - arithmetic regex`, () => {
    it('detects arithmetic with single-char operand at start', () => {
        const parser = new SegmentFilterParser(new SecurityGuard());

        const expr = parser.parse('@.a + @.b > 0');

        expect(parser.evaluate({ a: 1, b: 2 }, expr)).toBe(true);
    });

    it('detects arithmetic with single-char operand at end', () => {
        const parser = new SegmentFilterParser(new SecurityGuard());

        const expr = parser.parse('@.x * 2 > 5');

        expect(parser.evaluate({ x: 3 }, expr)).toBe(true);
        expect(parser.evaluate({ x: 2 }, expr)).toBe(false);
    });

    it('detects arithmetic only with word-like operands (not uppercase W)', () => {
        const parser = new SegmentFilterParser(new SecurityGuard());

        const expr = parser.parse('@.price + @.tax > 100');

        expect(parser.evaluate({ price: 80, tax: 25 }, expr)).toBe(true);
    });

    it('resolves integer literal on right side of arithmetic', () => {
        const parser = new SegmentFilterParser(new SecurityGuard());

        const expr = parser.parse('@.val + 5 == 10');

        expect(parser.evaluate({ val: 5 }, expr)).toBe(true);
    });

    it('resolves float literal on right side of arithmetic', () => {
        const parser = new SegmentFilterParser(new SecurityGuard());

        const expr = parser.parse('@.val + 1.5 == 3.5');

        expect(parser.evaluate({ val: 2 }, expr)).toBe(true);
    });

    it('resolves single-digit literal on right side of arithmetic', () => {
        const parser = new SegmentFilterParser(new SecurityGuard());

        const expr = parser.parse('@.val * 3 == 9');

        expect(parser.evaluate({ val: 3 }, expr)).toBe(true);
    });

    it('resolves float with single decimal digit on right side', () => {
        const parser = new SegmentFilterParser(new SecurityGuard());

        const expr = parser.parse('@.val + 0.5 == 1.5');

        expect(parser.evaluate({ val: 1 }, expr)).toBe(true);
    });

    it('arithmetic detection regex requires word chars (not \\W)', () => {
        const parser = new SegmentFilterParser(new SecurityGuard());

        const expr = parser.parse('@.a + @.b > 0');

        expect(parser.evaluate({ a: 5, b: 5 }, expr)).toBe(true);
    });
});

describe(`${SegmentFilterParser.name} > mutation killing - evaluateFunction switch`, () => {
    it('dispatches starts_with correctly (not contains)', () => {
        const parser = new SegmentFilterParser(new SecurityGuard());

        const expr = parser.parse("starts_with(@.name, 'Al')");

        expect(parser.evaluate({ name: 'Alice' }, expr)).toBe(true);
        expect(parser.evaluate({ name: 'xAlice' }, expr)).toBe(false);
    });

    it('dispatches contains correctly (not starts_with)', () => {
        const parser = new SegmentFilterParser(new SecurityGuard());

        const expr = parser.parse("contains(@.name, 'li')");

        expect(parser.evaluate({ name: 'Alice' }, expr)).toBe(true);
        expect(parser.evaluate({ name: 'Bob' }, expr)).toBe(false);
    });
});

describe(`${SegmentFilterParser.name} > mutation killing - evalStartsWith prefix`, () => {
    it('uses funcArgs[1] as prefix when available', () => {
        const parser = new SegmentFilterParser(new SecurityGuard());

        const expr = parser.parse("starts_with(@.name, 'B')");

        expect(parser.evaluate({ name: 'Bob' }, expr)).toBe(true);
        expect(parser.evaluate({ name: 'Alice' }, expr)).toBe(false);
    });

    it('falls back to empty prefix when funcArgs[1] is missing', () => {
        const parser = new SegmentFilterParser(new SecurityGuard());
        const expr = {
            conditions: [
                {
                    field: '@.name',
                    operator: '==' as const,
                    value: true,
                    func: 'starts_with',
                    funcArgs: ['@.name'],
                },
            ],
            logicals: [] as string[],
        };

        expect(parser.evaluate({ name: 'anything' }, expr)).toBe(true);
    });

    it('returns false when field is not a string for starts_with', () => {
        const parser = new SegmentFilterParser(new SecurityGuard());
        const expr = parser.parse("starts_with(@.val, 'x')");

        expect(parser.evaluate({ val: 42 }, expr)).toBe(false);
    });
});

describe(`${SegmentFilterParser.name} > mutation killing - evalContains needle`, () => {
    it('uses funcArgs[1] as needle for contains', () => {
        const parser = new SegmentFilterParser(new SecurityGuard());

        const expr = parser.parse("contains(@.text, 'world')");

        expect(parser.evaluate({ text: 'hello world' }, expr)).toBe(true);
        expect(parser.evaluate({ text: 'hello' }, expr)).toBe(false);
    });

    it('falls back to empty needle when funcArgs[1] is missing', () => {
        const parser = new SegmentFilterParser(new SecurityGuard());
        const expr = {
            conditions: [
                {
                    field: '@.text',
                    operator: '==' as const,
                    value: true,
                    func: 'contains',
                    funcArgs: ['@.text'],
                },
            ],
            logicals: [] as string[],
        };

        expect(parser.evaluate({ text: 'anything' }, expr)).toBe(true);
    });
});

describe(`${SegmentFilterParser.name} > mutation killing - evalValues fallback`, () => {
    it('returns 0 for non-array fields in values()', () => {
        const parser = new SegmentFilterParser(new SecurityGuard());

        const expr = parser.parse('values(@.name) == 0');

        expect(parser.evaluate({ name: 'Alice' }, expr)).toBe(true);
    });
});

describe(`${SegmentFilterParser.name} > mutation killing - resolveFilterArg`, () => {
    it('resolves empty string arg as item reference', () => {
        const parser = new SegmentFilterParser(new SecurityGuard());
        const expr = {
            conditions: [
                {
                    field: '',
                    operator: '==' as const,
                    value: 0,
                    func: 'values',
                    funcArgs: [''],
                },
            ],
            logicals: [] as string[],
        };

        expect(parser.evaluate({ x: 1 }, expr)).toBe(true);
    });

    it('resolves @ as whole item in function arg', () => {
        const parser = new SegmentFilterParser(new SecurityGuard());
        const expr = {
            conditions: [
                {
                    field: '@',
                    operator: '==' as const,
                    value: 0,
                    func: 'values',
                    funcArgs: ['@'],
                },
            ],
            logicals: [] as string[],
        };

        expect(parser.evaluate({ x: 1 }, expr)).toBe(true);
    });

    it('resolves @.field by stripping prefix in function arg', () => {
        const parser = new SegmentFilterParser(new SecurityGuard());

        const expr = parser.parse("starts_with(@.name, 'Al')");

        expect(parser.evaluate({ name: 'Alice' }, expr)).toBe(true);
        expect(parser.evaluate({ name: 'Bob' }, expr)).toBe(false);
    });
});

describe(`${SegmentFilterParser.name} > mutation killing - toNumber in arithmetic`, () => {
    it('resolves @ prefix as item reference in arithmetic', () => {
        const parser = new SegmentFilterParser(new SecurityGuard());

        const expr = parser.parse('@.price * @.qty > 0');

        expect(parser.evaluate({ price: 5, qty: 3 }, expr)).toBe(true);
    });

    it('uses startsWith @ to distinguish field from literal', () => {
        const parser = new SegmentFilterParser(new SecurityGuard());

        const expr = parser.parse('price + 10 > 20');

        expect(parser.evaluate({ price: 15 }, expr)).toBe(true);
        expect(parser.evaluate({ price: 5 }, expr)).toBe(false);
    });

    it('resolves multi-digit integer literal on right side of arithmetic', () => {
        const parser = new SegmentFilterParser(new SecurityGuard());

        const expr = parser.parse('@.val + 10 == 15');

        expect(parser.evaluate({ val: 5 }, expr)).toBe(true);
        expect(parser.evaluate({ val: 6 }, expr)).toBe(false);
    });

    it('resolves multi-digit float literal on right side of arithmetic', () => {
        const parser = new SegmentFilterParser(new SecurityGuard());

        const expr = parser.parse('@.val + 1.55 == 3.55');

        expect(parser.evaluate({ val: 2 }, expr)).toBe(true);
    });

    it('resolves integer literal without decimal (matches \\d+ not requiring \\d+\\.\\d+)', () => {
        const parser = new SegmentFilterParser(new SecurityGuard());

        const expr = parser.parse('@.x * 5 == 25');

        expect(parser.evaluate({ x: 5 }, expr)).toBe(true);
    });
});

describe(`${SegmentFilterParser.name} > funcCompare operator/value field accuracy`, () => {
    it('trims trailing whitespace from string value in funcCompare expression', () => {
        const parser = new SegmentFilterParser(new SecurityGuard());

        // 'true' with trailing spaces: without .trim(), parseValue('true   ') returns the raw string,
        // not the boolean true
        const expr = parser.parse("starts_with(@.name, 'A') == true   ");

        expect(expr.conditions[0].value).toBe(true); // boolean, not 'true   '
    });

    it('stores correct operator (not value) for funcCompare conditions', () => {
        const parser = new SegmentFilterParser(new SecurityGuard());

        const expr = parser.parse('values(@.items) == 5');

        // Mutation: operator = funcCompareMatch[4] = '5' (the value), not '=='
        expect(expr.conditions[0].operator).toBe('==');
        expect(expr.conditions[0].operator).not.toBe('5');
    });

    it('stores correct operator for funcCompare with > comparison', () => {
        const parser = new SegmentFilterParser(new SecurityGuard());

        const expr = parser.parse('values(@.tags) > 2');

        // Mutation: operator = funcCompareMatch[4] = '2', not '>'
        expect(expr.conditions[0].operator).toBe('>');
        expect(expr.conditions[0].operator).not.toBe('2');
    });
});

describe(`${SegmentFilterParser.name} > resolveField missing key returns null`, () => {
    it('returns null for a missing simple field (not undefined)', () => {
        const parser = new SegmentFilterParser(new SecurityGuard());

        // Mutation: hasOwnProperty → true → item['missing'] = undefined
        // undefined === null is false; null === null is true
        const expr = parser.parse('missing == null');

        expect(parser.evaluate({ a: 1 }, expr)).toBe(true);
    });

    it('returns null for missing field in inequality with null', () => {
        const parser = new SegmentFilterParser(new SecurityGuard());

        const expr = parser.parse('noSuchField != null');

        // missing field → null → null != null → false
        expect(parser.evaluate({ a: 1 }, expr)).toBe(false);
    });

    it('returns field value when key exists (not breaking the hasOwnProperty true path)', () => {
        const parser = new SegmentFilterParser(new SecurityGuard());

        const expr = parser.parse('name == null');

        // field 'name' EXISTS and is null → should match
        expect(parser.evaluate({ name: null }, expr)).toBe(true);
        // field 'name' EXISTS but is not null → should not match
        expect(parser.evaluate({ name: 'Alice' }, expr)).toBe(false);
    });
});
