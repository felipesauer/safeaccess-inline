import { describe, expect, it } from 'vitest';
import { Inline } from '../../src/inline.js';

// Wildcard resolution lives in the accessor's parser, so these exercise the
// full path (Inline.validate) rather than the standalone validator.

describe('schema wildcards', () => {
    const users = () =>
        Inline.fromJson('{"users":[{"email":"a@b.com"},{"email":"c@d.io"},{"email":"e@f.net"}]}');

    it('validates every expanded value', () => {
        expect(users().validate({ 'users.*.email': 'string|email' }).valid).toBe(true);
    });

    it('reports the first failing element with an expansion index', () => {
        const a = Inline.fromJson('{"users":[{"email":"a@b.com"},{"email":"bad"}]}');
        const r = a.validate({ 'users.*.email': 'string|email' });
        expect(r.valid).toBe(false);
        expect(r.errors[0]!.path).toBe('users.*.email.1');
        expect(r.errors[0]!.message).toBe('Path "users.*.email.1" must be a valid email.');
    });

    it('reports a type mismatch per element', () => {
        const a = Inline.fromJson('{"users":[{"age":30},{"age":"x"}]}');
        const r = a.validate({ 'users.*.age': 'int' });
        expect(r.errors[0]!.path).toBe('users.*.age.1');
        expect(r.errors[0]!.message).toContain('expected int, got string');
    });

    describe('absent element keys', () => {
        const mixed = () => Inline.fromJson('{"users":[{"email":"a@b.com"},{"name":"x"}]}');

        it('treats an absent key as a failure for a required rule', () => {
            const r = mixed().validate({ 'users.*.email': 'string' });
            expect(r.valid).toBe(false);
            expect(r.errors[0]!.path).toBe('users.*.email.1');
        });

        it('accepts an absent key for an optional rule', () => {
            expect(mixed().validate({ 'users.*.email': 'string?' }).valid).toBe(true);
        });
    });

    describe('constraints and each on expanded values', () => {
        it('applies a numeric constraint to each element', () => {
            const a = Inline.fromJson('{"items":[{"price":5},{"price":-2}]}');
            const r = a.validate({ 'items.*.price': 'int|min:0' });
            expect(r.errors[0]!.path).toBe('items.*.price.1');
            expect(r.errors[0]!.message).toBe('Path "items.*.price.1" must be >= 0, got -2.');
        });

        it('applies an each rule to each expanded array', () => {
            const a = Inline.fromJson('{"users":[{"roles":["a","b"]},{"roles":["c"]}]}');
            expect(a.validate({ 'users.*.roles': 'array|each:(string)' }).valid).toBe(true);
        });

        it('reports a nested each failure under the expanded element', () => {
            const a = Inline.fromJson('{"users":[{"roles":["a"]},{"roles":[42]}]}');
            const r = a.validate({ 'users.*.roles': 'array|each:(string)' });
            expect(r.errors[0]!.path).toBe('users.*.roles.1.0');
        });
    });

    describe('empty and absent collections', () => {
        it('passes for an empty collection', () => {
            expect(
                Inline.fromJson('{"users":[]}').validate({ 'users.*.email': 'string' }).valid,
            ).toBe(true);
        });

        it('passes when the base collection is absent', () => {
            expect(
                Inline.fromJson('{"other":1}').validate({ 'users.*.email': 'string' }).valid,
            ).toBe(true);
        });

        it('passes when the base is not a collection', () => {
            expect(
                Inline.fromJson('{"users":"scalar"}').validate({ 'users.*.email': 'string' }).valid,
            ).toBe(true);
        });
    });

    it('supports a trailing wildcard over a list of scalars', () => {
        const a = Inline.fromJson('{"tags":["x","y","z"]}');
        expect(a.validate({ 'tags.*': 'string' }).valid).toBe(true);
        const bad = Inline.fromJson('{"tags":["x",2]}');
        expect(bad.validate({ 'tags.*': 'string' }).errors[0]!.path).toBe('tags.*.1');
    });

    it('leaves concrete (wildcard-free) paths unchanged', () => {
        expect(users().validate({ 'users.0.email': 'string|email' }).valid).toBe(true);
        expect(users().validate({ 'users.99.email': 'string' }).valid).toBe(false);
    });

    it('works through assert() as well', () => {
        expect(() => users().assert({ 'users.*.email': 'string|email' })).not.toThrow();
    });
});
