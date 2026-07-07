import { describe, expect, it } from 'vitest';
import { SchemaValidator, type Schema } from '../../src/schema/schema-validator.js';
import { AccessorException } from '../../src/exceptions/accessor-exception.js';

function validatorFor(data: Record<string, unknown>): SchemaValidator {
    const resolve = (path: string): { found: boolean; value: unknown } => {
        let node: unknown = data;
        for (const key of path.split('.')) {
            if (typeof node !== 'object' || node === null || !(key in node)) {
                return { found: false, value: undefined };
            }
            node = (node as Record<string, unknown>)[key];
        }
        return { found: true, value: node };
    };
    return new SchemaValidator(
        (path) => resolve(path).found,
        (path, fallback) => {
            const r = resolve(path);
            return r.found ? r.value : fallback;
        },
    );
}

function validate(data: Record<string, unknown>, schema: Schema) {
    return validatorFor(data).validate(schema);
}

describe('SchemaValidator constraints', () => {
    describe('min / max on numbers', () => {
        it('passes within bounds', () => {
            expect(validate({ n: 50 }, { n: 'int|min:1|max:100' }).valid).toBe(true);
        });

        it('fails below min', () => {
            const r = validate({ n: 0 }, { n: 'int|min:1' });
            expect(r.valid).toBe(false);
            expect(r.errors[0]!.message).toBe('Path "n" must be >= 1, got 0.');
        });

        it('fails above max', () => {
            const r = validate({ n: 150 }, { n: 'int|max:100' });
            expect(r.errors[0]!.message).toBe('Path "n" must be <= 100, got 150.');
        });

        it('accepts a decimal bound on a float', () => {
            expect(validate({ n: 2.5 }, { n: 'float|min:2.0|max:3.0' }).valid).toBe(true);
        });

        it('accepts a negative bound', () => {
            expect(validate({ n: -5 }, { n: 'int|min:-10' }).valid).toBe(true);
        });
    });

    describe('min / max on strings', () => {
        it('measures string length', () => {
            expect(validate({ s: 'abc' }, { s: 'string|min:2|max:5' }).valid).toBe(true);
        });

        it('fails a too-short string with a length message', () => {
            const r = validate({ s: 'a' }, { s: 'string|min:3' });
            expect(r.errors[0]!.message).toBe('Path "s" length must be >= 3, got 1.');
        });

        it('fails a too-long string', () => {
            const r = validate({ s: 'abcdef' }, { s: 'string|max:3' });
            expect(r.errors[0]!.message).toBe('Path "s" length must be <= 3, got 6.');
        });
    });

    describe('min / max on arrays', () => {
        it('measures array size', () => {
            expect(validate({ a: [1, 2] }, { a: 'array|min:1|max:3' }).valid).toBe(true);
        });

        it('fails a too-small array', () => {
            expect(validate({ a: [1] }, { a: 'array|min:2' }).valid).toBe(false);
        });
    });

    describe('enum', () => {
        it('accepts a string in the list', () => {
            expect(validate({ s: 'active' }, { s: 'string|enum:active,inactive' }).valid).toBe(
                true,
            );
        });

        it('rejects a string outside the list', () => {
            const r = validate({ s: 'x' }, { s: 'string|enum:active,inactive' });
            expect(r.errors[0]!.message).toBe(
                'Path "s" must be one of [active, inactive], got "x".',
            );
        });

        it('accepts an int matched against its string form', () => {
            expect(validate({ n: 8080 }, { n: 'int|enum:80,8080,443' }).valid).toBe(true);
        });

        it('rejects an int not in the list', () => {
            expect(validate({ n: 22 }, { n: 'int|enum:80,443' }).valid).toBe(false);
        });
    });

    describe('pattern', () => {
        it('accepts a matching string', () => {
            expect(validate({ s: 'ABC' }, { s: 'string|pattern:^[A-Z]{3}$' }).valid).toBe(true);
        });

        it('rejects a non-matching string', () => {
            const r = validate({ s: 'abc' }, { s: 'string|pattern:^[A-Z]{3}$' });
            expect(r.errors[0]!.message).toBe('Path "s" must match pattern ^[A-Z]{3}$.');
        });
    });

    describe('format shortcuts', () => {
        it('validates email', () => {
            expect(validate({ e: 'a@b.com' }, { e: 'string|email' }).valid).toBe(true);
            expect(validate({ e: 'nope' }, { e: 'string|email' }).errors[0]!.message).toBe(
                'Path "e" must be a valid email.',
            );
        });

        it('validates url', () => {
            expect(validate({ u: 'https://x.io/p' }, { u: 'string|url' }).valid).toBe(true);
            expect(validate({ u: 'ftp://x' }, { u: 'string|url' }).valid).toBe(false);
        });

        it('validates uuid', () => {
            const id = '550e8400-e29b-41d4-a716-446655440000';
            expect(validate({ id }, { id: 'string|uuid' }).valid).toBe(true);
            expect(validate({ id: 'not-a-uuid' }, { id: 'string|uuid' }).valid).toBe(false);
        });
    });

    describe('composition and ordering', () => {
        it('chains multiple constraints', () => {
            expect(
                validate({ s: 'abcd' }, { s: 'string|min:2|max:10|pattern:^[a-z]+$' }).valid,
            ).toBe(true);
        });

        it('reports the first failing constraint only', () => {
            const r = validate({ s: 'A' }, { s: 'string|min:3|pattern:^[a-z]+$' });
            expect(r.errors).toHaveLength(1);
            expect(r.errors[0]!.message).toContain('length must be >= 3');
        });

        it('skips constraints when the base type fails', () => {
            const r = validate({ n: 5 }, { n: 'string|min:2' });
            expect(r.errors).toHaveLength(1);
            expect(r.errors[0]!.message).toContain('expected string, got int');
        });

        it('applies constraints to a present optional path', () => {
            expect(validate({ s: 'a' }, { s: 'string|min:3?' }).valid).toBe(false);
        });

        it('skips an absent optional path with constraints', () => {
            expect(validate({}, { s: 'string|min:3?' }).valid).toBe(true);
        });
    });

    describe('constraint on an incompatible value type', () => {
        it('reports a data error for min on a boolean', () => {
            const r = validate({ b: true }, { b: 'any|min:1' });
            expect(r.valid).toBe(false);
            expect(r.errors[0]!.message).toContain('requires a number, string, or array');
        });

        it('reports a data error for email on a non-string', () => {
            expect(validate({ n: 5 }, { n: 'any|email' }).valid).toBe(false);
        });

        it('reports a data error for max on a boolean', () => {
            const r = validate({ b: true }, { b: 'any|max:1' });
            expect(r.errors[0]!.message).toContain('requires a number, string, or array');
        });

        it('describes null in an enum failure', () => {
            expect(validate({ x: null }, { x: 'any|enum:a,b' }).errors[0]!.message).toContain(
                'got null',
            );
        });

        it('describes an array in an enum failure', () => {
            expect(validate({ x: [1] }, { x: 'any|enum:a,b' }).errors[0]!.message).toContain(
                'got array',
            );
        });

        it('describes an object in an enum failure', () => {
            expect(validate({ x: { k: 1 } }, { x: 'any|enum:a,b' }).errors[0]!.message).toContain(
                'got object',
            );
        });
    });

    describe('schema (programming) errors', () => {
        it('throws on a non-numeric min argument', () => {
            expect(() => validate({ n: 1 }, { n: 'int|min:abc' })).toThrow(AccessorException);
            expect(() => validate({ n: 1 }, { n: 'int|min:abc' })).toThrow(/numeric argument/);
        });

        it('throws on a missing min argument', () => {
            expect(() => validate({ n: 1 }, { n: 'int|min' })).toThrow(AccessorException);
        });

        it('throws on an empty enum', () => {
            expect(() => validate({ s: 'a' }, { s: 'string|enum:' })).toThrow(/enum" is empty/);
        });

        it('throws on an invalid regex', () => {
            expect(() => validate({ s: 'a' }, { s: 'string|pattern:[' })).toThrow(/invalid regex/);
        });

        it('throws on an unknown constraint', () => {
            expect(() => validate({ n: 1 }, { n: 'int|between:1,2' })).toThrow(
                /Unknown schema constraint "between"/,
            );
        });

        it('still throws on an unknown base type', () => {
            expect(() => validate({ n: 1 }, { n: 'integer|min:1' })).toThrow(
                /Unknown schema rule "integer"/,
            );
        });
    });
});
