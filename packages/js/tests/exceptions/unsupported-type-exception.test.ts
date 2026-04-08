import { describe, expect, it } from 'vitest';
import { UnsupportedTypeException } from '../../src/exceptions/unsupported-type-exception.js';
import { AccessorException } from '../../src/exceptions/accessor-exception.js';

describe(UnsupportedTypeException.name, () => {
    it('stores the provided message', () => {
        expect(new UnsupportedTypeException('TypeFormat.Csv is not supported.').message).toBe(
            'TypeFormat.Csv is not supported.',
        );
    });

    it('sets name to UnsupportedTypeException', () => {
        expect(new UnsupportedTypeException('msg').name).toBe('UnsupportedTypeException');
    });

    it('is an instance of AccessorException', () => {
        expect(new UnsupportedTypeException('msg')).toBeInstanceOf(AccessorException);
    });

    it('is an instance of Error', () => {
        expect(new UnsupportedTypeException('msg')).toBeInstanceOf(Error);
    });

    it('supports cause chaining via ErrorOptions', () => {
        const cause = new Error('root cause');
        const err = new UnsupportedTypeException('outer', { cause });
        expect(err.cause).toBe(cause);
    });

    it('can be constructed without options', () => {
        expect(() => new UnsupportedTypeException('msg')).not.toThrow();
    });
});
