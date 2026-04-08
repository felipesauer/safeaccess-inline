import { describe, expect, it } from 'vitest';
import { PathNotFoundException } from '../../src/exceptions/path-not-found-exception.js';
import { AccessorException } from '../../src/exceptions/accessor-exception.js';

describe(PathNotFoundException.name, () => {
    it('stores the provided message', () => {
        expect(new PathNotFoundException("Path 'user.address.zip' not found.").message).toBe(
            "Path 'user.address.zip' not found.",
        );
    });

    it('sets name to PathNotFoundException', () => {
        expect(new PathNotFoundException('msg').name).toBe('PathNotFoundException');
    });

    it('is an instance of AccessorException', () => {
        expect(new PathNotFoundException('msg')).toBeInstanceOf(AccessorException);
    });

    it('is an instance of Error', () => {
        expect(new PathNotFoundException('msg')).toBeInstanceOf(Error);
    });

    it('supports cause chaining via ErrorOptions', () => {
        const cause = new Error('root cause');
        const err = new PathNotFoundException('outer', { cause });
        expect(err.cause).toBe(cause);
    });

    it('can be constructed without options', () => {
        expect(() => new PathNotFoundException('msg')).not.toThrow();
    });
});
