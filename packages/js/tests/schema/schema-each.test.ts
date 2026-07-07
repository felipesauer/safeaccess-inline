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

describe('SchemaValidator each', () => {
    describe('shortcut form', () => {
        it('accepts an array of the item type', () => {
            expect(validate({ t: [1, 2, 3] }, { t: 'array|each:int' }).valid).toBe(true);
        });

        it('reports the first failing item with an indexed path', () => {
            const r = validate({ t: [1, 'x', 3] }, { t: 'array|each:int' });
            expect(r.valid).toBe(false);
            expect(r.errors[0]!.path).toBe('t.1');
            expect(r.errors[0]!.message).toBe('Path "t.1" expected int, got string.');
        });

        it('reports the correct index for a later failure', () => {
            const r = validate({ t: [1, 2, 'x'] }, { t: 'array|each:int' });
            expect(r.errors[0]!.path).toBe('t.2');
        });
    });

    describe('parenthesised form', () => {
        it('validates a compound item rule', () => {
            expect(
                validate({ e: ['a@b.com', 'c@d.io'] }, { e: 'array|each:(string|email)' }).valid,
            ).toBe(true);
        });

        it('reports a failing compound item', () => {
            const r = validate({ e: ['a@b.com', 'nope'] }, { e: 'array|each:(string|email)' });
            expect(r.errors[0]!.path).toBe('e.1');
            expect(r.errors[0]!.message).toBe('Path "e.1" must be a valid email.');
        });

        it('combines array constraints with a per-item rule', () => {
            expect(validate({ s: [1, 2] }, { s: 'array|min:1|each:(int|min:0)' }).valid).toBe(true);
        });

        it('reports an item that fails its own constraint', () => {
            const r = validate({ s: [1, -5] }, { s: 'array|min:1|each:(int|min:0)' });
            expect(r.errors[0]!.message).toBe('Path "s.1" must be >= 0, got -5.');
        });

        it('honours each before other constraints regardless of order', () => {
            expect(validate({ s: [1, 2, 3] }, { s: 'array|each:(int)|max:5' }).valid).toBe(true);
        });

        it('supports the shortcut form followed by another constraint', () => {
            expect(validate({ s: [1, 2, 3] }, { s: 'array|each:int|max:5' }).valid).toBe(true);
            expect(validate({ s: [1, 2, 3, 4] }, { s: 'array|each:int|max:3' }).valid).toBe(false);
        });
    });

    describe('nesting', () => {
        it('validates an array of arrays', () => {
            expect(
                validate({ m: [[1], [2, 3]] }, { m: 'array|each:(array|each:(int))' }).valid,
            ).toBe(true);
        });

        it('reports a nested item with a fully-qualified path', () => {
            const r = validate({ m: [[1], ['x']] }, { m: 'array|each:(array|each:(int))' });
            expect(r.errors[0]!.path).toBe('m.1.0');
        });
    });

    describe('edge cases', () => {
        it('accepts an empty array', () => {
            expect(validate({ t: [] }, { t: 'array|each:int' }).valid).toBe(true);
        });

        it('still requires the base type to be array', () => {
            const r = validate({ t: 'nope' }, { t: 'array|each:int' });
            expect(r.errors[0]!.message).toContain('expected array, got string');
        });

        it('treats each on a non-array value as a data error', () => {
            const r = validate({ s: 'hello' }, { s: 'any|each:(int)' });
            expect(r.valid).toBe(false);
            expect(r.errors[0]!.message).toBe('Path "s" each constraint requires an array.');
        });

        it('applies each to a present optional array', () => {
            expect(validate({ t: [1, 'x'] }, { t: 'array|each:int?' }).valid).toBe(false);
        });

        it('skips each on an absent optional path', () => {
            expect(validate({}, { t: 'array|each:int?' }).valid).toBe(true);
        });
    });

    describe('schema (programming) errors', () => {
        it('throws on unbalanced parentheses', () => {
            expect(() => validate({ t: [] }, { t: 'array|each:(int' })).toThrow(AccessorException);
            expect(() => validate({ t: [] }, { t: 'array|each:(int' })).toThrow(
                /unbalanced parentheses/,
            );
        });

        it('throws on an unknown item type', () => {
            expect(() => validate({ t: [] }, { t: 'array|each:(nope)' })).toThrow(
                /Unknown schema rule "nope"/,
            );
        });

        it('throws on an unknown constraint inside the item rule', () => {
            expect(() => validate({ t: [] }, { t: 'array|each:(int|wat:1)' })).toThrow(
                /Unknown schema constraint "wat"/,
            );
        });
    });
});
