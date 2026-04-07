import { describe, expect, it } from 'vitest';
import { ParserException } from '../../src/exceptions/parser-exception.js';
import { AccessorException } from '../../src/exceptions/accessor-exception.js';

describe(ParserException.name, () => {
    it('stores the provided message', () => {
        expect(new ParserException('Parser failed.').message).toBe('Parser failed.');
    });

    it('sets name to ParserException', () => {
        expect(new ParserException('msg').name).toBe('ParserException');
    });

    it('is an instance of AccessorException', () => {
        expect(new ParserException('msg')).toBeInstanceOf(AccessorException);
    });

    it('is an instance of Error', () => {
        expect(new ParserException('msg')).toBeInstanceOf(Error);
    });

    it('supports cause chaining via ErrorOptions', () => {
        const cause = new Error('root cause');
        const err = new ParserException('outer', { cause });
        expect(err.cause).toBe(cause);
    });

    it('can be constructed without options', () => {
        expect(() => new ParserException('msg')).not.toThrow();
    });
});
