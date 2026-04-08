import { describe, expect, it } from 'vitest';
import { DotNotationParser } from '../../src/core/dot-notation-parser.js';
import { SecurityGuard } from '../../src/security/security-guard.js';
import { SecurityParser } from '../../src/security/security-parser.js';
import { SecurityException } from '../../src/exceptions/security-exception.js';
import { PathNotFoundException } from '../../src/exceptions/path-not-found-exception.js';
import { FakePathCache } from '../mocks/fake-path-cache.js';

function makeParser(): DotNotationParser {
    return new DotNotationParser();
}

describe(`${DotNotationParser.name} > pathCache integration`, () => {
    it('stores parsed segments in the cache on first access', () => {
        const cache = new FakePathCache();
        const parser = new DotNotationParser(new SecurityGuard(), new SecurityParser(), cache);
        parser.get({ a: { b: 1 } }, 'a.b');
        expect(cache.store.has('a.b')).toBe(true);
        expect(cache.store.get('a.b')).toEqual([
            { type: 'key', value: 'a' },
            { type: 'key', value: 'b' },
        ]);
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
    // Kills lines 50:13/22/26 - `path === ''` condition in get()
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
    // Kills lines 86:13/22/26 - `path === ''` condition in has()
    it('returns false for empty path (not "has everything")', () => {
        const parser = makeParser();
        // If the condition were removed, sentinel lookup would always find the data itself → true
        expect(parser.has({ a: 1 }, '')).toBe(false);
    });
});

describe(`${DotNotationParser.name} > getAt branch conditions`, () => {
    // Kills lines 128/129 - conditions inside getAt loop
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
    // Kills line 189:36/13 - `segments.length === 0` early return
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
    // Kills line 214:45 - typeof existing === 'object' check in merge()
    it('merges into empty object when existing path value is a primitive', () => {
        const parser = makeParser();
        // 'a' is a string (primitive), not an object - should merge into {}
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
    // Kills line 281:22 - hasOwnProperty check in eraseAt
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
    // Kills lines 290:13/30/42/60 - `typeof child !== 'object' || child === null`
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
    // Kills lines 305:63/13 - `index === segments.length - 1` check (terminal condition)
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
    // Kills lines 317:13/42/58 - typeof child === 'object' check in writeAt
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
        expect(() =>
            parser.merge({ user: { name: 'Alice' } }, '', {
                user: { prototype: 'bad' } as Record<string, unknown>,
            }),
        ).toThrow(SecurityException);
    });

    it('allows safe keys through write-path operations', () => {
        const parser = makeParser();
        expect(parser.set({}, 'username', 'Alice')).toEqual({ username: 'Alice' });
        expect(parser.remove({ username: 'Alice' }, 'username')).toEqual({});
        expect(parser.merge({}, '', { name: 'Bob' })).toEqual({ name: 'Bob' });
    });

    it('write-path error message contains the forbidden key name', () => {
        const parser = makeParser();
        expect(() => parser.set({}, 'hasOwnProperty', 'bad')).toThrow(
            "Forbidden key 'hasOwnProperty' detected.",
        );
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
        const result = parser.merge({ a: { x: 1 } }, 'a', {
            x: null as unknown as Record<string, unknown>,
        });
        expect((result['a'] as Record<string, unknown>)['x']).toBeNull();
    });

    it('overwrites when source value is an array (not a plain object)', () => {
        const parser = makeParser();
        const result = parser.merge({ a: { x: 1 } }, '', {
            a: [1, 2, 3] as unknown as Record<string, unknown>,
        });
        expect(result['a']).toEqual([1, 2, 3]);
    });

    it('overwrites when target value is null (not an object) and source is an object', () => {
        const parser = makeParser();
        const result = parser.merge({ a: null }, '', {
            a: { key: 'val' } as Record<string, unknown>,
        });
        expect(result['a']).toEqual({ key: 'val' });
    });

    it('overwrites when target value is an array and source is an object', () => {
        const parser = makeParser();
        const result = parser.merge({ a: [1, 2] }, '', {
            a: { key: 'val' } as unknown as Record<string, unknown>,
        });
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

describe(`${DotNotationParser.name} > getStrict`, () => {
    it('returns the value when the path exists', () => {
        const parser = makeParser();

        expect(parser.getStrict({ name: 'Alice' }, 'name')).toBe('Alice');
    });

    it('throws PathNotFoundException when the path does not exist', () => {
        const parser = makeParser();

        expect(() => parser.getStrict({ name: 'Alice' }, 'missing')).toThrow(PathNotFoundException);
    });

    it('throws PathNotFoundException with a message containing the path', () => {
        const parser = makeParser();

        try {
            parser.getStrict({ name: 'Alice' }, 'missing.path');
            expect.fail('Should have thrown');
        } catch (e) {
            expect((e as Error).message).not.toBe('');
            expect((e as Error).message).toContain('missing.path');
        }
    });
});

describe(`${DotNotationParser.name} > resolve maxResolveDepth enforcement`, () => {
    it('throws SecurityException when resolve depth exceeds maxResolveDepth', () => {
        const parser = new DotNotationParser(
            new SecurityGuard(),
            new SecurityParser({ maxResolveDepth: 2 }),
        );

        expect(() => parser.get({ a: { b: { c: 1 } } }, 'a.b.c')).toThrow(SecurityException);
    });

    it('resolves path within maxResolveDepth limit', () => {
        const parser = new DotNotationParser(
            new SecurityGuard(),
            new SecurityParser({ maxResolveDepth: 5 }),
        );

        expect(parser.get({ a: { b: 1 } }, 'a.b')).toBe(1);
    });

    it('uses maxResolveDepth, not maxDepth, for path resolution depth limit', () => {
        const parser = new DotNotationParser(
            new SecurityGuard(),
            new SecurityParser({ maxDepth: 100, maxResolveDepth: 2 }),
        );

        expect(() => parser.get({ a: { b: { c: 1 } } }, 'a.b.c')).toThrow(SecurityException);
    });

    it('does not throw at exact maxResolveDepth boundary', () => {
        const parser = new DotNotationParser(
            new SecurityGuard(),
            new SecurityParser({ maxResolveDepth: 3 }),
        );

        expect(parser.get({ a: { b: { c: 1 } } }, 'a.b.c')).toBe(1);
    });

    it('throws when resolve depth is one above maxResolveDepth', () => {
        const parser = new DotNotationParser(
            new SecurityGuard(),
            new SecurityParser({ maxResolveDepth: 3 }),
        );

        expect(() => parser.get({ a: { b: { c: { d: 1 } } } }, 'a.b.c.d')).toThrow(
            SecurityException,
        );
    });

    it('exception message contains the depth value when resolve depth exceeded', () => {
        const parser = new DotNotationParser(
            new SecurityGuard(),
            new SecurityParser({ maxResolveDepth: 2 }),
        );

        try {
            parser.get({ a: { b: { c: 1 } } }, 'a.b.c');
            expect.fail('Should have thrown');
        } catch (e) {
            expect((e as Error).message).toContain('3');
            expect((e as Error).message).toContain('2');
        }
    });

    it('get enforces maxResolveDepth on nested path resolution', () => {
        const parser = new DotNotationParser(
            new SecurityGuard(),
            new SecurityParser({ maxResolveDepth: 1 }),
        );

        expect(parser.get({ a: 1 }, 'a')).toBe(1);
        expect(() => parser.get({ a: { b: 1 } }, 'a.b')).toThrow(SecurityException);
    });
});
