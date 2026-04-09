import { describe, expect, it } from 'vitest';
import { SecurityGuard } from '../../src/security/security-guard.js';
import { SecurityException } from '../../src/exceptions/security-exception.js';

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
        expect(() => guard.assertSafeKey('__proto__')).toThrow(
            "Forbidden key '__proto__' detected.",
        );
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

    it('exposes the extra forbidden keys as a readonly array', () => {
        const guard = new SecurityGuard(512, ['custom_a', 'custom_b']);
        expect(guard.extraForbiddenKeys).toEqual(['custom_a', 'custom_b']);
    });

    it('exposes an empty readonly array when no extra keys are provided', () => {
        const guard = new SecurityGuard();
        expect(guard.extraForbiddenKeys).toEqual([]);
    });
});
