import { describe, expect, it } from 'vitest';
import { SegmentFilterParser } from '../../src/path-query/segment-filter-parser.js';
import { SecurityGuard } from '../../src/security/security-guard.js';
import { InvalidFormatException } from '../../src/exceptions/invalid-format-exception.js';
import { SecurityException } from '../../src/exceptions/security-exception.js';

describe(SegmentFilterParser.name, () => {
    describe(`${SegmentFilterParser.name} > parse`, () => {
        it('parses a simple greater-than condition', () => {
            const parser = new SegmentFilterParser(new SecurityGuard());

            const result = parser.parse('age>18');

            expect(result.conditions).toHaveLength(1);
            expect(result.conditions[0].field).toBe('age');
            expect(result.conditions[0].operator).toBe('>');
            expect(result.conditions[0].value).toBe(18);
            expect(result.logicals).toHaveLength(0);
        });

        it('parses an equality condition with a string value', () => {
            const parser = new SegmentFilterParser(new SecurityGuard());

            const result = parser.parse("name=='Alice'");

            expect(result.conditions[0].field).toBe('name');
            expect(result.conditions[0].operator).toBe('==');
            expect(result.conditions[0].value).toBe('Alice');
        });

        it('parses a boolean value (true)', () => {
            const parser = new SegmentFilterParser(new SecurityGuard());

            const result = parser.parse('active==true');

            expect(result.conditions[0].value).toBe(true);
        });

        it('parses a boolean value (false)', () => {
            const parser = new SegmentFilterParser(new SecurityGuard());

            const result = parser.parse('active==false');

            expect(result.conditions[0].value).toBe(false);
        });

        it('parses an equality condition with a double-quoted string value', () => {
            const parser = new SegmentFilterParser(new SecurityGuard());

            const result = parser.parse('name=="Alice"');

            expect(result.conditions[0].value).toBe('Alice');
        });

        it('parses a null value', () => {
            const parser = new SegmentFilterParser(new SecurityGuard());

            const result = parser.parse('field==null');

            expect(result.conditions[0].value).toBeNull();
        });

        it('parses a float value', () => {
            const parser = new SegmentFilterParser(new SecurityGuard());

            const result = parser.parse('score>=9.5');

            expect(result.conditions[0].value).toBe(9.5);
        });

        it('parses two conditions joined by logical AND (&&)', () => {
            const parser = new SegmentFilterParser(new SecurityGuard());

            const result = parser.parse('age>18 && active==true');

            expect(result.conditions).toHaveLength(2);
            expect(result.logicals).toEqual(['&&']);
        });

        it('parses two conditions joined by logical OR (||)', () => {
            const parser = new SegmentFilterParser(new SecurityGuard());

            const result = parser.parse("role=='admin' || role=='moderator'");

            expect(result.logicals).toEqual(['||']);
        });

        it('parses a starts_with() function call', () => {
            const parser = new SegmentFilterParser(new SecurityGuard());

            const result = parser.parse("starts_with(@.name, 'J')");

            expect(result.conditions[0].func).toBe('starts_with');
        });

        it('parses a contains() function call', () => {
            const parser = new SegmentFilterParser(new SecurityGuard());

            const result = parser.parse("contains(@.tags, 'php')");

            expect(result.conditions[0].func).toBe('contains');
        });

        it('parses a values() boolean function call', () => {
            const parser = new SegmentFilterParser(new SecurityGuard());

            const result = parser.parse('values(@.tags)');

            expect(result.conditions[0].func).toBe('values');
            expect(result.conditions[0].operator).toBe('==');
            expect(result.conditions[0].value).toBe(true);
        });

        it('parses a function with a comparison operator', () => {
            const parser = new SegmentFilterParser(new SecurityGuard());

            const result = parser.parse('values(@.tags)>2');

            expect(result.conditions[0].func).toBe('values');
            expect(result.conditions[0].operator).toBe('>');
            expect(result.conditions[0].value).toBe(2);
        });

        it('throws InvalidFormatException for a condition without an operator', () => {
            const parser = new SegmentFilterParser(new SecurityGuard());

            expect(() => parser.parse('invalid_no_operator')).toThrow(InvalidFormatException);
        });
    });

    describe(`${SegmentFilterParser.name} > evaluate`, () => {
        it('returns false when there are no conditions', () => {
            const parser = new SegmentFilterParser(new SecurityGuard());

            const result = parser.evaluate({ age: 30 }, { conditions: [], logicals: [] });

            expect(result).toBe(false);
        });

        it('returns true when the item satisfies a > condition', () => {
            const parser = new SegmentFilterParser(new SecurityGuard());
            const expr = parser.parse('age>18');

            expect(parser.evaluate({ age: 30 }, expr)).toBe(true);
        });

        it('returns false when the item fails a > condition', () => {
            const parser = new SegmentFilterParser(new SecurityGuard());
            const expr = parser.parse('age>18');

            expect(parser.evaluate({ age: 10 }, expr)).toBe(false);
        });

        it('returns true for an == condition with string match', () => {
            const parser = new SegmentFilterParser(new SecurityGuard());
            const expr = parser.parse("name=='Alice'");

            expect(parser.evaluate({ name: 'Alice' }, expr)).toBe(true);
        });

        it('returns false for a != condition when values are equal', () => {
            const parser = new SegmentFilterParser(new SecurityGuard());
            const expr = parser.parse("status!='open'");

            expect(parser.evaluate({ status: 'open' }, expr)).toBe(false);
        });

        it('returns true for a != condition when values differ', () => {
            const parser = new SegmentFilterParser(new SecurityGuard());
            const expr = parser.parse("status!='open'");

            expect(parser.evaluate({ status: 'closed' }, expr)).toBe(true);
        });

        it('evaluates logical AND as true only when both conditions pass', () => {
            const parser = new SegmentFilterParser(new SecurityGuard());
            const expr = parser.parse('age>18 && active==true');

            expect(parser.evaluate({ age: 30, active: true }, expr)).toBe(true);
            expect(parser.evaluate({ age: 30, active: false }, expr)).toBe(false);
            expect(parser.evaluate({ age: 10, active: true }, expr)).toBe(false);
        });

        it('evaluates logical OR as true when at least one condition passes', () => {
            const parser = new SegmentFilterParser(new SecurityGuard());
            const expr = parser.parse("role=='admin' || role=='moderator'");

            expect(parser.evaluate({ role: 'admin' }, expr)).toBe(true);
            expect(parser.evaluate({ role: 'moderator' }, expr)).toBe(true);
            expect(parser.evaluate({ role: 'guest' }, expr)).toBe(false);
        });

        it('evaluates starts_with() returning true when the field starts with prefix', () => {
            const parser = new SegmentFilterParser(new SecurityGuard());
            const expr = parser.parse("starts_with(@.name, 'Al')");

            expect(parser.evaluate({ name: 'Alice' }, expr)).toBe(true);
            expect(parser.evaluate({ name: 'Bob' }, expr)).toBe(false);
        });

        it('evaluates starts_with() as false for non-string field values', () => {
            const parser = new SegmentFilterParser(new SecurityGuard());
            const expr = parser.parse("starts_with(@.score, 'A')");

            expect(parser.evaluate({ score: 42 }, expr)).toBe(false);
        });

        it('evaluates contains() returning true when string field contains needle', () => {
            const parser = new SegmentFilterParser(new SecurityGuard());
            const expr = parser.parse("contains(@.bio, 'engineer')");

            expect(parser.evaluate({ bio: 'senior engineer' }, expr)).toBe(true);
            expect(parser.evaluate({ bio: 'designer' }, expr)).toBe(false);
        });

        it('evaluates contains() on an array field', () => {
            const parser = new SegmentFilterParser(new SecurityGuard());
            const expr = parser.parse("contains(@.tags, 'php')");

            expect(parser.evaluate({ tags: ['php', 'python'] }, expr)).toBe(true);
            expect(parser.evaluate({ tags: ['ruby'] }, expr)).toBe(false);
        });

        it('evaluates contains() as false for non-string non-array values', () => {
            const parser = new SegmentFilterParser(new SecurityGuard());
            const expr = parser.parse("contains(@.count, 'x')");

            expect(parser.evaluate({ count: 42 }, expr)).toBe(false);
        });

        it('evaluates values() returning count of array field', () => {
            const parser = new SegmentFilterParser(new SecurityGuard());
            const expr = parser.parse('values(@.tags)>1');

            expect(parser.evaluate({ tags: ['php', 'js'] }, expr)).toBe(true);
            expect(parser.evaluate({ tags: ['php'] }, expr)).toBe(false);
        });

        it('evaluates values() returning 0 for non-array fields', () => {
            const parser = new SegmentFilterParser(new SecurityGuard());
            const expr = parser.parse('values(@.name)>0');

            expect(parser.evaluate({ name: 'Alice' }, expr)).toBe(false);
        });

        it('evaluates an arithmetic expression in the field', () => {
            const parser = new SegmentFilterParser(new SecurityGuard());
            const expr = parser.parse('@.price * @.qty > 100');

            expect(parser.evaluate({ price: 25, qty: 5 }, expr)).toBe(true);
            expect(parser.evaluate({ price: 10, qty: 5 }, expr)).toBe(false);
        });

        it('evaluates <= and >= boundary conditions', () => {
            const parser = new SegmentFilterParser(new SecurityGuard());

            const exprLe = parser.parse('age<=30');
            expect(parser.evaluate({ age: 30 }, exprLe)).toBe(true);
            expect(parser.evaluate({ age: 31 }, exprLe)).toBe(false);

            const exprGe = parser.parse('age>=18');
            expect(parser.evaluate({ age: 18 }, exprGe)).toBe(true);
        });

        it('throws InvalidFormatException for an unknown function', () => {
            const parser = new SegmentFilterParser(new SecurityGuard());
            const expr = parser.parse('unknown_func(@.name)');

            expect(() => parser.evaluate({ name: 'Alice' }, expr)).toThrow(InvalidFormatException);
        });

        it('throws SecurityException when a field key is forbidden', () => {
            const parser = new SegmentFilterParser(new SecurityGuard());
            const expr = parser.parse('__proto__==true');

            expect(() =>
                parser.evaluate({ __proto__: true } as Record<string, unknown>, expr),
            ).toThrow(SecurityException);
        });

        it('parses an unquoted non-numeric value as a bare string', () => {
            const parser = new SegmentFilterParser(new SecurityGuard());
            const expr = parser.parse('status == active');

            expect(expr.conditions[0].value).toBe('active');
        });

        it('evaluates a strict less-than condition', () => {
            const parser = new SegmentFilterParser(new SecurityGuard());
            const expr = parser.parse('age < 18');

            expect(parser.evaluate({ age: 15 }, expr)).toBe(true);
            expect(parser.evaluate({ age: 18 }, expr)).toBe(false);
        });

        it('returns null from resolveArithmetic for a multi-operator field expression', () => {
            const parser = new SegmentFilterParser(new SecurityGuard());
            const expr = parser.parse('@.a + @.b + @.c > 0');

            expect(parser.evaluate({ a: 1, b: 2, c: 3 }, expr)).toBe(false);
        });

        it('evaluates arithmetic with a float literal on the left side', () => {
            const parser = new SegmentFilterParser(new SecurityGuard());
            const expr = parser.parse('5.5 * @.qty > 2');

            expect(parser.evaluate({ qty: 1 }, expr)).toBe(true);
        });

        it('converts a numeric-string field value to a number in arithmetic', () => {
            const parser = new SegmentFilterParser(new SecurityGuard());
            const expr = parser.parse('@.price * @.qty > 40');

            expect(parser.evaluate({ price: '10', qty: '5' }, expr)).toBe(true);
        });

        it('returns null and evaluates false when an arithmetic field is missing from data', () => {
            const parser = new SegmentFilterParser(new SecurityGuard());
            const expr = parser.parse('@.missing * @.qty > 0');

            expect(parser.evaluate({ qty: 5 }, expr)).toBe(false);
        });

        it('evaluates arithmetic addition between two field values', () => {
            const parser = new SegmentFilterParser(new SecurityGuard());
            const expr = parser.parse('@.a + @.b > 5');

            expect(parser.evaluate({ a: 3, b: 4 }, expr)).toBe(true);
        });

        it('evaluates arithmetic subtraction between two field values', () => {
            const parser = new SegmentFilterParser(new SecurityGuard());
            const expr = parser.parse('@.a - @.b > 0');

            expect(parser.evaluate({ a: 5, b: 3 }, expr)).toBe(true);
        });

        it('evaluates contains() with @ referring to the whole item array', () => {
            const parser = new SegmentFilterParser(new SecurityGuard());
            const expr = parser.parse("contains(@, 'x')");

            expect(parser.evaluate(['x', 'y'] as unknown as Record<string, unknown>, expr)).toBe(
                true,
            );
            expect(parser.evaluate(['a', 'b'] as unknown as Record<string, unknown>, expr)).toBe(
                false,
            );
        });

        it('resolves a plain field name (no @. prefix) in an arithmetic expression', () => {
            const parser = new SegmentFilterParser(new SecurityGuard());
            const expr = parser.parse('price * 2 > 10');

            expect(parser.evaluate({ price: 6 }, expr)).toBe(true);
        });

        it('resolves a dot-separated field path in a filter condition', () => {
            const parser = new SegmentFilterParser(new SecurityGuard());
            const expr = parser.parse('user.age >= 18');

            expect(parser.evaluate({ user: { age: 20 } }, expr)).toBe(true);
            expect(parser.evaluate({ user: { age: 15 } }, expr)).toBe(false);
        });

        it('returns null for a missing nested field in a dot-separated filter path', () => {
            const parser = new SegmentFilterParser(new SecurityGuard());
            const expr = parser.parse('user.age >= 18');

            expect(parser.evaluate({ other: 'data' }, expr)).toBe(false);
        });

        it('evaluates arithmetic division between two field values', () => {
            const parser = new SegmentFilterParser(new SecurityGuard());
            const expr = parser.parse('@.a / @.b > 2');

            expect(parser.evaluate({ a: 10, b: 3 }, expr)).toBe(true);
        });

        it('returns null for arithmetic division by zero', () => {
            const parser = new SegmentFilterParser(new SecurityGuard());
            const expr = parser.parse('@.a / @.b > 0');

            expect(parser.evaluate({ a: 10, b: 0 }, expr)).toBe(false);
        });

        it('returns false for an unsupported operator in evaluateCondition', () => {
            const parser = new SegmentFilterParser(new SecurityGuard());
            const expr = {
                conditions: [{ field: 'x', operator: '~', value: 1 }],
                logicals: [],
            };

            expect(parser.evaluate({ x: 1 }, expr)).toBe(false);
        });

        it('evaluates arithmetic with an integer literal on the right side', () => {
            const parser = new SegmentFilterParser(new SecurityGuard());
            const expr = parser.parse('@.qty * 2 > 4');

            expect(parser.evaluate({ qty: 3 }, expr)).toBe(true);
        });

        it('evaluates a numeric-string field with a decimal in arithmetic', () => {
            const parser = new SegmentFilterParser(new SecurityGuard());
            const expr = parser.parse('@.price * @.rate > 10');

            expect(parser.evaluate({ price: '3.5', rate: '4.0' }, expr)).toBe(true);
        });

        it('falls back to @ when starts_with funcArgs is empty', () => {
            const parser = new SegmentFilterParser(new SecurityGuard());
            const expr = {
                conditions: [
                    {
                        field: '@',
                        operator: '==',
                        value: true,
                        func: 'starts_with',
                        funcArgs: [] as string[],
                    },
                ],
                logicals: [],
            };

            expect(parser.evaluate({ x: 1 }, expr)).toBe(false);
        });

        it('falls back to @ when contains funcArgs is empty', () => {
            const parser = new SegmentFilterParser(new SecurityGuard());
            const expr = {
                conditions: [
                    {
                        field: '@',
                        operator: '==',
                        value: true,
                        func: 'contains',
                        funcArgs: [] as string[],
                    },
                ],
                logicals: [],
            };

            expect(parser.evaluate({ x: 1 }, expr)).toBe(false);
        });

        it('falls back to @ when values funcArgs is empty', () => {
            const parser = new SegmentFilterParser(new SecurityGuard());
            const expr = {
                conditions: [
                    {
                        field: '@',
                        operator: '==',
                        value: true,
                        func: 'values',
                        funcArgs: [] as string[],
                    },
                ],
                logicals: [],
            };

            expect(parser.evaluate({ x: 1 }, expr)).toBe(false);
        });

        it('falls back to empty funcArgs when funcArgs is undefined', () => {
            const parser = new SegmentFilterParser(new SecurityGuard());
            const expr = {
                conditions: [{ field: '@', operator: '==', value: true, func: 'values' }],
                logicals: [],
            };

            expect(parser.evaluate({ x: 1 }, expr)).toBe(false);
        });

        it('evaluates starts_with with only one funcArg (no prefix)', () => {
            const parser = new SegmentFilterParser(new SecurityGuard());
            const expr = {
                conditions: [
                    {
                        field: '@.name',
                        operator: '==',
                        value: true,
                        func: 'starts_with',
                        funcArgs: ['@.name'],
                    },
                ],
                logicals: [],
            };

            expect(parser.evaluate({ name: 'Alice' }, expr)).toBe(true);
        });

        it('parses strings inside logical expressions respecting quotes', () => {
            const parser = new SegmentFilterParser(new SecurityGuard());
            const expr = parser.parse("name=='a && b'");

            expect(expr.conditions).toHaveLength(1);
            expect(expr.conditions[0].value).toBe('a && b');
        });
    });

    describe(`${SegmentFilterParser.name} > mutation boundary tests`, () => {
        it('trims whitespace from tokens in splitLogical before parsing condition', () => {
            const parser = new SegmentFilterParser(new SecurityGuard());
            const expr = parser.parse('  age > 18  &&  active == true  ');

            expect(expr.conditions).toHaveLength(2);
            expect(expr.conditions[0].field).toBe('age');
            expect(expr.conditions[1].field).toBe('active');
        });

        it('does not treat single & as logical AND', () => {
            const parser = new SegmentFilterParser(new SecurityGuard());
            const expr = parser.parse('x>1 & y>2');

            expect(expr.conditions).toHaveLength(1);
            expect(expr.conditions[0].field).toBe('x');
            expect(expr.conditions[0].value).toBe('1 & y>2');
        });

        it('does not treat single | as logical OR', () => {
            const parser = new SegmentFilterParser(new SecurityGuard());
            const expr = parser.parse('x>1 | y>2');

            expect(expr.conditions).toHaveLength(1);
            expect(expr.conditions[0].field).toBe('x');
            expect(expr.conditions[0].value).toBe('1 | y>2');
        });

        it('treats & at end of expression as part of token', () => {
            const parser = new SegmentFilterParser(new SecurityGuard());
            const expr = parser.parse('x>1&');

            expect(expr.conditions).toHaveLength(1);
            expect(expr.conditions[0].value).toBe('1&');
        });

        it('treats | at end of expression as part of token', () => {
            const parser = new SegmentFilterParser(new SecurityGuard());
            const expr = parser.parse('x>1|');

            expect(expr.conditions).toHaveLength(1);
            expect(expr.conditions[0].value).toBe('1|');
        });

        it('handles && where the second & is the last character of the expression', () => {
            const parser = new SegmentFilterParser(new SecurityGuard());
            const expr = parser.parse('a>1&&b>2');

            expect(expr.conditions).toHaveLength(2);
            expect(expr.logicals).toEqual(['&&']);
        });

        it('handles || where the second | is the last character of the expression', () => {
            const parser = new SegmentFilterParser(new SecurityGuard());
            const expr = parser.parse('a>1||b>2');

            expect(expr.conditions).toHaveLength(2);
            expect(expr.logicals).toEqual(['||']);
        });

        it('handles & not followed by & (single ampersand in quoted value)', () => {
            const parser = new SegmentFilterParser(new SecurityGuard());
            const expr = parser.parse("name=='a&b'");

            expect(expr.conditions).toHaveLength(1);
            expect(expr.conditions[0].value).toBe('a&b');
        });

        it('handles | not followed by | (single pipe in quoted value)', () => {
            const parser = new SegmentFilterParser(new SecurityGuard());
            const expr = parser.parse("name=='a|b'");

            expect(expr.conditions).toHaveLength(1);
            expect(expr.conditions[0].value).toBe('a|b');
        });

        it('funcCompareMatch regex requires ^ anchor', () => {
            const parser = new SegmentFilterParser(new SecurityGuard());
            const expr = parser.parse("starts_with(@.name, 'J') > 0");

            expect(expr.conditions[0].func).toBe('starts_with');
            expect(expr.conditions[0].operator).toBe('>');
        });

        it('funcCompareMatch regex requires $ anchor (rejects trailing text)', () => {
            const parser = new SegmentFilterParser(new SecurityGuard());
            const expr = parser.parse("starts_with(@.name, 'J') > 0");

            expect(expr.conditions[0].func).toBe('starts_with');
            expect(expr.conditions[0].value).toBe(0);
        });

        it('funcCompareMatch \\s* requires whitespace not \\S* for operator spacing', () => {
            const parser = new SegmentFilterParser(new SecurityGuard());
            const expr = parser.parse('values(@.items) >= 3');

            expect(expr.conditions[0].func).toBe('values');
            expect(expr.conditions[0].operator).toBe('>=');
            expect(expr.conditions[0].value).toBe(3);
        });

        it('trims rawValue from funcCompareMatch capture group', () => {
            const parser = new SegmentFilterParser(new SecurityGuard());
            const expr = parser.parse("values(@.items) > '  hello  '");

            expect(expr.conditions[0].value).toBe('  hello  ');
        });

        it('trims funcArgs from argsRaw split in funcCompare', () => {
            const parser = new SegmentFilterParser(new SecurityGuard());
            const expr = parser.parse("starts_with( @.name , 'J' ) > 0");

            expect(expr.conditions[0].funcArgs).toEqual(['@.name', "'J'"]);
        });

        it('funcBoolMatch regex requires ^ anchor', () => {
            const parser = new SegmentFilterParser(new SecurityGuard());
            const expr = parser.parse('values(@.tags)');

            expect(expr.conditions[0].func).toBe('values');
            expect(expr.conditions[0].operator).toBe('==');
            expect(expr.conditions[0].value).toBe(true);
        });

        it('funcBoolMatch regex requires $ anchor (does not match suffix text)', () => {
            const parser = new SegmentFilterParser(new SecurityGuard());

            expect(() => parser.parse('values(@.tags)x')).toThrow(InvalidFormatException);
        });

        it('parseValue returns integer for numbers without a decimal', () => {
            const parser = new SegmentFilterParser(new SecurityGuard());
            const expr = parser.parse('count==42');

            expect(expr.conditions[0].value).toBe(42);
            expect(Number.isInteger(expr.conditions[0].value)).toBe(true);
        });

        it('parseValue returns float for numbers with a decimal', () => {
            const parser = new SegmentFilterParser(new SecurityGuard());
            const expr = parser.parse('score==9.5');

            expect(expr.conditions[0].value).toBe(9.5);
        });

        it('parseValue uses parseInt for integer strings not parseFloat', () => {
            const parser = new SegmentFilterParser(new SecurityGuard());
            const expr = parser.parse('count==007');

            expect(expr.conditions[0].value).toBe(7);
            expect(Number.isInteger(expr.conditions[0].value)).toBe(true);
        });

        it('evaluates starts_with correctly, not falling through to contains', () => {
            const parser = new SegmentFilterParser(new SecurityGuard());
            const expr = parser.parse("starts_with(@.name, 'A')");

            expect(parser.evaluate({ name: 'Alice' }, expr)).toBe(true);
            expect(parser.evaluate({ name: 'Bob' }, expr)).toBe(false);
        });

        it('evaluates starts_with false for value not starting with prefix', () => {
            const parser = new SegmentFilterParser(new SecurityGuard());
            const expr = parser.parse("starts_with(@.name, 'Z')");

            expect(parser.evaluate({ name: 'Alice' }, expr)).toBe(false);
        });

        it('falls back to @ when funcArgs[0] is undefined in starts_with', () => {
            const parser = new SegmentFilterParser(new SecurityGuard());
            const expr = {
                conditions: [
                    {
                        field: '@',
                        operator: '==',
                        value: true,
                        func: 'starts_with',
                        funcArgs: [] as string[],
                    },
                ],
                logicals: [],
            };

            expect(parser.evaluate('hello' as unknown as Record<string, unknown>, expr)).toBe(true);
        });

        it('falls back to @ when funcArgs[0] is undefined in contains', () => {
            const parser = new SegmentFilterParser(new SecurityGuard());
            const expr = {
                conditions: [
                    {
                        field: '@',
                        operator: '==',
                        value: true,
                        func: 'contains',
                        funcArgs: [] as string[],
                    },
                ],
                logicals: [],
            };

            expect(parser.evaluate('hello' as unknown as Record<string, unknown>, expr)).toBe(true);
        });

        it('falls back to @ when funcArgs[0] is undefined in values', () => {
            const parser = new SegmentFilterParser(new SecurityGuard());
            const expr = {
                conditions: [
                    {
                        field: '@',
                        operator: '==',
                        value: 3,
                        func: 'values',
                        funcArgs: [] as string[],
                    },
                ],
                logicals: [],
            };

            expect(parser.evaluate([1, 2, 3] as unknown as Record<string, unknown>, expr)).toBe(
                true,
            );
        });

        it('trims whitespace from the second funcArg in starts_with', () => {
            const parser = new SegmentFilterParser(new SecurityGuard());
            const expr = parser.parse("starts_with(@.name, ' Al ')");

            expect(parser.evaluate({ name: ' Al ice' }, expr)).toBe(true);
            expect(parser.evaluate({ name: 'Al' }, expr)).toBe(false);
        });

        it('trims whitespace from the second funcArg in contains', () => {
            const parser = new SegmentFilterParser(new SecurityGuard());
            const expr = parser.parse("contains(@.bio, ' eng ')");

            expect(parser.evaluate({ bio: 'senior eng ineer' }, expr)).toBe(true);
            expect(parser.evaluate({ bio: 'senior engineer' }, expr)).toBe(false);
        });

        it('contains with missing second funcArg falls back to empty string', () => {
            const parser = new SegmentFilterParser(new SecurityGuard());
            const expr = {
                conditions: [
                    {
                        field: '@.name',
                        operator: '==',
                        value: true,
                        func: 'contains',
                        funcArgs: ['@.name'],
                    },
                ],
                logicals: [],
            };

            expect(parser.evaluate({ name: 'hello' }, expr)).toBe(true);
        });

        it('starts_with with missing second funcArg falls back to empty string', () => {
            const parser = new SegmentFilterParser(new SecurityGuard());
            const expr = {
                conditions: [
                    {
                        field: '@.name',
                        operator: '==',
                        value: true,
                        func: 'starts_with',
                        funcArgs: ['@.name'],
                    },
                ],
                logicals: [],
            };

            expect(parser.evaluate({ name: 'Alice' }, expr)).toBe(true);
        });

        it('starts_with returns false when val is not a string', () => {
            const parser = new SegmentFilterParser(new SecurityGuard());
            const expr = {
                conditions: [
                    {
                        field: '@',
                        operator: '==',
                        value: true,
                        func: 'starts_with',
                        funcArgs: ['@', "'x'"],
                    },
                ],
                logicals: [],
            };

            expect(parser.evaluate({ a: 1 } as Record<string, unknown>, expr)).toBe(false);
        });

        it('resolveFilterArg returns item when arg is empty string', () => {
            const parser = new SegmentFilterParser(new SecurityGuard());
            const expr = {
                conditions: [
                    { field: '', operator: '==', value: 3, func: 'values', funcArgs: [''] },
                ],
                logicals: [],
            };

            expect(parser.evaluate([1, 2, 3] as unknown as Record<string, unknown>, expr)).toBe(
                true,
            );
        });

        it('resolveFilterArg returns item when arg is @', () => {
            const parser = new SegmentFilterParser(new SecurityGuard());
            const expr = {
                conditions: [
                    { field: '@', operator: '==', value: 3, func: 'values', funcArgs: ['@'] },
                ],
                logicals: [],
            };

            expect(parser.evaluate([1, 2, 3] as unknown as Record<string, unknown>, expr)).toBe(
                true,
            );
        });

        it('resolveFilterArg resolves @.field path', () => {
            const parser = new SegmentFilterParser(new SecurityGuard());
            const expr = {
                conditions: [
                    {
                        field: '@.items',
                        operator: '==',
                        value: 2,
                        func: 'values',
                        funcArgs: ['@.items'],
                    },
                ],
                logicals: [],
            };

            expect(parser.evaluate({ items: [1, 2] }, expr)).toBe(true);
        });

        it('arithmetic regex requires \\d+ not \\d for multi-digit integers', () => {
            const parser = new SegmentFilterParser(new SecurityGuard());
            const expr = parser.parse('@.val + 10 > 5');

            expect(parser.evaluate({ val: 0 }, expr)).toBe(true);
        });

        it('arithmetic regex requires \\d not \\D for digit matching', () => {
            const parser = new SegmentFilterParser(new SecurityGuard());

            const expr = parser.parse('@.val + 5 > 4');
            expect(parser.evaluate({ val: 0 }, expr)).toBe(true);

            const expr2 = parser.parse('@.val * abc > 0');
            expect(parser.evaluate({ val: 5 }, expr2)).toBe(false);
        });

        it('arithmetic regex treats \\.\\d+ as optional via (?:)?', () => {
            const parser = new SegmentFilterParser(new SecurityGuard());
            const expr = parser.parse('@.val + 10 > 9');

            expect(parser.evaluate({ val: 0 }, expr)).toBe(true);

            const exprFloat = parser.parse('@.val + 10.5 > 10');

            expect(parser.evaluate({ val: 0 }, exprFloat)).toBe(true);
        });

        it('arithmetic regex requires \\. not \\D for decimal separator', () => {
            const parser = new SegmentFilterParser(new SecurityGuard());
            const expr = parser.parse('@.val + 1.5 > 1');

            expect(parser.evaluate({ val: 0 }, expr)).toBe(true);
        });

        it('arithmetic regex requires \\d+ after decimal point', () => {
            const parser = new SegmentFilterParser(new SecurityGuard());
            const expr = parser.parse('@.val + 10.55 > 10');

            expect(parser.evaluate({ val: 0 }, expr)).toBe(true);
        });

        it("toNumber checks startsWith('@') not endsWith('@') for field tokens", () => {
            const parser = new SegmentFilterParser(new SecurityGuard());
            const expr = parser.parse('@.val + 5 > 0');

            expect(parser.evaluate({ val: 1 }, expr)).toBe(true);

            const expr2 = parser.parse('abc + 5 > 0');
            expect(parser.evaluate({ abc: 1 }, expr2)).toBe(true);
        });

        it('toNumber uses parseInt for integer tokens not parseFloat', () => {
            const parser = new SegmentFilterParser(new SecurityGuard());
            const expr = parser.parse('@.val + 007 > 6');

            expect(parser.evaluate({ val: 0 }, expr)).toBe(true);
            expect(Number.isInteger(7)).toBe(true);
        });

        it('toNumber uses parseInt for integer string values not parseFloat', () => {
            const parser = new SegmentFilterParser(new SecurityGuard());
            const expr = parser.parse('@.val * 1 == 42');

            expect(parser.evaluate({ val: '42' }, expr)).toBe(true);
        });

        it('toNumber uses parseFloat for decimal string values', () => {
            const parser = new SegmentFilterParser(new SecurityGuard());
            const expr = parser.parse('@.val * 1 == 3.14');

            expect(parser.evaluate({ val: '3.14' }, expr)).toBe(true);
        });

        it('evaluates condition when funcArgs is undefined and falls back to empty array', () => {
            const parser = new SegmentFilterParser(new SecurityGuard());
            const expr = {
                conditions: [{ field: '@', operator: '==', value: 0, func: 'values' }],
                logicals: [],
            };

            expect(parser.evaluate({ items: [1, 2] }, expr)).toBe(true);
        });

        it('funcArgs fallback to empty array does not inject a string value', () => {
            const parser = new SegmentFilterParser(new SecurityGuard());
            const expr = {
                conditions: [{ field: '@', operator: '==', value: true, func: 'starts_with' }],
                logicals: [],
            };

            expect(parser.evaluate('hello' as unknown as Record<string, unknown>, expr)).toBe(true);
        });

        it('arithmetic regex + quantifier on left side matches multi-char fields', () => {
            const parser = new SegmentFilterParser(new SecurityGuard());
            const expr = parser.parse('@.total + 1 > 5');

            expect(parser.evaluate({ total: 10 }, expr)).toBe(true);
        });

        it('arithmetic regex + quantifier on right side matches multi-char tokens', () => {
            const parser = new SegmentFilterParser(new SecurityGuard());
            const expr = parser.parse('@.x + @.total > 5');

            expect(parser.evaluate({ x: 1, total: 10 }, expr)).toBe(true);
        });

        it('detects arithmetic even with \\W mutation by testing non-@ token resolution', () => {
            const parser = new SegmentFilterParser(new SecurityGuard());

            const expr = parser.parse('count + 1 > 5');
            expect(parser.evaluate({ count: 10 }, expr)).toBe(true);
        });

        it('resolveField with dot-separated path traverses nested objects', () => {
            const parser = new SegmentFilterParser(new SecurityGuard());
            const expr = parser.parse('a.b.c > 1');

            expect(parser.evaluate({ a: { b: { c: 5 } } }, expr)).toBe(true);
        });

        it('resolveField returns null when intermediate key leads to non-object', () => {
            const parser = new SegmentFilterParser(new SecurityGuard());
            const expr = parser.parse('a.b.c > 1');

            expect(parser.evaluate({ a: { b: 'string' } }, expr)).toBe(false);
        });

        it('resolveField returns null when intermediate key leads to null', () => {
            const parser = new SegmentFilterParser(new SecurityGuard());
            const expr = parser.parse('a.b.c > 1');

            expect(parser.evaluate({ a: { b: null } }, expr)).toBe(false);
        });

        it('resolveField returns null when intermediate key is missing', () => {
            const parser = new SegmentFilterParser(new SecurityGuard());
            const expr = parser.parse('a.b.c > 1');

            expect(parser.evaluate({ a: {} }, expr)).toBe(false);
        });

        it('resolveField handles single key (no dot)', () => {
            const parser = new SegmentFilterParser(new SecurityGuard());
            const expr = parser.parse("name == 'Alice'");

            expect(parser.evaluate({ name: 'Alice' }, expr)).toBe(true);
        });

        it('resolveField with dot returns null when intermediate value is non-object', () => {
            const parser = new SegmentFilterParser(new SecurityGuard());
            const expr = parser.parse('a.b > 0');

            expect(parser.evaluate({ a: 42 }, expr)).toBe(false);
        });

        it('resolveField with dot segment includes branch requires typeof check', () => {
            const parser = new SegmentFilterParser(new SecurityGuard());
            const expr = parser.parse('a.b > 0');

            expect(parser.evaluate({ a: 'string' }, expr)).toBe(false);
            expect(parser.evaluate({ a: { b: 5 } }, expr)).toBe(true);
        });

        it('parses strings inside logical expressions respecting quotes', () => {
            const parser = new SegmentFilterParser(new SecurityGuard());
            const expr = parser.parse("name=='a && b'");

            expect(expr.conditions).toHaveLength(1);
            expect(expr.conditions[0].value).toBe('a && b');
        });

        it('trim on token in parse() is needed for function expressions with leading whitespace', () => {
            const parser = new SegmentFilterParser(new SecurityGuard());
            const expr = parser.parse("  starts_with(@.name, 'J')  &&  contains(@.name, 'o')  ");

            expect(expr.conditions).toHaveLength(2);
            expect(expr.conditions[0].func).toBe('starts_with');
            expect(expr.conditions[1].func).toBe('contains');
        });

        it('trim on token in parse() is needed for funcCompare with leading whitespace', () => {
            const parser = new SegmentFilterParser(new SecurityGuard());
            const expr = parser.parse('  values(@.items) > 2  ');

            expect(expr.conditions).toHaveLength(1);
            expect(expr.conditions[0].func).toBe('values');
            expect(expr.conditions[0].operator).toBe('>');
        });

        it('trim on rawValue in funcCompare is needed for trailing whitespace', () => {
            const parser = new SegmentFilterParser(new SecurityGuard());
            const expr = parser.parse('values(@.items) >  3 ');

            expect(expr.conditions[0].value).toBe(3);
        });

        it('integer vs float distinction in toNumber via includes(.)', () => {
            const parser = new SegmentFilterParser(new SecurityGuard());
            const expr = parser.parse('@.count * 2 > 5');

            expect(parser.evaluate({ count: 3 }, expr)).toBe(true);
            expect(parser.evaluate({ count: 2 }, expr)).toBe(false);
        });

        it('toNumber uses parseInt for integer tokens producing exact int', () => {
            const parser = new SegmentFilterParser(new SecurityGuard());
            const expr = parser.parse('@.price * 100 == 500');

            expect(parser.evaluate({ price: 5 }, expr)).toBe(true);
        });

        it('toNumber converts numeric string val to number for arithmetic', () => {
            const parser = new SegmentFilterParser(new SecurityGuard());
            const expr = parser.parse('@.a + @.b == 10');

            expect(parser.evaluate({ a: '3', b: '7' }, expr)).toBe(true);
            expect(parser.evaluate({ a: '3.5', b: '6.5' }, expr)).toBe(true);
        });

        it('toNumber returns null for empty string field value in arithmetic', () => {
            const parser = new SegmentFilterParser(new SecurityGuard());
            const expr = parser.parse('@.a + @.b == 10');

            expect(parser.evaluate({ a: '', b: '7' }, expr)).toBe(false);
        });

        it('toNumber val !== empty string check prevents empty string becoming 0', () => {
            const parser = new SegmentFilterParser(new SecurityGuard());
            const expr = parser.parse('@.val + 1 == 1');

            expect(parser.evaluate({ val: '' }, expr)).toBe(false);
            expect(parser.evaluate({ val: 0 }, expr)).toBe(true);
        });

        it('resolveField dot path typeof check prevents crash on null intermediate', () => {
            const parser = new SegmentFilterParser(new SecurityGuard());
            const expr = parser.parse('a.b.c == 1');

            expect(parser.evaluate({ a: { b: null } }, expr)).toBe(false);
        });

        it('resolveField dot path typeof check prevents crash on primitive intermediate', () => {
            const parser = new SegmentFilterParser(new SecurityGuard());
            const expr = parser.parse('a.b.c == 1');

            expect(parser.evaluate({ a: { b: 42 } }, expr)).toBe(false);
        });
    });
});
