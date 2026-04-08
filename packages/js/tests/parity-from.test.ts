import { describe, expect, it } from 'vitest';
import { AbstractAccessor } from '../src/accessors/abstract-accessor.js';
import { ArrayAccessor } from '../src/accessors/formats/array-accessor.js';
import { ObjectAccessor } from '../src/accessors/formats/object-accessor.js';
import { JsonAccessor } from '../src/accessors/formats/json-accessor.js';
import { XmlAccessor } from '../src/accessors/formats/xml-accessor.js';
import { YamlAccessor } from '../src/accessors/formats/yaml-accessor.js';
import { IniAccessor } from '../src/accessors/formats/ini-accessor.js';
import { EnvAccessor } from '../src/accessors/formats/env-accessor.js';
import { NdjsonAccessor } from '../src/accessors/formats/ndjson-accessor.js';
import { AnyAccessor } from '../src/accessors/formats/any-accessor.js';
import { DotNotationParser } from '../src/core/dot-notation-parser.js';
import { InvalidFormatException } from '../src/exceptions/invalid-format-exception.js';
import { FakeParseIntegration } from './mocks/fake-parse-integration.js';

function makeParser(): DotNotationParser {
    return new DotNotationParser();
}

describe(`${AbstractAccessor.name} > from() > ArrayAccessor (parity)`, () => {
    it('hydrates from a plain object and resolves a key', () => {
        expect(new ArrayAccessor(makeParser()).from({ name: 'Alice' }).get('name')).toBe('Alice');
    });

    it('throws InvalidFormatException for a non-object non-array input', () => {
        expect(() => new ArrayAccessor(makeParser()).from('not-an-array')).toThrow(
            InvalidFormatException,
        );
    });
});

describe(`${AbstractAccessor.name} > from() > ObjectAccessor (parity)`, () => {
    it('hydrates from a JavaScript object and resolves a property', () => {
        expect(new ObjectAccessor(makeParser()).from({ name: 'Alice' }).get('name')).toBe('Alice');
    });

    it('throws InvalidFormatException for an integer input', () => {
        expect(() => new ObjectAccessor(makeParser()).from(42)).toThrow(InvalidFormatException);
    });
});

describe(`${AbstractAccessor.name} > from() > JsonAccessor (parity)`, () => {
    it('hydrates from a JSON string and resolves a key', () => {
        expect(new JsonAccessor(makeParser()).from('{"name":"Alice"}').get('name')).toBe('Alice');
    });

    it('throws InvalidFormatException for an integer input', () => {
        expect(() => new JsonAccessor(makeParser()).from(42)).toThrow(InvalidFormatException);
    });
});

describe(`${AbstractAccessor.name} > from() > XmlAccessor (parity)`, () => {
    it('hydrates from an XML string and resolves an element', () => {
        expect(
            new XmlAccessor(makeParser()).from('<root><name>Alice</name></root>').get('name'),
        ).toBe('Alice');
    });

    it('throws InvalidFormatException for an integer input', () => {
        expect(() => new XmlAccessor(makeParser()).from(42)).toThrow(InvalidFormatException);
    });
});

describe(`${AbstractAccessor.name} > from() > YamlAccessor (parity)`, () => {
    it('hydrates from a YAML string and resolves a key', () => {
        expect(new YamlAccessor(makeParser()).from('name: Alice\n').get('name')).toBe('Alice');
    });

    it('throws InvalidFormatException for an integer input', () => {
        expect(() => new YamlAccessor(makeParser()).from(42)).toThrow(InvalidFormatException);
    });
});

describe(`${AbstractAccessor.name} > from() > IniAccessor (parity)`, () => {
    it('hydrates from an INI string and resolves a key', () => {
        expect(new IniAccessor(makeParser()).from('[s]\nname=Alice').get('s.name')).toBe('Alice');
    });

    it('throws InvalidFormatException for an integer input', () => {
        expect(() => new IniAccessor(makeParser()).from(42)).toThrow(InvalidFormatException);
    });
});

describe(`${AbstractAccessor.name} > from() > EnvAccessor (parity)`, () => {
    it('hydrates from a dotenv string and resolves a key', () => {
        expect(new EnvAccessor(makeParser()).from('NAME=Alice\n').get('NAME')).toBe('Alice');
    });

    it('throws InvalidFormatException for an integer input', () => {
        expect(() => new EnvAccessor(makeParser()).from(42)).toThrow(InvalidFormatException);
    });
});

describe(`${AbstractAccessor.name} > from() > NdjsonAccessor (parity)`, () => {
    it('hydrates from an NDJSON string and resolves via index', () => {
        expect(new NdjsonAccessor(makeParser()).from('{"name":"Alice"}').get('0.name')).toBe(
            'Alice',
        );
    });

    it('throws InvalidFormatException for an integer input', () => {
        expect(() => new NdjsonAccessor(makeParser()).from(42)).toThrow(InvalidFormatException);
    });
});

describe(`${AbstractAccessor.name} > from() > AnyAccessor (parity)`, () => {
    it('hydrates via integration and resolves a key', () => {
        const integration = new FakeParseIntegration(true, { name: 'Alice' });
        expect(new AnyAccessor(makeParser(), integration).from('raw').get('name')).toBe('Alice');
    });

    it('throws InvalidFormatException when the integration rejects the input', () => {
        const integration = new FakeParseIntegration(false, {});
        expect(() => new AnyAccessor(makeParser(), integration).from('bad')).toThrow(
            InvalidFormatException,
        );
    });
});
