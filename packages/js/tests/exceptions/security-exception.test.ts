import { describe, expect, it } from 'vitest';
import { SecurityException } from '../../src/exceptions/security-exception.js';
import { AccessorException } from '../../src/exceptions/accessor-exception.js';

describe(SecurityException.name, () => {
    it('stores the provided message', () => {
        expect(new SecurityException("Forbidden key '__proto__' detected.").message).toBe(
            "Forbidden key '__proto__' detected.",
        );
    });

    it('sets name to SecurityException', () => {
        expect(new SecurityException('msg').name).toBe('SecurityException');
    });

    it('is an instance of AccessorException', () => {
        expect(new SecurityException('msg')).toBeInstanceOf(AccessorException);
    });

    it('is an instance of Error', () => {
        expect(new SecurityException('msg')).toBeInstanceOf(Error);
    });

    it('supports cause chaining via ErrorOptions', () => {
        const cause = new Error('root cause');
        const err = new SecurityException('outer', { cause });
        expect(err.cause).toBe(cause);
    });

    it('can be constructed without options', () => {
        expect(() => new SecurityException('msg')).not.toThrow();
    });
});
