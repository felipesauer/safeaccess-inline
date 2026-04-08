import { describe, expect, it } from 'vitest';
import { SecurityGuard } from '../../src/security/security-guard.js';

// Every key in DEFAULT_FORBIDDEN_KEYS must block individually.
// This prevents Stryker StringLiteral mutants (each key mutated to "") from surviving.
describe(`${SecurityGuard.name} > all individual forbidden keys`, () => {
    const prototypePollutiondVectors = ['__proto__', 'constructor', 'prototype'];
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
