import { describe, expect, it } from 'vitest';
import { AccessorException } from '../../src/exceptions/accessor-exception.js';

describe(AccessorException.name, () => {
    it('stores the provided message', () => {
        expect(new AccessorException('Something went wrong.').message).toBe(
            'Something went wrong.',
        );
    });

    it('sets name to AccessorException', () => {
        expect(new AccessorException('msg').name).toBe('AccessorException');
    });

    it('is an instance of Error', () => {
        expect(new AccessorException('msg')).toBeInstanceOf(Error);
    });

    it('supports cause chaining via ErrorOptions', () => {
        const cause = new Error('root cause');
        const err = new AccessorException('outer', { cause });
        expect(err.cause).toBe(cause);
    });

    it('can be constructed without options', () => {
        expect(() => new AccessorException('msg')).not.toThrow();
    });
});
