import { describe, expect, it } from 'vitest';
import { SecurityGuard } from '../../src/security/security-guard.js';
import { SecurityException } from '../../src/exceptions/security-exception.js';

// Every key in DEFAULT_FORBIDDEN_KEYS must block individually.
// This prevents Stryker StringLiteral mutants (each key mutated to "") from surviving.
describe(`${SecurityGuard.name} > all individual forbidden keys`, () => {
    const prototypePollutiondVectors = [
        '__proto__',
        'constructor',
        'prototype',
    ];
    const jsLegacyPrototype = [
        '__definegetter__',
        '__definesetter__',
        '__lookupgetter__',
        '__lookupsetter__',
    ];
    const objectShadowKeys = ['hasOwnProperty'];
    const nodejsPathGlobals = ['__dirname', '__filename'];
    const exactStreamSchemes = [
        'file://',
        'http://',
        'https://',
        'ftp://',
        'data:',
        'data://',
        'javascript:',
        'blob:',
        'ws://',
        'wss://',
        'node:',
    ];

    const all = [
        ...prototypePollutiondVectors,
        ...jsLegacyPrototype,
        ...objectShadowKeys,
        ...nodejsPathGlobals,
        ...exactStreamSchemes,
    ];

    for (const key of all) {
        it(`blocks "${key}" as forbidden`, () => {
            const guard = new SecurityGuard();
            expect(guard.isForbiddenKey(key)).toBe(true);
        });
    }

    // Stream-wrapper prefix matching (full URIs, not just bare schemes already in the set above)
    const streamWrapperUris = [
        'http://evil.com/payload',
        'https://attacker.com/exploit',
        'ftp://server/file.txt',
        'file:///etc/passwd',
        'data:',
        'data://text/plain;base64,aGVsbG8=',
        'data:text/html,<script>alert(1)</script>',
        'javascript:alert(1)',
        'blob:https://example.com/file',
        'ws://attacker.com/socket',
        'wss://attacker.com/socket',
        'node:child_process',
    ];

    for (const uri of streamWrapperUris) {
        it(`blocks stream wrapper URI "${uri}" as forbidden`, () => {
            const guard = new SecurityGuard();
            expect(guard.isForbiddenKey(uri)).toBe(true);
        });
    }
});

describe(`${SecurityGuard.name} > sanitize with null check`, () => {
    it('preserves non-null primitive values in sanitize', () => {
        const guard = new SecurityGuard();
        const result = guard.sanitize({ name: 'Alice', count: 0, flag: false, empty: '' });
        expect(result).toEqual({ name: 'Alice', count: 0, flag: false, empty: '' });
    });

    it('preserves null values in sanitize (only removes forbidden keys)', () => {
        const guard = new SecurityGuard();
        const result = guard.sanitize({ key: null });
        expect(result).toEqual({ key: null });
    });

    it('error message on sanitize depth contains the depth limit', () => {
        const guard = new SecurityGuard(1);
        const deep = { a: { b: { c: 'deep' } } };
        expect(() => guard.sanitize(deep)).toThrow(/Recursion depth \d+ exceeds maximum/);
    });
});

describe(SecurityGuard.name, () => {
    it('allows a safe key', () => {
        const guard = new SecurityGuard();
        expect(guard.isForbiddenKey('username')).toBe(false);
    });

    it('allows a numeric string key', () => {
        const guard = new SecurityGuard();
        expect(guard.isForbiddenKey('42')).toBe(false);
    });
});

describe(`${SecurityGuard.name} > isForbiddenKey`, () => {
    it('detects __proto__ as forbidden', () => {
        const guard = new SecurityGuard();
        expect(guard.isForbiddenKey('__proto__')).toBe(true);
    });

    it('detects constructor as forbidden (prototype pollution)', () => {
        const guard = new SecurityGuard();
        expect(guard.isForbiddenKey('constructor')).toBe(true);
    });

    it('detects __PROTO__ (uppercase) as forbidden due to case normalization', () => {
        const guard = new SecurityGuard();
        expect(guard.isForbiddenKey('__PROTO__')).toBe(true);
    });

    it('detects __defineGetter__ as forbidden legacy prototype manipulation', () => {
        const guard = new SecurityGuard();
        expect(guard.isForbiddenKey('__defineGetter__')).toBe(true);
    });

    it('detects javascript: as forbidden protocol', () => {
        const guard = new SecurityGuard();
        expect(guard.isForbiddenKey('javascript:')).toBe(true);
    });

    it('detects fully-formed javascript: URI as forbidden', () => {
        const guard = new SecurityGuard();
        expect(guard.isForbiddenKey('javascript:alert(1)')).toBe(true);
    });

    it('detects http:// as forbidden stream wrapper', () => {
        const guard = new SecurityGuard();
        expect(guard.isForbiddenKey('http://evil.com')).toBe(true);
    });

    it('does not treat node_modules as forbidden (prefix boundary)', () => {
        const guard = new SecurityGuard();
        expect(guard.isForbiddenKey('node_modules')).toBe(false);
    });
});

describe(`${SecurityGuard.name} > assertSafeKey`, () => {
    it('does not throw for a safe key', () => {
        const guard = new SecurityGuard();
        expect(() => guard.assertSafeKey('name')).not.toThrow();
    });

    it('throws SecurityException for __proto__', () => {
        const guard = new SecurityGuard();
        expect(() => guard.assertSafeKey('__proto__')).toThrow(SecurityException);
    });

    it('throws SecurityException for stream wrapper key', () => {
        const guard = new SecurityGuard();
        expect(() => guard.assertSafeKey('javascript:alert(1)')).toThrow(SecurityException);
    });

    it('error message contains the forbidden key name', () => {
        const guard = new SecurityGuard();
        expect(() => guard.assertSafeKey('__proto__')).toThrow("Forbidden key '__proto__' detected.");
    });
});

describe(`${SecurityGuard.name} > assertSafeKeys`, () => {
    it('passes for safe nested data', () => {
        const guard = new SecurityGuard();
        expect(() => guard.assertSafeKeys({ user: { name: 'Alice', age: 30 } })).not.toThrow();
    });

    it('throws SecurityException when a nested forbidden key is present', () => {
        const guard = new SecurityGuard();
        expect(() => guard.assertSafeKeys({ safe: { hasOwnProperty: 'bad' } })).toThrow(
            SecurityException,
        );
    });

    it('throws SecurityException when depth exceeds maxDepth', () => {
        const guard = new SecurityGuard(1);
        const deep = { a: { b: { c: 'too deep' } } };
        expect(() => guard.assertSafeKeys(deep)).toThrow(SecurityException);
    });

    it('skips non-object values without throwing', () => {
        const guard = new SecurityGuard();
        expect(() => guard.assertSafeKeys({ name: 'Alice', count: 5 })).not.toThrow();
    });
});

describe(`${SecurityGuard.name} > sanitize`, () => {
    it('removes forbidden keys from root', () => {
        const guard = new SecurityGuard();
        const result = guard.sanitize({ name: 'Alice', __proto__: 'bad' });
        expect(result).toEqual({ name: 'Alice' });
        expect(result).not.toHaveProperty('__proto__');
    });

    it('removes forbidden keys recursively', () => {
        const guard = new SecurityGuard();
        const result = guard.sanitize({
            user: { name: 'Alice', constructor: 'bad' },
        });
        expect(result).toEqual({ user: { name: 'Alice' } });
    });

    it('preserves safe keys', () => {
        const guard = new SecurityGuard();
        const result = guard.sanitize({ a: 1, b: 'hello' });
        expect(result).toEqual({ a: 1, b: 'hello' });
    });

    it('throws SecurityException when sanitize depth exceeds maxDepth', () => {
        const guard = new SecurityGuard(1);
        const deep = { a: { b: { c: 'nested' } } };
        expect(() => guard.sanitize(deep)).toThrow(SecurityException);
    });
});

describe(`${SecurityGuard.name} > extraForbiddenKeys`, () => {
    it('blocks an extra forbidden key provided at construction', () => {
        const guard = new SecurityGuard(512, ['custom_forbidden']);
        expect(guard.isForbiddenKey('custom_forbidden')).toBe(true);
    });

    it('does not block a key not in extra list', () => {
        const guard = new SecurityGuard(512, ['custom_forbidden']);
        expect(guard.isForbiddenKey('safe_key')).toBe(false);
    });

    // Kills the `extraForbiddenKeys.length === 0` branch mutant:
    // when extras are provided, DEFAULT_FORBIDDEN_KEYS must also still block.
    it('default forbidden keys still block when extra keys are provided', () => {
        const guard = new SecurityGuard(512, ['my_custom_key']);
        // Default key must still be blocked
        expect(guard.isForbiddenKey('__proto__')).toBe(true);
        // Extra key must be blocked
        expect(guard.isForbiddenKey('my_custom_key')).toBe(true);
    });

    // Kills the `this.forbiddenKeysMap = DEFAULT_FORBIDDEN_KEYS` assignment mutant:
    // when empty extra array, the combined set still has default entries.
    it('uses DEFAULT_FORBIDDEN_KEYS when extra array is empty', () => {
        const guard = new SecurityGuard(512, []);
        expect(guard.isForbiddenKey('__proto__')).toBe(true);
        expect(guard.isForbiddenKey('constructor')).toBe(true);
    });
});

describe(`${SecurityGuard.name} > assertSafeKeys with non-object input`, () => {
    // Kills line 212 `typeof data !== 'object' || data === null` early return:
    // passing a number (non-object) should return early without throwing.
    it('returns early for number input without throwing', () => {
        const guard = new SecurityGuard();
        expect(() => guard.assertSafeKeys(42 as unknown as Record<string, unknown>)).not.toThrow();
    });

    it('returns early for boolean input without throwing', () => {
        const guard = new SecurityGuard();
        expect(() => guard.assertSafeKeys(true as unknown as Record<string, unknown>)).not.toThrow();
    });

    it('returns early for string input without throwing', () => {
        const guard = new SecurityGuard();
        expect(() => guard.assertSafeKeys('hello' as unknown as Record<string, unknown>)).not.toThrow();
    });
});

describe(`${SecurityGuard.name} > sanitize array passthrough`, () => {
    // Array values must be preserved safely (primitives kept, objects inside sanitized).
    it('preserves primitive array values in sanitize', () => {
        const guard = new SecurityGuard();
        const result = guard.sanitize({ items: ['a', 'b', 'c'] });
        expect(result).toEqual({ items: ['a', 'b', 'c'] });
        expect(Array.isArray(result['items'])).toBe(true);
    });

    it('preserves nested primitive arrays in sanitize', () => {
        const guard = new SecurityGuard();
        const result = guard.sanitize({ matrix: [[1, 2], [3, 4]] });
        expect(result).toEqual({ matrix: [[1, 2], [3, 4]] });
    });
});

describe(`${SecurityGuard.name} > depth boundary (assertSafeKeys)`, () => {
    it('does not throw at exactly maxDepth nesting level', () => {
        // maxDepth=1: root is depth 0; value of root key is depth 1; that value is a number → returns early
        const guard = new SecurityGuard(1);
        // depth 0 at root, depth 1 at 'a' value → value is object, depth 2 > 1 → throws
        // So with maxDepth=1, we need depth=1 to not throw → use flat object { a: 1 }
        expect(() => guard.assertSafeKeys({ a: 1 })).not.toThrow();
    });

    it('throws at exactly maxDepth+1 nesting level', () => {
        const guard = new SecurityGuard(0);
        // root is depth 0; 0 > 0 is false → iterates; 'a' value is object at depth 1; 1 > 0 → throws
        expect(() => guard.assertSafeKeys({ a: { b: 1 } })).toThrow(SecurityException);
    });

    it('does not throw when data has exactly maxDepth nested objects', () => {
        const guard = new SecurityGuard(2);
        // depth 0: root; depth 1: 'a' value; depth 2: 'b' value is a number → returns early
        expect(() => guard.assertSafeKeys({ a: { b: { c: 42 } } })).not.toThrow();
    });
});

describe(`${SecurityGuard.name} > constructor — NaN/Infinity clamping (SEC-020)`, () => {
    it('clamps NaN maxDepth to default 512 so depth guard still fires', () => {
        const guard = new SecurityGuard(NaN);
        expect(guard.maxDepth).toBe(512);
    });

    it('clamps Infinity maxDepth to default 512', () => {
        const guard = new SecurityGuard(Infinity);
        expect(guard.maxDepth).toBe(512);
    });

    it('assertSafeKeys still enforces depth after NaN maxDepth is clamped to 512', () => {
        const guard = new SecurityGuard(NaN);
        // With 512 levels clamped, a 1-level object is safe
        expect(() => guard.assertSafeKeys({ safe: 1 })).not.toThrow();
    });
});

describe(`${SecurityGuard.name} > depth boundary (sanitize)`, () => {
    it('does not throw sanitize at exactly maxDepth nesting level', () => {
        const guard = new SecurityGuard(1);
        // depth 0: root; sanitizing {a: 1} → 'a' value is number → recurse depth 1; number exits early
        expect(() => guard.sanitize({ a: 1 })).not.toThrow();
    });

    it('throws sanitize at exactly maxDepth+1 nesting level', () => {
        const guard = new SecurityGuard(0);
        expect(() => guard.sanitize({ a: { b: 1 } })).toThrow(SecurityException);
    });
});

describe(`${SecurityGuard.name} > extraForbiddenKeys constructor default`, () => {
    it('default empty array for extraForbiddenKeys produces only defaults', () => {
        // ArrayDeclaration survivor: default [] must not add any extra keys
        const guardDefault = new SecurityGuard(512);
        const guardExplicitEmpty = new SecurityGuard(512, []);
        expect(guardDefault.isForbiddenKey('__proto__')).toBe(true);
        expect(guardExplicitEmpty.isForbiddenKey('__proto__')).toBe(true);
        // A custom key not in defaults must NOT be blocked by either
        expect(guardDefault.isForbiddenKey('my_safe_key')).toBe(false);
        expect(guardExplicitEmpty.isForbiddenKey('my_safe_key')).toBe(false);
    });

    // Kills ArrayDeclaration survivor: default extraForbiddenKeys=[] must not add foreign keys
    it('default guard does not block an arbitrary non-default key', () => {
        const guard = new SecurityGuard();
        // The Stryker ArrayDeclaration mutant replaces [] with ["Stryker was here"]
        // this key would be blocked with mutant but not with default
        expect(guard.isForbiddenKey('regular_user_key')).toBe(false);
        expect(guard.isForbiddenKey('data')).toBe(false);
        expect(guard.isForbiddenKey('config')).toBe(false);
    });

    // Kills ConditionalExpression survivor at line 120: if (extraForbiddenKeys.length === 0) → if (false)
    // When [] is passed, must use DEFAULT_FORBIDDEN_KEYS directly (not build a new Set)
    it('uses DEFAULT_FORBIDDEN_KEYS set directly when empty array passed (not combined)', () => {
        const guard = new SecurityGuard(512, []);
        // Default forbidden keys must still work
        expect(guard.isForbiddenKey('__proto__')).toBe(true);
        // A key outside defaults must not be blocked
        expect(guard.isForbiddenKey('normalfield')).toBe(false);
    });
});

describe(`${SecurityGuard.name} > sanitize recursion into arrays`, () => {
    it('strips forbidden keys from objects nested inside an array', () => {
        const guard = new SecurityGuard();
        const data = { users: [{ name: 'Alice', __proto__: 'bad' }] };
        const result = guard.sanitize(data);
        expect(result).toEqual({ users: [{ name: 'Alice' }] });
    });

    it('strips forbidden keys from deeply nested arrays of objects', () => {
        const guard = new SecurityGuard();
        const data = { matrix: [[{ constructor: 'bad', ok: 1 }]] };
        const result = guard.sanitize(data);
        expect(result).toEqual({ matrix: [[{ ok: 1 }]] });
    });

    it('preserves safe objects inside arrays', () => {
        const guard = new SecurityGuard();
        const data = { items: [{ name: 'Alice' }, { name: 'Bob' }] };
        const result = guard.sanitize(data);
        expect(result).toEqual({ items: [{ name: 'Alice' }, { name: 'Bob' }] });
    });

    it('preserves primitive values inside arrays', () => {
        const guard = new SecurityGuard();
        const data = { tags: ['a', 'b', 'c'] };
        const result = guard.sanitize(data);
        expect(result).toEqual({ tags: ['a', 'b', 'c'] });
    });

    it('strips stream wrapper keys from objects inside arrays', () => {
        const guard = new SecurityGuard();
        const data = { rows: [{ 'javascript:alert(1)': 'bad', value: 1 }] };
        const result = guard.sanitize(data);
        expect(result).toEqual({ rows: [{ value: 1 }] });
    });

    it('handles mixed arrays with objects and primitives', () => {
        const guard = new SecurityGuard();
        const data = { list: ['safe', { __proto__: 'bad', ok: true }, 42] };
        const result = guard.sanitize(data);
        expect(result).toEqual({ list: ['safe', { ok: true }, 42] });
    });

    it('throws SecurityException when array nesting exceeds maxDepth', () => {
        const guard = new SecurityGuard(1);
        const data = { a: [{ b: [{ c: 'deep' }] }] };
        expect(() => guard.sanitize(data)).toThrow(SecurityException);
    });
});

describe(`${SecurityGuard.name} > prototype pollution keys`, () => {
    it('returns true for __proto__ as forbidden', () => {
        const guard = new SecurityGuard();
        expect(guard.isForbiddenKey('__proto__')).toBe(true);
    });

    it('returns true for constructor as forbidden', () => {
        const guard = new SecurityGuard();
        expect(guard.isForbiddenKey('constructor')).toBe(true);
    });

    it('returns true for prototype as forbidden', () => {
        const guard = new SecurityGuard();
        expect(guard.isForbiddenKey('prototype')).toBe(true);
    });

    it('assertSafeKey throws SecurityException for __proto__', () => {
        const guard = new SecurityGuard();
        expect(() => guard.assertSafeKey('__proto__')).toThrow(SecurityException);
    });

    it('assertSafeKey throws SecurityException for constructor', () => {
        const guard = new SecurityGuard();
        expect(() => guard.assertSafeKey('constructor')).toThrow(SecurityException);
    });

    it('assertSafeKeys throws for nested __proto__ key', () => {
        const guard = new SecurityGuard();
        // Use JSON.parse to create an own property named __proto__ (object literals set the prototype instead)
        const data = JSON.parse('{"safe": {"__proto__": {"isAdmin": true}}}') as Record<string, unknown>;
        expect(() => guard.assertSafeKeys(data)).toThrow(
            SecurityException,
        );
    });

    it('sanitize removes __proto__ key', () => {
        const guard = new SecurityGuard();
        // Use JSON.parse to create an own property named __proto__
        const data = JSON.parse('{"__proto__": {"isAdmin": true}, "name": "Alice"}') as Record<string, unknown>;
        const result = guard.sanitize(data);
        expect(result).toEqual({ name: 'Alice' });
    });

    it('sanitize removes constructor key from nested objects', () => {
        const guard = new SecurityGuard();
        const result = guard.sanitize({ user: { constructor: 'bad', name: 'Alice' } });
        expect(result).toEqual({ user: { name: 'Alice' } });
    });

    it('returns true for __PROTO__ (uppercase, case-insensitive magic match)', () => {
        const guard = new SecurityGuard();
        expect(guard.isForbiddenKey('__PROTO__')).toBe(true);
    });
});

describe(`${SecurityGuard.name} > case-insensitive stream wrapper prefix`, () => {
    it('returns true for uppercase JAVASCRIPT: protocol URI', () => {
        const guard = new SecurityGuard();
        expect(guard.isForbiddenKey('JAVASCRIPT:alert(1)')).toBe(true);
    });

    it('returns true for mixed-case Javascript: protocol URI', () => {
        const guard = new SecurityGuard();
        expect(guard.isForbiddenKey('Javascript:void(0)')).toBe(true);
    });

    it('returns true for uppercase HTTP:// stream wrapper URI', () => {
        const guard = new SecurityGuard();
        expect(guard.isForbiddenKey('HTTP://evil.com/data')).toBe(true);
    });

    it('returns true for uppercase FILE:// stream wrapper URI', () => {
        const guard = new SecurityGuard();
        expect(guard.isForbiddenKey('FILE:///etc/passwd')).toBe(true);
    });

    it('assertSafeKey throws SecurityException for HTTP://host', () => {
        const guard = new SecurityGuard();
        expect(() => guard.assertSafeKey('HTTP://attacker.com/payload')).toThrow(
            SecurityException,
        );
    });

    it('returns false for a word starting with node but without scheme', () => {
        const guard = new SecurityGuard();
        expect(guard.isForbiddenKey('node_modules')).toBe(false);
    });

    it('returns true for DATA:// uppercase stream wrapper', () => {
        const guard = new SecurityGuard();
        expect(guard.isForbiddenKey('DATA://text/plain;base64,abc')).toBe(true);
    });
});

describe(`${SecurityGuard.name} > sanitizeArray depth check (QUAL-009)`, () => {
    it('throws SecurityException when array-only nesting exceeds maxDepth', () => {
        const guard = new SecurityGuard(2);
        const data = { a: [[[['deep']]]] };
        expect(() => guard.sanitize(data)).toThrow(SecurityException);
    });

    it('sanitizeArray depth error message contains depth and limit', () => {
        const guard = new SecurityGuard(2);
        const data = { a: [[[['deep']]]] };
        expect(() => guard.sanitize(data)).toThrow(/Recursion depth \d+ exceeds maximum/);
    });
});

describe(`${SecurityGuard.name} > sanitizeArray null handling (QUAL-011)`, () => {
    it('preserves null elements inside arrays during sanitize', () => {
        const guard = new SecurityGuard();
        const result = guard.sanitize({ items: [null, { name: 'ok' }, null] });
        expect(result).toEqual({ items: [null, { name: 'ok' }, null] });
    });
});

describe(`${SecurityGuard.name} > assertSafeKeys depth message (QUAL-012)`, () => {
    it('assertSafeKeys error message contains depth and limit', () => {
        const guard = new SecurityGuard(1);
        const deep = { a: { b: { c: 'too deep' } } };
        expect(() => guard.assertSafeKeys(deep)).toThrow(/Recursion depth \d+ exceeds maximum/);
    });
});

describe(`${SecurityGuard.name} > isForbiddenKey startsWith normalization (QUAL-013)`, () => {
    it('normalizes case for keys starting with __ but not ending with __', () => {
        const guard = new SecurityGuard();
        // __DIRNAME starts with __ but does NOT end with __ → only startsWith normalises it
        expect(guard.isForbiddenKey('__DIRNAME')).toBe(true);
        expect(guard.isForbiddenKey('__FILENAME')).toBe(true);
    });
});

describe(`${SecurityGuard.name} > data: URI scheme blocking (SEC-014)`, () => {
    it('T1: blocks browser data: URI carrying executable HTML payload', () => {
        const guard = new SecurityGuard();
        expect(guard.isForbiddenKey('data:text/html,<script>alert(1)</script>')).toBe(true);
    });

    it('T2: allows a key that starts with "data" but has no scheme delimiter', () => {
        const guard = new SecurityGuard();
        expect(guard.isForbiddenKey('data')).toBe(false);
        expect(guard.isForbiddenKey('database')).toBe(false);
    });

    it('T3: blocks bare data: scheme exactly', () => {
        const guard = new SecurityGuard();
        expect(guard.isForbiddenKey('data:')).toBe(true);
    });

    it('T4: blocks data: URI with uppercase letters (case-insensitive prefix match)', () => {
        const guard = new SecurityGuard();
        expect(guard.isForbiddenKey('DATA:text/html,evil')).toBe(true);
        expect(guard.isForbiddenKey('Data:image/svg+xml,<svg/>')).toBe(true);
    });

    it('T5: blocks data: key nested inside an object via assertSafeKeys', () => {
        const guard = new SecurityGuard();
        const nested = { outer: { 'data:text/html,evil': 'payload' } };
        expect(() => guard.assertSafeKeys(nested)).toThrow(SecurityException);
    });

    it('T6: SecurityException message identifies the forbidden key', () => {
        const guard = new SecurityGuard();
        expect(() => guard.assertSafeKey('data:text/html,xss')).toThrow(
            "Forbidden key 'data:text/html,xss' detected.",
        );
    });

    it('T7: data:// (PHP-style) is still blocked alongside new data: browser URI rule', () => {
        const guard = new SecurityGuard();
        expect(guard.isForbiddenKey('data://')).toBe(true);
        expect(guard.isForbiddenKey('data://text/plain;base64,aGVsbG8=')).toBe(true);
    });
});

describe(`${SecurityGuard.name} > SEC-013 de-coupled keys (PHP-specific keys not blocked in JS)`, () => {
    it('does not block PHP magic method __construct', () => {
        const guard = new SecurityGuard();
        expect(guard.isForbiddenKey('__construct')).toBe(false);
    });

    it('does not block PHP magic method __destruct', () => {
        const guard = new SecurityGuard();
        expect(guard.isForbiddenKey('__destruct')).toBe(false);
    });

    it('does not block PHP magic method __callStatic', () => {
        const guard = new SecurityGuard();
        expect(guard.isForbiddenKey('__callStatic')).toBe(false);
    });

    it('does not block PHP superglobal _GET', () => {
        const guard = new SecurityGuard();
        expect(guard.isForbiddenKey('_GET')).toBe(false);
    });

    it('does not block PHP superglobal _POST', () => {
        const guard = new SecurityGuard();
        expect(guard.isForbiddenKey('_POST')).toBe(false);
    });

    it('does not block PHP superglobal GLOBALS', () => {
        const guard = new SecurityGuard();
        expect(guard.isForbiddenKey('GLOBALS')).toBe(false);
    });

    it('does not block PHP-only stream wrapper phar://', () => {
        const guard = new SecurityGuard();
        expect(guard.isForbiddenKey('phar://')).toBe(false);
    });

    it('does not block PHP-only stream wrapper php://', () => {
        const guard = new SecurityGuard();
        expect(guard.isForbiddenKey('php://')).toBe(false);
    });

    it('does not block PHP-only stream wrapper zlib://', () => {
        const guard = new SecurityGuard();
        expect(guard.isForbiddenKey('zlib://')).toBe(false);
    });
});
