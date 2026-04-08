import { describe, expect, it } from 'vitest';
import { ReadonlyViolationException } from '../../src/exceptions/readonly-violation-exception.js';
import { AccessorException } from '../../src/exceptions/accessor-exception.js';

describe(ReadonlyViolationException.name, () => {
    it('uses default message when none is provided', () => {
        expect(new ReadonlyViolationException().message).toBe('Cannot modify a readonly accessor.');
    });

    it('accepts a custom message', () => {
        expect(new ReadonlyViolationException('custom msg').message).toBe('custom msg');
    });

    it('sets name to ReadonlyViolationException', () => {
        expect(new ReadonlyViolationException().name).toBe('ReadonlyViolationException');
    });

    it('is an instance of AccessorException', () => {
        expect(new ReadonlyViolationException()).toBeInstanceOf(AccessorException);
    });

    it('is an instance of Error', () => {
        expect(new ReadonlyViolationException()).toBeInstanceOf(Error);
    });

    it('supports cause chaining via ErrorOptions', () => {
        const cause = new Error('root cause');
        const err = new ReadonlyViolationException('msg', { cause });
        expect(err.cause).toBe(cause);
    });

    it('can be constructed without options', () => {
        expect(() => new ReadonlyViolationException()).not.toThrow();
    });
});
