import { describe, expect, it } from 'vitest';
import { YamlParseException } from '../../src/exceptions/yaml-parse-exception.js';
import { InvalidFormatException } from '../../src/exceptions/invalid-format-exception.js';
import { AccessorException } from '../../src/exceptions/accessor-exception.js';

describe(YamlParseException.name, () => {
    it('stores the provided message', () => {
        expect(new YamlParseException('YAML anchors are not supported.').message).toBe(
            'YAML anchors are not supported.',
        );
    });

    it('sets name to YamlParseException', () => {
        expect(new YamlParseException('msg').name).toBe('YamlParseException');
    });

    it('is an instance of InvalidFormatException', () => {
        expect(new YamlParseException('msg')).toBeInstanceOf(InvalidFormatException);
    });

    it('is an instance of AccessorException', () => {
        expect(new YamlParseException('msg')).toBeInstanceOf(AccessorException);
    });

    it('is an instance of Error', () => {
        expect(new YamlParseException('msg')).toBeInstanceOf(Error);
    });

    it('supports cause chaining via ErrorOptions', () => {
        const cause = new Error('root cause');
        const err = new YamlParseException('outer', { cause });
        expect(err.cause).toBe(cause);
    });

    it('can be constructed without options', () => {
        expect(() => new YamlParseException('msg')).not.toThrow();
    });
});
