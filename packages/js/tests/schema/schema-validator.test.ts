import { describe, expect, it } from 'vitest';
import { SchemaValidator, type Schema } from '../../src/schema/schema-validator.js';
import { AccessorException } from '../../src/exceptions/accessor-exception.js';

/**
 * Build a validator backed by a plain nested record, resolving dotted paths
 * against it. Keeps the validator test independent of the accessor.
 */
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

describe(SchemaValidator.name, () => {
    it('accepts data that satisfies every rule', () => {
        const result = validate(
            { name: 'Alice', age: 30, ratio: 1.5, active: true, tags: ['a'], meta: { k: 1 } },
            {
                name: 'string',
                age: 'int',
                ratio: 'float',
                active: 'bool',
                tags: 'array',
                meta: 'object',
            },
        );
        expect(result.valid).toBe(true);
        expect(result.errors).toEqual([]);
    });

    it('reports a missing required path', () => {
        const result = validate({ name: 'Alice' }, { email: 'string' });
        expect(result.valid).toBe(false);
        expect(result.errors).toEqual([
            {
                path: 'email',
                expected: 'string',
                actual: 'missing',
                message: 'Missing required path "email" (expected string).',
            },
        ]);
    });

    it('reports a type mismatch', () => {
        const result = validate({ age: '30' }, { age: 'int' });
        expect(result.errors[0]).toMatchObject({
            path: 'age',
            expected: 'int',
            actual: 'string',
            message: 'Path "age" expected int, got string.',
        });
    });

    describe('optional rules', () => {
        it('allows an absent optional path', () => {
            expect(validate({}, { nickname: 'string?' }).valid).toBe(true);
        });

        it('validates an optional path when present', () => {
            expect(validate({ nickname: 'Al' }, { nickname: 'string?' }).valid).toBe(true);
        });

        it('rejects an optional path present with the wrong type', () => {
            const result = validate({ nickname: 42 }, { nickname: 'string?' });
            expect(result.valid).toBe(false);
            expect(result.errors[0]).toMatchObject({ path: 'nickname', expected: 'string?' });
        });
    });

    describe('type rules', () => {
        it('int rejects a float', () => {
            expect(validate({ n: 1.5 }, { n: 'int' }).valid).toBe(false);
        });

        it('float accepts an int', () => {
            expect(validate({ n: 5 }, { n: 'float' }).valid).toBe(true);
        });

        it('number is an alias of float', () => {
            expect(validate({ n: 1.5 }, { n: 'number' }).valid).toBe(true);
        });

        it('float rejects a non-finite number', () => {
            expect(validate({ n: Infinity }, { n: 'float' }).valid).toBe(false);
        });

        it('array rejects an object', () => {
            expect(validate({ x: {} }, { x: 'array' }).valid).toBe(false);
        });

        it('object rejects an array', () => {
            expect(validate({ x: [] }, { x: 'object' }).valid).toBe(false);
        });

        it('object rejects null', () => {
            expect(validate({ x: null }, { x: 'object' }).valid).toBe(false);
        });

        it('null accepts null', () => {
            expect(validate({ x: null }, { x: 'null' }).valid).toBe(true);
        });

        it('null rejects a non-null value', () => {
            expect(validate({ x: 0 }, { x: 'null' }).valid).toBe(false);
        });

        it('any accepts a non-null present value', () => {
            // A non-null value distinguishes the `any` branch from the `null` default.
            expect(validate({ x: 42 }, { x: 'any' }).valid).toBe(true);
        });

        it('any accepts null too', () => {
            expect(validate({ x: null }, { x: 'any' }).valid).toBe(true);
        });

        it('any still requires the path to be present', () => {
            expect(validate({}, { x: 'any' }).valid).toBe(false);
        });

        it('bool rejects a non-boolean value', () => {
            expect(validate({ x: 'true' }, { x: 'bool' }).valid).toBe(false);
        });

        it('string rejects a number', () => {
            expect(validate({ x: 5 }, { x: 'string' }).valid).toBe(false);
        });

        it('object rejects a primitive value', () => {
            expect(validate({ x: 5 }, { x: 'object' }).valid).toBe(false);
        });

        it('int rejects a non-number even if not an integer test', () => {
            expect(validate({ x: 'abc' }, { x: 'int' }).valid).toBe(false);
        });
    });

    describe('type names in errors', () => {
        it('labels a float value as float', () => {
            expect(validate({ n: 1.5 }, { n: 'int' }).errors[0]!.actual).toBe('float');
        });

        it('labels null as null', () => {
            expect(validate({ n: null }, { n: 'int' }).errors[0]!.actual).toBe('null');
        });

        it('labels an array as array', () => {
            expect(validate({ n: [] }, { n: 'int' }).errors[0]!.actual).toBe('array');
        });

        it('labels a boolean via typeof', () => {
            expect(validate({ n: true }, { n: 'int' }).errors[0]!.actual).toBe('boolean');
        });
    });

    it('validates nested dotted paths', () => {
        const result = validate(
            { db: { host: 'localhost', port: 5432 } },
            { 'db.host': 'string', 'db.port': 'int' },
        );
        expect(result.valid).toBe(true);
    });

    it('aggregates multiple failures', () => {
        const result = validate({ a: 1 }, { a: 'string', b: 'int' });
        expect(result.errors).toHaveLength(2);
    });

    it('throws on an unknown rule', () => {
        expect(() => validate({ x: 1 }, { x: 'integer' })).toThrow(AccessorException);
        expect(() => validate({ x: 1 }, { x: 'integer' })).toThrow(
            'Unknown schema rule "integer" for path "x".',
        );
    });

    it('throws on an unknown rule even with the optional suffix', () => {
        expect(() => validate({}, { x: 'wat?' })).toThrow(AccessorException);
    });
});
