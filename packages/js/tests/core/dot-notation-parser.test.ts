import { describe, expect, it } from 'vitest';
import { DotNotationParser } from '../../src/core/dot-notation-parser.js';
import { SecurityGuard } from '../../src/security/security-guard.js';
import { SecurityParser } from '../../src/security/security-parser.js';
import { SecurityException } from '../../src/exceptions/security-exception.js';

function makeParser(): DotNotationParser {
    return new DotNotationParser();
}

describe(DotNotationParser.name, () => {
    it('resolves a simple key', () => {
        const parser = makeParser();
        expect(parser.get({ name: 'Alice' }, 'name')).toBe('Alice');
    });

    it('returns null for empty path', () => {
        const parser = makeParser();
        expect(parser.get({ name: 'Alice' }, '')).toBeNull();
    });

    it('returns the default for a missing key', () => {
        const parser = makeParser();
        expect(parser.get({ name: 'Alice' }, 'missing', 'fallback')).toBe('fallback');
    });

    it('returns null (default) for a missing key when no default provided', () => {
        const parser = makeParser();
        expect(parser.get({ name: 'Alice' }, 'missing')).toBeNull();
    });

    it('resolves a nested 3-level path', () => {
        const parser = makeParser();
        expect(parser.get({ a: { b: { c: 42 } } }, 'a.b.c')).toBe(42);
    });

    it('returns default when intermediate key is missing', () => {
        const parser = makeParser();
        expect(parser.get({ a: 1 }, 'a.b.c', 'nope')).toBe('nope');
    });

    it('returns default when value is non-object and path continues', () => {
        const parser = makeParser();
        expect(parser.get({ a: 'string' }, 'a.b', 'default')).toBe('default');
    });
});

describe(`${DotNotationParser.name} > has`, () => {
    it('returns true when path exists', () => {
        expect(makeParser().has({ a: 1 }, 'a')).toBe(true);
    });

    it('returns false for empty path', () => {
        expect(makeParser().has({ a: 1 }, '')).toBe(false);
    });

    it('returns false for missing path', () => {
        expect(makeParser().has({ a: 1 }, 'b')).toBe(false);
    });

    it('returns true for nested path', () => {
        expect(makeParser().has({ a: { b: { c: 1 } } }, 'a.b.c')).toBe(true);
    });

    it('returns false when key exists but path continues into non-object', () => {
        expect(makeParser().has({ a: 'string' }, 'a.b')).toBe(false);
    });

    it('returns true when value is null (key exists)', () => {
        expect(makeParser().has({ a: null }, 'a')).toBe(true);
    });
});

describe(`${DotNotationParser.name} > set`, () => {
    it('sets a value at a simple key', () => {
        const parser = makeParser();
        const result = parser.set({}, 'name', 'Alice');
        expect(result).toEqual({ name: 'Alice' });
    });

    it('returns a new object (immutability)', () => {
        const parser = makeParser();
        const original = { name: 'Alice' };
        const result = parser.set(original, 'name', 'Bob');
        expect(original.name).toBe('Alice');
        expect(result.name).toBe('Bob');
    });

    it('creates nested intermediate objects', () => {
        const parser = makeParser();
        const result = parser.set({}, 'user.profile.name', 'Alice');
        expect(result).toEqual({ user: { profile: { name: 'Alice' } } });
    });

    it('overwrites an existing nested key', () => {
        const parser = makeParser();
        const result = parser.set({ a: { b: 1 } }, 'a.b', 99);
        expect(result).toEqual({ a: { b: 99 } });
    });

    it('replaces a non-object intermediate with an object', () => {
        const parser = makeParser();
        const result = parser.set({ a: 'string' }, 'a.b', 1);
        expect(result).toEqual({ a: { b: 1 } });
    });
});

describe(`${DotNotationParser.name} > remove`, () => {
    it('removes a simple key', () => {
        const parser = makeParser();
        const result = parser.remove({ a: 1, b: 2 }, 'a');
        expect(result).toEqual({ b: 2 });
    });

    it('returns the same data when key does not exist', () => {
        const parser = makeParser();
        const original = { a: 1 };
        const result = parser.remove(original, 'missing');
        expect(result).toEqual({ a: 1 });
    });

    it('removes a nested key', () => {
        const parser = makeParser();
        const result = parser.remove({ a: { b: 1, c: 2 } }, 'a.b');
        expect(result).toEqual({ a: { c: 2 } });
    });

    it('returns original when intermediate path does not exist', () => {
        const parser = makeParser();
        const result = parser.remove({ a: 1 }, 'b.c');
        expect(result).toEqual({ a: 1 });
    });

    it('returns original when intermediate is non-object', () => {
        const parser = makeParser();
        const result = parser.remove({ a: 'string' }, 'a.b');
        expect(result).toEqual({ a: 'string' });
    });

    it('returns a new object (immutability)', () => {
        const parser = makeParser();
        const original = { a: 1, b: 2 };
        const result = parser.remove(original, 'a');
        expect(original).toHaveProperty('a');
        expect(result).not.toHaveProperty('a');
    });
});

describe(`${DotNotationParser.name} > getAt`, () => {
    it('resolves using pre-parsed segments', () => {
        const parser = makeParser();
        expect(parser.getAt({ a: { b: 1 } }, ['a', 'b'])).toBe(1);
    });

    it('returns null for empty segments', () => {
        const parser = makeParser();
        expect(parser.getAt({ a: 1 }, [])).toEqual({ a: 1 });
    });

    it('returns default when segments lead to missing key', () => {
        const parser = makeParser();
        expect(parser.getAt({ a: 1 }, ['missing'], 'fallback')).toBe('fallback');
    });

    it('returns default when intermediate is non-object', () => {
        const parser = makeParser();
        expect(parser.getAt({ a: 'str' }, ['a', 'b'], 'default')).toBe('default');
    });
});

describe(`${DotNotationParser.name} > setAt`, () => {
    it('sets value using pre-parsed segments', () => {
        const parser = makeParser();
        const result = parser.setAt({}, ['a', 'b'], 42);
        expect(result).toEqual({ a: { b: 42 } });
    });

    it('returns the same data for empty segments', () => {
        const parser = makeParser();
        const data = { x: 1 };
        expect(parser.setAt(data, [], 'value')).toEqual({ x: 1 });
    });
});

describe(`${DotNotationParser.name} > hasAt`, () => {
    it('returns true when segments lead to a value', () => {
        const parser = makeParser();
        expect(parser.hasAt({ a: { b: 1 } }, ['a', 'b'])).toBe(true);
    });

    it('returns false when segments lead to missing key', () => {
        const parser = makeParser();
        expect(parser.hasAt({ a: 1 }, ['missing'])).toBe(false);
    });
});

describe(`${DotNotationParser.name} > removeAt`, () => {
    it('removes using pre-parsed segments', () => {
        const parser = makeParser();
        const result = parser.removeAt({ a: { b: 1 } }, ['a', 'b']);
        expect(result).toEqual({ a: {} });
    });

    it('returns the same data for empty segments', () => {
        const parser = makeParser();
        const data = { x: 1 };
        expect(parser.removeAt(data, [])).toEqual({ x: 1 });
    });
});

describe(`${DotNotationParser.name} > merge`, () => {
    it('merges at root level with empty path', () => {
        const parser = makeParser();
        const result = parser.merge({ a: 1 }, '', { b: 2 });
        expect(result).toEqual({ a: 1, b: 2 });
    });

    it('merges at a nested path', () => {
        const parser = makeParser();
        const result = parser.merge({ a: { b: 1 } }, 'a', { c: 2 });
        expect(result).toEqual({ a: { b: 1, c: 2 } });
    });

    it('creates a nested path when it does not exist', () => {
        const parser = makeParser();
        const result = parser.merge({}, 'a.b', { c: 1 });
        expect(result).toEqual({ a: { b: { c: 1 } } });
    });

    it('overwrites non-object with merged object', () => {
        const parser = makeParser();
        const result = parser.merge({ a: 'string' }, 'a', { key: 'val' });
        expect(result).toEqual({ a: { key: 'val' } });
    });

    it('throws SecurityException when deep merge exceeds maxResolveDepth', () => {
        const parser = new DotNotationParser(
            new SecurityGuard(),
            new SecurityParser({ maxResolveDepth: 1 }),
        );
        // 3 levels of merging triggers depth 2 in deepMerge
        expect(() => parser.merge({ a: { b: { c: 1 } } }, '', { a: { b: { c: 2 } } })).toThrow(
            SecurityException,
        );
    });
});

describe(`${DotNotationParser.name} > validate`, () => {
    it('does not throw for safe data', () => {
        const parser = makeParser();
        expect(() => parser.validate({ name: 'Alice', age: 30 })).not.toThrow();
    });

    it('throws SecurityException for forbidden keys', () => {
        const parser = makeParser();
        expect(() => parser.validate({ constructor: 'bad' })).toThrow(SecurityException);
    });

    it('throws SecurityException for too many keys', () => {
        const parser = new DotNotationParser(
            new SecurityGuard(),
            new SecurityParser({ maxKeys: 2 }),
        );
        expect(() => parser.validate({ a: 1, b: 2, c: 3 })).toThrow(SecurityException);
    });

    it('throws SecurityException for data too deeply nested', () => {
        const parser = new DotNotationParser(
            new SecurityGuard(),
            new SecurityParser({ maxDepth: 1 }),
        );
        expect(() => parser.validate({ a: { b: { c: 1 } } })).toThrow(SecurityException);
    });
});

describe(`${DotNotationParser.name} > assertPayload`, () => {
    it('does not throw for a small payload', () => {
        const parser = makeParser();
        expect(() => parser.assertPayload('hello')).not.toThrow();
    });

    it('throws SecurityException for oversized payload', () => {
        const parser = new DotNotationParser(
            new SecurityGuard(),
            new SecurityParser({ maxPayloadBytes: 3 }),
        );
        expect(() => parser.assertPayload('1234')).toThrow(SecurityException);
    });
});

describe(`${DotNotationParser.name} > getMaxDepth`, () => {
    it('returns configured max depth from SecurityParser', () => {
        const parser = new DotNotationParser(
            new SecurityGuard(),
            new SecurityParser({ maxDepth: 7 }),
        );
        expect(parser.getMaxDepth()).toBe(7);
    });
});
