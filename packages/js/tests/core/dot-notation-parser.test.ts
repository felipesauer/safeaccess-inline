import { describe, expect, it } from 'vitest';
import { DotNotationParser } from '../../src/core/dot-notation-parser.js';
import { SecurityGuard } from '../../src/security/security-guard.js';
import { SecurityParser } from '../../src/security/security-parser.js';
import { SecurityException } from '../../src/exceptions/security-exception.js';
import { FakePathCache } from '../mocks/fake-path-cache.js';

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

describe(`${DotNotationParser.name} > pathCache integration`, () => {
    it('stores parsed segments in the cache on first access', () => {
        const cache = new FakePathCache();
        const parser = new DotNotationParser(new SecurityGuard(), new SecurityParser(), cache);
        parser.get({ a: { b: 1 } }, 'a.b');
        expect(cache.store.has('a.b')).toBe(true);
        expect(cache.store.get('a.b')).toEqual(['a', 'b']);
    });

    it('reads from the cache on subsequent calls without re-parsing', () => {
        const cache = new FakePathCache();
        const parser = new DotNotationParser(new SecurityGuard(), new SecurityParser(), cache);
        parser.get({ a: { b: 1 } }, 'a.b');
        const getCountAfterFirst = cache.getCallCount;
        parser.get({ a: { b: 1 } }, 'a.b');
        // Second call should hit the cache (getCallCount increases, setCallCount stays the same)
        expect(cache.setCallCount).toBe(1);
        expect(cache.getCallCount).toBeGreaterThan(getCountAfterFirst);
    });

    it('returns the correct value when cache is used', () => {
        const cache = new FakePathCache();
        const parser = new DotNotationParser(new SecurityGuard(), new SecurityParser(), cache);
        expect(parser.get({ a: { b: 42 } }, 'a.b')).toBe(42);
        expect(parser.get({ a: { b: 42 } }, 'a.b')).toBe(42);
    });

    it('works without a cache (undefined)', () => {
        const parser = new DotNotationParser(new SecurityGuard(), new SecurityParser());
        expect(parser.get({ a: { b: 1 } }, 'a.b')).toBe(1);
    });
});

// Additional branch-coverage tests (targeting Stryker survivors)

describe(`${DotNotationParser.name} > get empty path branch`, () => {
    // Kills lines 50:13/22/26 — `path === ''` condition in get()
    it('returns defaultValue (not null) for empty path', () => {
        const parser = makeParser();
        expect(parser.get({ a: 1 }, '', 'custom_default')).toBe('custom_default');
    });

    it('returns null when empty path and no default', () => {
        const parser = makeParser();
        expect(parser.get({ a: 1 }, '')).toBeNull();
    });
});

describe(`${DotNotationParser.name} > has empty path branch`, () => {
    // Kills lines 86:13/22/26 — `path === ''` condition in has()
    it('returns false for empty path (not "has everything")', () => {
        const parser = makeParser();
        // If the condition were removed, sentinel lookup would always find the data itself → true
        expect(parser.has({ a: 1 }, '')).toBe(false);
    });
});

describe(`${DotNotationParser.name} > getAt branch conditions`, () => {
    // Kills lines 128/129 — conditions inside getAt loop
    it('returns defaultValue when current is null mid-path', () => {
        const parser = makeParser();
        expect(parser.getAt({ a: null }, ['a', 'b'], 'default')).toBe('default');
    });

    it('returns defaultValue when key does not exist as own property', () => {
        const parser = makeParser();
        const data = Object.create({ inherited: true }) as Record<string, unknown>;
        expect(parser.getAt(data, ['inherited'], 'fallback')).toBe('fallback');
    });

    it('returns value when key is a direct own property', () => {
        const parser = makeParser();
        expect(parser.getAt({ key: 'value' }, ['key'])).toBe('value');
    });
});

describe(`${DotNotationParser.name} > removeAt empty segments`, () => {
    // Kills line 189:36/13 — `segments.length === 0` early return
    it('returns original data for empty segments', () => {
        const parser = makeParser();
        const data = { a: 1 };
        expect(parser.removeAt(data, [])).toBe(data);
    });

    it('returns a different object when segments are non-empty', () => {
        const parser = makeParser();
        const data = { a: 1, b: 2 };
        const result = parser.removeAt(data, ['a']);
        expect(result).not.toBe(data);
        expect(result).toEqual({ b: 2 });
    });
});

describe(`${DotNotationParser.name} > merge existing is non-object`, () => {
    // Kills line 214:45 — typeof existing === 'object' check in merge()
    it('merges into empty object when existing path value is a primitive', () => {
        const parser = makeParser();
        // 'a' is a string (primitive), not an object — should merge into {}
        const result = parser.merge({ a: 'string' }, 'a', { key: 'val' });
        expect(result).toEqual({ a: { key: 'val' } });
    });

    it('merges into empty object when existing path value is null', () => {
        const parser = makeParser();
        const result = parser.merge({ a: null }, 'a', { key: 'val' });
        expect(result).toEqual({ a: { key: 'val' } });
    });
});

describe(`${DotNotationParser.name} > eraseAt hasOwnProperty check`, () => {
    // Kills line 281:22 — hasOwnProperty check in eraseAt
    it('does not remove inherited (non-own) properties via prototype chain', () => {
        const parser = makeParser();
        const proto = { inherited: 1 };
        const data = Object.create(proto) as Record<string, unknown>;
        data['own'] = 2;
        const result = parser.removeAt(data, ['inherited']);
        // 'inherited' is not an own property so eraseAt returns data unchanged
        expect(Object.prototype.hasOwnProperty.call(result, 'inherited')).toBe(false);
        expect(result['own']).toBe(2);
    });
});

describe(`${DotNotationParser.name} > eraseAt child null/non-object`, () => {
    // Kills lines 290:13/30/42/60 — `typeof child !== 'object' || child === null`
    it('returns copy unchanged when intermediate child is null', () => {
        const parser = makeParser();
        const data = { a: null };
        const result = parser.removeAt(data as Record<string, unknown>, ['a', 'b']);
        expect(result).toEqual({ a: null });
    });

    it('returns copy unchanged when intermediate child is a number', () => {
        const parser = makeParser();
        const result = parser.removeAt({ a: 42 }, ['a', 'b']);
        expect(result).toEqual({ a: 42 });
    });

    it('returns copy unchanged when intermediate child is a string', () => {
        const parser = makeParser();
        const result = parser.removeAt({ a: 'text' }, ['a', 'b']);
        expect(result).toEqual({ a: 'text' });
    });
});

describe(`${DotNotationParser.name} > writeAt single segment`, () => {
    // Kills lines 305:63/13 — `index === segments.length - 1` check (terminal condition)
    it('sets value at a single-segment path correctly', () => {
        const parser = makeParser();
        const result = parser.setAt({}, ['key'], 'value');
        expect(result).toEqual({ key: 'value' });
    });

    it('sets value at a single-segment path, overwriting existing', () => {
        const parser = makeParser();
        const result = parser.setAt({ key: 'old' }, ['key'], 'new');
        expect(result).toEqual({ key: 'new' });
    });
});

describe(`${DotNotationParser.name} > writeAt child handling`, () => {
    // Kills lines 317:13/42/58 — typeof child === 'object' check in writeAt
    it('creates nested object when child is null', () => {
        const parser = makeParser();
        const result = parser.setAt({ a: null }, ['a', 'b'], 1);
        expect(result).toEqual({ a: { b: 1 } });
    });

    it('creates nested object when child is a primitive', () => {
        const parser = makeParser();
        const result = parser.setAt({ a: 42 }, ['a', 'b'], 1);
        expect(result).toEqual({ a: { b: 1 } });
    });

    it('creates nested object when child is an array', () => {
        const parser = makeParser();
        const result = parser.setAt({ a: [1, 2] }, ['a', 'b'], 1);
        expect(result).toEqual({ a: { b: 1 } });
    });

    it('preserves existing nested object when overwriting a key', () => {
        const parser = makeParser();
        const result = parser.setAt({ a: { x: 1, y: 2 } }, ['a', 'z'], 3);
        expect(result).toEqual({ a: { x: 1, y: 2, z: 3 } });
    });
});

describe(`${DotNotationParser.name} > write-path forbidden key validation`, () => {
    it('throws SecurityException when setting a forbidden key via set', () => {
        const parser = makeParser();
        expect(() => parser.set({}, 'constructor', 'bad')).toThrow(SecurityException);
    });

    it('throws SecurityException when setting a nested forbidden key via set', () => {
        const parser = makeParser();
        expect(() => parser.set({}, 'prototype.nested', 'bad')).toThrow(SecurityException);
    });

    it('throws SecurityException when removing a forbidden key via remove', () => {
        const parser = makeParser();
        expect(() => parser.remove({ safe: 1 }, 'constructor')).toThrow(SecurityException);
    });

    it('throws SecurityException when setting a forbidden key via setAt', () => {
        const parser = makeParser();
        expect(() => parser.setAt({}, ['__proto__'], 'bad')).toThrow(SecurityException);
    });

    it('throws SecurityException when removing a forbidden key via removeAt', () => {
        const parser = makeParser();
        expect(() => parser.removeAt({ safe: 1 }, ['constructor'])).toThrow(SecurityException);
    });

    it('throws SecurityException when merge source contains a forbidden key', () => {
        const parser = makeParser();
        expect(() => parser.merge({}, '', { hasOwnProperty: 'bad' })).toThrow(SecurityException);
    });

    it('throws SecurityException when merge source contains a nested forbidden key', () => {
        const parser = makeParser();
        expect(() => parser.merge({ user: { name: 'Alice' } }, '', { user: { prototype: 'bad' } as Record<string, unknown> })).toThrow(SecurityException);
    });

    it('allows safe keys through write-path operations', () => {
        const parser = makeParser();
        expect(parser.set({}, 'username', 'Alice')).toEqual({ username: 'Alice' });
        expect(parser.remove({ username: 'Alice' }, 'username')).toEqual({});
        expect(parser.merge({}, '', { name: 'Bob' })).toEqual({ name: 'Bob' });
    });

    it('write-path error message contains the forbidden key name', () => {
        const parser = makeParser();
        expect(() => parser.set({}, 'hasOwnProperty', 'bad')).toThrow("Forbidden key 'hasOwnProperty' detected.");
    });

    it('throws SecurityException for prototype pollution key via set', () => {
        const parser = makeParser();
        expect(() => parser.set({}, 'prototype', 'bad')).toThrow(SecurityException);
    });
});

describe(`${DotNotationParser.name} > deepMerge branch conditions`, () => {
    it('recursively merges when both target and source values are objects', () => {
        const parser = makeParser();
        const result = parser.merge({ a: { x: 1 } }, 'a', { y: 2 });
        expect(result).toEqual({ a: { x: 1, y: 2 } });
    });

    it('overwrites when source value is null (not an object)', () => {
        const parser = makeParser();
        const result = parser.merge({ a: { x: 1 } }, 'a', { x: null as unknown as Record<string, unknown> });
        expect((result['a'] as Record<string, unknown>)['x']).toBeNull();
    });

    it('overwrites when source value is an array (not a plain object)', () => {
        const parser = makeParser();
        const result = parser.merge({ a: { x: 1 } }, '', { a: [1, 2, 3] as unknown as Record<string, unknown> });
        expect(result['a']).toEqual([1, 2, 3]);
    });

    it('overwrites when target value is null (not an object) and source is an object', () => {
        const parser = makeParser();
        const result = parser.merge({ a: null }, '', { a: { key: 'val' } as Record<string, unknown> });
        expect(result['a']).toEqual({ key: 'val' });
    });

    it('overwrites when target value is an array and source is an object', () => {
        const parser = makeParser();
        const result = parser.merge({ a: [1, 2] }, '', { a: { key: 'val' } as unknown as Record<string, unknown> });
        expect(result['a']).toEqual({ key: 'val' });
    });
});

describe(`${DotNotationParser.name} > getMaxKeys`, () => {
    it('returns the max key count from the configured SecurityParser', () => {
        const parser = new DotNotationParser(
            new SecurityGuard(),
            new SecurityParser({ maxKeys: 42 }),
        );
        expect(parser.getMaxKeys()).toBe(42);
    });

    it('returns the default max key count when not overridden', () => {
        expect(makeParser().getMaxKeys()).toBe(10_000);
    });
});
