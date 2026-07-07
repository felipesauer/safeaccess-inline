import { describe, expect, it } from 'vitest';
import { Inline } from '../../src/inline.js';
import { SchemaValidationException } from '../../src/exceptions/schema-validation-exception.js';
import { AccessorException } from '../../src/exceptions/accessor-exception.js';

const sample = () =>
    Inline.fromJson('{"db":{"host":"localhost","port":5432,"ssl":true},"tags":["x","y"]}');

describe('AbstractAccessor > validate', () => {
    it('returns a valid result when the data matches', () => {
        const result = sample().validate({
            'db.host': 'string',
            'db.port': 'int',
            'db.ssl': 'bool',
            tags: 'array',
        });
        expect(result.valid).toBe(true);
        expect(result.errors).toEqual([]);
    });

    it('reports a missing required path', () => {
        const result = sample().validate({ 'db.password': 'string' });
        expect(result.valid).toBe(false);
        expect(result.errors[0]).toMatchObject({ path: 'db.password', actual: 'missing' });
    });

    it('allows an absent optional path', () => {
        expect(sample().validate({ 'db.password': 'string?' }).valid).toBe(true);
    });

    it('reports a type mismatch with a descriptive message', () => {
        const result = sample().validate({ 'db.port': 'string' });
        expect(result.errors[0]!.message).toBe('Path "db.port" expected string, got int.');
    });

    it('throws AccessorException on an unknown rule', () => {
        expect(() => sample().validate({ 'db.host': 'text' })).toThrow(AccessorException);
    });

    it('groups failures by path via errorsByPath', () => {
        const result = sample().validate({ 'db.port': 'string', 'db.name': 'string' });
        expect(result.errorsByPath()).toEqual({
            'db.port': ['Path "db.port" expected string, got int.'],
            'db.name': ['Missing required path "db.name" (expected string).'],
        });
    });
});

describe('AbstractAccessor > assert', () => {
    it('returns the same accessor when valid, allowing chaining', () => {
        const accessor = sample();
        const returned = accessor.assert({ 'db.host': 'string' });
        expect(returned).toBe(accessor);
        expect(returned.get('db.host')).toBe('localhost');
    });

    it('throws SchemaValidationException carrying all errors', () => {
        try {
            sample().assert({ 'db.port': 'string', missing: 'int' });
            expect.fail('expected SchemaValidationException');
        } catch (e) {
            expect(e).toBeInstanceOf(SchemaValidationException);
            const ex = e as SchemaValidationException;
            expect(ex.errors).toHaveLength(2);
            expect(ex.message).toContain('Schema validation failed:');
        }
    });

    it('does not throw for a valid schema', () => {
        expect(() => sample().assert({ 'db.port': 'int' })).not.toThrow();
    });
});

describe('schema validation across formats', () => {
    it('treats CSV values as strings (int rule fails, string passes)', () => {
        const csv = Inline.fromCsv('port\n8000');
        expect(csv.validate({ '0.port': 'int' }).valid).toBe(false);
        expect(csv.validate({ '0.port': 'string' }).valid).toBe(true);
    });

    it('validates coerced TOML scalars by their parsed type', () => {
        const toml = Inline.fromToml('[db]\nport = 5432\nssl = true');
        expect(toml.validate({ 'db.port': 'int', 'db.ssl': 'bool' }).valid).toBe(true);
    });
});
