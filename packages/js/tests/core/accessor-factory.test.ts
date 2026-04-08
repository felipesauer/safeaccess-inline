import { describe, expect, it } from 'vitest';
import { AccessorFactory } from '../../src/core/accessor-factory.js';
import { DotNotationParser } from '../../src/core/dot-notation-parser.js';
import { SecurityGuard } from '../../src/security/security-guard.js';
import { SecurityParser } from '../../src/security/security-parser.js';
import { ArrayAccessor } from '../../src/accessors/formats/array-accessor.js';
import { ObjectAccessor } from '../../src/accessors/formats/object-accessor.js';
import { JsonAccessor } from '../../src/accessors/formats/json-accessor.js';
import { XmlAccessor } from '../../src/accessors/formats/xml-accessor.js';
import { YamlAccessor } from '../../src/accessors/formats/yaml-accessor.js';
import { IniAccessor } from '../../src/accessors/formats/ini-accessor.js';
import { EnvAccessor } from '../../src/accessors/formats/env-accessor.js';
import { NdjsonAccessor } from '../../src/accessors/formats/ndjson-accessor.js';
import { AnyAccessor } from '../../src/accessors/formats/any-accessor.js';
import { InvalidFormatException } from '../../src/exceptions/invalid-format-exception.js';
import { FakeParseIntegration } from '../mocks/fake-parse-integration.js';

function makeParser(): DotNotationParser {
    return new DotNotationParser(new SecurityGuard(), new SecurityParser());
}

describe(AccessorFactory.name, () => {
    describe('getParser', () => {
        it('returns the parser passed to the constructor', () => {
            const parser = makeParser();
            const factory = new AccessorFactory(parser);
            expect(factory.getParser()).toBe(parser);
        });
    });

    describe('array', () => {
        it('creates an ArrayAccessor from object data', () => {
            const factory = new AccessorFactory(makeParser());
            const accessor = factory.array({ key: 'value' });
            expect(accessor).toBeInstanceOf(ArrayAccessor);
            expect(accessor.get('key')).toBe('value');
        });

        it('creates an ArrayAccessor from array data', () => {
            const factory = new AccessorFactory(makeParser());
            const accessor = factory.array([1, 2, 3]);
            expect(accessor).toBeInstanceOf(ArrayAccessor);
            expect(accessor.get('0')).toBe(1);
        });
    });

    describe('object', () => {
        it('creates an ObjectAccessor from object data', () => {
            const factory = new AccessorFactory(makeParser());
            const accessor = factory.object({ name: 'Alice' });
            expect(accessor).toBeInstanceOf(ObjectAccessor);
            expect(accessor.get('name')).toBe('Alice');
        });
    });

    describe('json', () => {
        it('creates a JsonAccessor from JSON string', () => {
            const factory = new AccessorFactory(makeParser());
            const accessor = factory.json('{"key":"value"}');
            expect(accessor).toBeInstanceOf(JsonAccessor);
            expect(accessor.get('key')).toBe('value');
        });
    });

    describe('xml', () => {
        it('creates an XmlAccessor from XML string', () => {
            const factory = new AccessorFactory(makeParser());
            const accessor = factory.xml('<root><key>value</key></root>');
            expect(accessor).toBeInstanceOf(XmlAccessor);
            expect(accessor.get('key')).toBe('value');
        });
    });

    describe('yaml', () => {
        it('creates a YamlAccessor from YAML string', () => {
            const factory = new AccessorFactory(makeParser());
            const accessor = factory.yaml('key: value');
            expect(accessor).toBeInstanceOf(YamlAccessor);
            expect(accessor.get('key')).toBe('value');
        });
    });

    describe('ini', () => {
        it('creates an IniAccessor from INI string', () => {
            const factory = new AccessorFactory(makeParser());
            const accessor = factory.ini('[section]\nkey=value');
            expect(accessor).toBeInstanceOf(IniAccessor);
            expect(accessor.get('section.key')).toBe('value');
        });
    });

    describe('env', () => {
        it('creates an EnvAccessor from dotenv string', () => {
            const factory = new AccessorFactory(makeParser());
            const accessor = factory.env('APP_NAME=MyApp');
            expect(accessor).toBeInstanceOf(EnvAccessor);
            expect(accessor.get('APP_NAME')).toBe('MyApp');
        });
    });

    describe('ndjson', () => {
        it('creates an NdjsonAccessor from NDJSON string', () => {
            const factory = new AccessorFactory(makeParser());
            const accessor = factory.ndjson('{"id":1}\n{"id":2}');
            expect(accessor).toBeInstanceOf(NdjsonAccessor);
            expect(accessor.get('0.id')).toBe(1);
        });
    });

    describe('any', () => {
        it('creates an AnyAccessor with a provided integration', () => {
            const integration = new FakeParseIntegration(true, { foo: 'bar' });
            const factory = new AccessorFactory(makeParser(), integration);
            const accessor = factory.any('raw');
            expect(accessor).toBeInstanceOf(AnyAccessor);
            expect(accessor.get('foo')).toBe('bar');
        });

        it('uses inline integration over default', () => {
            const defaultInt = new FakeParseIntegration(true, { from: 'default' });
            const overrideInt = new FakeParseIntegration(true, { from: 'override' });
            const factory = new AccessorFactory(makeParser(), defaultInt);
            const accessor = factory.any('raw', overrideInt);
            expect(accessor.get('from')).toBe('override');
        });

        it('throws InvalidFormatException when no integration is available', () => {
            const factory = new AccessorFactory(makeParser());
            expect(() => factory.any('data')).toThrow(InvalidFormatException);
        });

        it('throws with guidance message when no integration is set', () => {
            const factory = new AccessorFactory(makeParser());
            expect(() => factory.any('data')).toThrow(
                'AnyAccessor requires a ParseIntegrationInterface',
            );
        });

        it('includes withParserIntegration guidance in the error message', () => {
            const factory = new AccessorFactory(makeParser());
            expect(() => factory.any('data')).toThrow(/withParserIntegration/);
        });
    });

    describe('strict mode', () => {
        it('applies strict mode to created accessors when configured', () => {
            const factory = new AccessorFactory(makeParser(), null, false);
            const accessor = factory.json('{"__proto__":"ok"}');
            expect(accessor.get('__proto__')).toBe('ok');
        });

        it('does not apply strict mode when null', () => {
            const factory = new AccessorFactory(makeParser(), null, null);
            expect(() => factory.json('{"__proto__":"fail"}')).toThrow();
        });
    });
});
