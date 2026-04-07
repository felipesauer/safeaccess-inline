import { describe, expect, it } from 'vitest';
import { Inline } from '../src/inline.js';
import { ObjectAccessor } from '../src/accessors/formats/object-accessor.js';
import { IniAccessor } from '../src/accessors/formats/ini-accessor.js';
import { EnvAccessor } from '../src/accessors/formats/env-accessor.js';
import { NdjsonAccessor } from '../src/accessors/formats/ndjson-accessor.js';
import { JsonAccessor } from '../src/accessors/formats/json-accessor.js';
import { DotNotationParser } from '../src/core/dot-notation-parser.js';
import { SecurityGuard } from '../src/security/security-guard.js';
import { SecurityParser } from '../src/security/security-parser.js';
import { SecurityException } from '../src/exceptions/security-exception.js';

describe('Inline.fromObject (static)', () => {
    it('returns correct accessor and resolves property', () => {
        const accessor = Inline.fromObject({ user: { name: 'Alice' } });
        expect(accessor.get('user.name')).toBe('Alice');
    });
});

describe('Inline.make (parity)', () => {
    it('creates IniAccessor by constructor', () => {
        const accessor = Inline.make(IniAccessor, '[section]\nkey=value');
        expect(accessor.get('section.key')).toBe('value');
    });

    it('creates EnvAccessor by constructor', () => {
        const accessor = Inline.make(EnvAccessor, 'APP_NAME=MyApp');
        expect(accessor.get('APP_NAME')).toBe('MyApp');
    });

    it('creates NdjsonAccessor by constructor', () => {
        const accessor = Inline.make(NdjsonAccessor, '{"id":1}\n{"id":2}');
        expect(accessor.get('0.id')).toBe(1);
    });

    it('creates ObjectAccessor by constructor', () => {
        const accessor = Inline.make(ObjectAccessor, { name: 'Alice' });
        expect(accessor.get('name')).toBe('Alice');
    });
});

describe('AbstractAccessor.getMany (parity)', () => {
    it('returns multiple values keyed by path', () => {
        const accessor = Inline.fromArray({ a: 1, b: { c: 2 } });
        const result = accessor.getMany({ a: null, 'b.c': null });
        expect(result).toEqual({ a: 1, 'b.c': 2 });
    });

    it('uses provided default for missing paths', () => {
        const accessor = Inline.fromArray({ a: 1 });
        const result = accessor.getMany({ a: null, missing: 'fallback' });
        expect(result).toEqual({ a: 1, missing: 'fallback' });
    });
});

describe('AbstractAccessor.getRaw (parity)', () => {
    it('stores raw input for ArrayAccessor', () => {
        const raw = { name: 'Alice', age: 30 };
        const accessor = Inline.fromArray(raw);
        expect(accessor.getRaw()).toEqual(raw);
    });

    it('stores raw input for JsonAccessor', () => {
        const raw = '{"name":"Alice"}';
        const accessor = Inline.fromJson(raw);
        expect(accessor.getRaw()).toBe(raw);
    });

    it('stores raw input for YamlAccessor', () => {
        const raw = 'name: Alice';
        const accessor = Inline.fromYaml(raw);
        expect(accessor.getRaw()).toBe(raw);
    });

    it('stores raw input for IniAccessor', () => {
        const raw = '[section]\nkey=value';
        const accessor = Inline.fromIni(raw);
        expect(accessor.getRaw()).toBe(raw);
    });

    it('stores raw input for EnvAccessor', () => {
        const raw = 'APP_NAME=MyApp';
        const accessor = Inline.fromEnv(raw);
        expect(accessor.getRaw()).toBe(raw);
    });
});

describe(`${Inline.name} > withStrictMode (parity)`, () => {
    it('withStrictMode(false) bypasses payload size validation for JSON', () => {
        const secParser = new SecurityParser({ maxPayloadBytes: 5 });
        const accessor = Inline.withSecurityParser(secParser)
            .withStrictMode(false)
            .fromJson('{"name":"Alice"}');
        expect(accessor.get('name')).toBe('Alice');
    });

    it('withStrictMode(false) bypasses forbidden key validation for JSON', () => {
        const accessor = Inline.withStrictMode(false).fromJson('{"__proto__":"injected"}');
        expect(accessor.get('__proto__')).toBe('injected');
    });

    it('withStrictMode(true) enforces forbidden key validation for JSON', () => {
        expect(() =>
            Inline.withStrictMode(true).fromJson('{"__proto__":"injected"}'),
        ).toThrow(SecurityException);
    });

    it('strict(false) bypasses payload size validation for JSON', () => {
        const tinyParser = new SecurityParser({ maxPayloadBytes: 5 });
        const parser = new DotNotationParser(new SecurityGuard(), tinyParser);
        const accessor = new JsonAccessor(parser).strict(false).from('{"name":"Alice"}');
        expect(accessor.get('name')).toBe('Alice');
    });

    it('strict(false) bypasses forbidden key validation for JSON', () => {
        const parser = new DotNotationParser(new SecurityGuard(), new SecurityParser());
        const accessor = new JsonAccessor(parser).strict(false).from('{"__proto__":"injected"}');
        expect(accessor.get('__proto__')).toBe('injected');
    });
});

describe(`${Inline.name} > withStrictMode + make (parity)`, () => {
    it('withStrictMode(false) bypasses forbidden key validation through make()', () => {
        const accessor = Inline.withStrictMode(false).make(JsonAccessor, '{"__proto__":"ok"}');
        expect(accessor.get('__proto__')).toBe('ok');
    });

    it('withStrictMode(true) enforces forbidden key validation through make()', () => {
        expect(() =>
            Inline.withStrictMode(true).make(JsonAccessor, '{"__proto__":"injected"}'),
        ).toThrow(SecurityException);
    });

    it('withStrictMode(false) bypasses payload size validation through make()', () => {
        const secParser = new SecurityParser({ maxPayloadBytes: 5 });
        const accessor = Inline.withSecurityParser(secParser)
            .withStrictMode(false)
            .make(JsonAccessor, '{"name":"Alice"}');
        expect(accessor.get('name')).toBe('Alice');
    });

    it('withStrictMode(true) enforces payload size validation through make()', () => {
        const secParser = new SecurityParser({ maxPayloadBytes: 5 });
        expect(() =>
            Inline.withSecurityParser(secParser)
                .withStrictMode(true)
                .make(JsonAccessor, '{"name":"Alice"}'),
        ).toThrow(SecurityException);
    });
});

describe('AbstractAccessor.keys (parity)', () => {
    it('returns string keys for object-keyed data (JS and PHP both return string[])', () => {
        const accessor = Inline.fromJson('{"name":"Alice","age":30}');
        expect(accessor.keys()).toEqual(['name', 'age']);
    });

    it('returns numeric indices as strings for NDJSON (parity with PHP array_map strval fix)', () => {
        // PHP: array_keys(['Alice', 'Bob']) = [0, 1] → cast → ['0', '1']
        // JS:  Object.keys({'0': {...}, '1': {...}}) = ['0', '1'] (already strings)
        const accessor = Inline.fromNdjson('{"name":"Alice"}\n{"name":"Bob"}');
        expect(accessor.keys()).toEqual(['0', '1']);
    });
});
