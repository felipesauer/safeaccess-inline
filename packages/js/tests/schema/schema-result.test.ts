import { describe, expect, it } from 'vitest';
import { SchemaResult, type SchemaError } from '../../src/schema/schema-result.js';

function error(path: string, message: string): SchemaError {
    return { path, expected: 'string', actual: 'int', message };
}

describe(SchemaResult.name, () => {
    it('is valid with no failures', () => {
        const result = new SchemaResult([]);
        expect(result.valid).toBe(true);
        expect(result.errors).toEqual([]);
        expect(result.errorsByPath()).toEqual({});
    });

    it('is invalid with failures and exposes a copy of the list', () => {
        const failures = [error('a', 'msg a')];
        const result = new SchemaResult(failures);
        expect(result.valid).toBe(false);
        expect(result.errors).toEqual(failures);
        expect(result.errors).not.toBe(failures);
    });

    describe('errorsByPath', () => {
        it('groups a single message under its path', () => {
            const result = new SchemaResult([error('user.email', 'bad email')]);
            expect(result.errorsByPath()).toEqual({ 'user.email': ['bad email'] });
        });

        it('groups multiple paths in first-seen order', () => {
            const result = new SchemaResult([error('email', 'bad email'), error('age', 'bad age')]);
            expect(result.errorsByPath()).toEqual({
                email: ['bad email'],
                age: ['bad age'],
            });
            expect(Object.keys(result.errorsByPath())).toEqual(['email', 'age']);
        });

        it('collects multiple messages under the same path', () => {
            const result = new SchemaResult([
                error('field', 'first problem'),
                error('field', 'second problem'),
            ]);
            expect(result.errorsByPath()).toEqual({
                field: ['first problem', 'second problem'],
            });
        });
    });
});
