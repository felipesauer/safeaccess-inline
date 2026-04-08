import { describe, expect, it } from 'vitest';
import { InvalidFormatException } from '../../src/exceptions/invalid-format-exception.js';
import { AccessorException } from '../../src/exceptions/accessor-exception.js';

describe(InvalidFormatException.name, () => {
    it('stores the provided message', () => {
        expect(new InvalidFormatException('Expected JSON.').message).toBe('Expected JSON.');
    });

    it('sets name to InvalidFormatException', () => {
        expect(new InvalidFormatException('msg').name).toBe('InvalidFormatException');
    });

    it('is an instance of AccessorException', () => {
        expect(new InvalidFormatException('msg')).toBeInstanceOf(AccessorException);
    });

    it('is an instance of Error', () => {
        expect(new InvalidFormatException('msg')).toBeInstanceOf(Error);
    });

    it('supports cause chaining via ErrorOptions', () => {
        const cause = new Error('root cause');
        const err = new InvalidFormatException('outer', { cause });
        expect(err.cause).toBe(cause);
    });

    it('can be constructed without options', () => {
        expect(() => new InvalidFormatException('msg')).not.toThrow();
    });
});
