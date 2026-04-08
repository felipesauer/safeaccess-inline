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
import { InvalidFormatException } from '../src/exceptions/invalid-format-exception.js';
import { FakeParseIntegration } from './mocks/fake-parse-integration.js';

describe(`${Inline.name} > fromAny (parity)`, () => {
    it('throws InvalidFormatException when integration rejects the input', () => {
        const integration = new FakeParseIntegration(false, {});
        expect(() => Inline.fromAny('bad-input', integration)).toThrow(InvalidFormatException);
    });

    it('inline integration override takes precedence over builder integration', () => {
        const builderIntegration = new FakeParseIntegration(true, { from: 'builder' });
        const overrideIntegration = new FakeParseIntegration(true, { from: 'override' });

        const accessor = new Inline()
            .withParserIntegration(builderIntegration)
            .fromAny('raw', overrideIntegration);

        expect(accessor.get('from')).toBe('override');
    });

    it('resolves nested path through AnyAccessor', () => {
        const integration = new FakeParseIntegration(true, { user: { name: 'Alice' } });
        const accessor = Inline.fromAny('raw', integration);
        expect(accessor.get('user.name')).toBe('Alice');
    });

    it('throws InvalidFormatException when no integration is available', () => {
        expect(() => Inline.fromAny('data')).toThrow(InvalidFormatException);
    });

    it('throws InvalidFormatException with guidance message when no integration is set', () => {
        expect(() => Inline.fromAny('data')).toThrow(
            'AnyAccessor requires a ParseIntegrationInterface',
        );
    });
});

describe(`${Inline.name} > fromObject (static)`, () => {
    it('returns correct accessor and resolves property', () => {
        const accessor = Inline.fromObject({ user: { name: 'Alice' } });
        expect(accessor.get('user.name')).toBe('Alice');
    });
});

describe(`${Inline.name} > make (parity)`, () => {
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

describe(`${Inline.name} > getMany (parity)`, () => {
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

describe(`${Inline.name} > getRaw (parity)`, () => {
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
        expect(() => Inline.withStrictMode(true).fromJson('{"__proto__":"injected"}')).toThrow(
            SecurityException,
        );
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

describe(`${Inline.name} > keys (parity)`, () => {
    it('returns string keys for object-keyed data (JS and PHP both return string[])', () => {
        const accessor = Inline.fromJson('{"name":"Alice","age":30}');
        expect(accessor.keys()).toEqual(['name', 'age']);
    });

    it('returns numeric indices as strings for NDJSON (parity with PHP array_map strval fix)', () => {
        const accessor = Inline.fromNdjson('{"name":"Alice"}\n{"name":"Bob"}');
        expect(accessor.keys()).toEqual(['0', '1']);
    });
});

describe(`${Inline.name} > PathQuery > wildcard (parity)`, () => {
    it('expands all children with a wildcard', () => {
        const accessor = Inline.fromArray({ users: [{ name: 'Alice' }, { name: 'Bob' }] });
        expect(accessor.get('users.*.name')).toEqual(['Alice', 'Bob']);
    });

    it('returns null for a wildcard on a scalar value', () => {
        const accessor = Inline.fromArray({ x: 42 });
        expect(accessor.get('x.*')).toBeNull();
    });
});

describe(`${Inline.name} > PathQuery > filter (parity)`, () => {
    it('filters array items that satisfy a condition', () => {
        const accessor = Inline.fromArray({
            items: [
                { name: 'Alice', age: 30 },
                { name: 'Bob', age: 20 },
                { name: 'Charlie', age: 35 },
            ],
        });
        expect(accessor.get('items[?age > 25].name')).toEqual(['Alice', 'Charlie']);
    });

    it('returns empty array when no items match the filter', () => {
        const accessor = Inline.fromArray({
            items: [{ name: 'Alice', age: 10 }],
        });
        expect(accessor.get('items[?age > 100]')).toEqual([]);
    });

    it('filters with equality on a string field', () => {
        const accessor = Inline.fromArray({
            users: [
                { role: 'admin', name: 'Alice' },
                { role: 'user', name: 'Bob' },
            ],
        });
        expect(accessor.get("users[?role == 'admin'].name")).toEqual(['Alice']);
    });

    it('filters with logical AND', () => {
        const accessor = Inline.fromArray({
            items: [
                { a: 1, b: 2 },
                { a: 1, b: 5 },
                { a: 3, b: 2 },
            ],
        });
        expect(accessor.get('items[?a == 1 && b == 2]')).toEqual([{ a: 1, b: 2 }]);
    });

    it('filters with starts_with function', () => {
        const accessor = Inline.fromArray({
            items: [{ name: 'Alice' }, { name: 'Anna' }, { name: 'Bob' }],
        });
        expect(accessor.get("items[?starts_with(@.name, 'A')].name")).toEqual(['Alice', 'Anna']);
    });

    it('filters with contains function on a string', () => {
        const accessor = Inline.fromArray({
            items: [{ tag: 'hello-world' }, { tag: 'foo-bar' }],
        });
        expect(accessor.get("items[?contains(@.tag, 'world')].tag")).toEqual(['hello-world']);
    });
});

describe(`${Inline.name} > PathQuery > multi-key and multi-index (parity)`, () => {
    it("selects multiple keys with ['a','b']", () => {
        const accessor = Inline.fromArray({ a: 1, b: 2, c: 3 });
        expect(accessor.get("['a','b']")).toEqual([1, 2]);
    });

    it('selects multiple indices [0,2]', () => {
        const accessor = Inline.fromArray({ items: ['x', 'y', 'z'] });
        expect(accessor.get('items[0,2]')).toEqual(['x', 'z']);
    });

    it('resolves a negative index [-1] as a key lookup', () => {
        const accessor = Inline.fromArray({ items: ['a', 'b', 'c'] });
        expect(accessor.get('items[-1]')).toBeNull();
    });
});

describe(`${Inline.name} > PathQuery > slice (parity)`, () => {
    it('slices an array [1:3]', () => {
        const accessor = Inline.fromArray({ items: [10, 20, 30, 40, 50] });
        expect(accessor.get('items[1:3]')).toEqual([20, 30]);
    });

    it('slices with a step [0:6:2]', () => {
        const accessor = Inline.fromArray({ items: [0, 1, 2, 3, 4, 5] });
        expect(accessor.get('items[0:6:2]')).toEqual([0, 2, 4]);
    });

    it('returns null for a slice on a scalar', () => {
        const accessor = Inline.fromArray({ x: 'hello' });
        expect(accessor.get('x[0:2]')).toBeNull();
    });
});

describe(`${Inline.name} > PathQuery > recursive descent (parity)`, () => {
    it('collects all values for a recursive descent key', () => {
        const accessor = Inline.fromArray({
            a: { name: 'top' },
            b: { nested: { name: 'deep' } },
        });
        expect(accessor.get('..name')).toEqual(['top', 'deep']);
    });

    it('collects values for DescentMulti with multiple keys', () => {
        const accessor = Inline.fromArray({
            a: { x: 1, y: 2 },
            b: { x: 3, z: 4 },
        });
        const result = accessor.get("..['x','y']") as number[];
        expect(result).toEqual([1, 3, 2]);
    });
});

describe(`${Inline.name} > PathQuery > projection (parity)`, () => {
    it('projects specific fields from a map', () => {
        const accessor = Inline.fromArray({ name: 'Alice', age: 30, city: 'NYC' });
        expect(accessor.get('.{name,age}')).toEqual({ name: 'Alice', age: 30 });
    });

    it('projects fields with an alias', () => {
        const accessor = Inline.fromArray({ name: 'Alice', age: 30 });
        expect(accessor.get('.{fullName: name, years: age}')).toEqual({
            fullName: 'Alice',
            years: 30,
        });
    });

    it('projects fields from a list of items', () => {
        const accessor = Inline.fromArray({
            users: [
                { name: 'Alice', age: 30 },
                { name: 'Bob', age: 25 },
            ],
        });
        expect(accessor.get('users.{name}')).toEqual([{ name: 'Alice' }, { name: 'Bob' }]);
    });

    it('sets projected field to null when source key is missing', () => {
        const accessor = Inline.fromArray({ name: 'Alice' });
        expect(accessor.get('.{name,missing}')).toEqual({ name: 'Alice', missing: null });
    });
});

describe(`${Inline.name} > PathQuery > bracket notation (parity)`, () => {
    it('resolves a bracket numeric index [0]', () => {
        const accessor = Inline.fromArray({ items: ['a', 'b', 'c'] });
        expect(accessor.get('items[0]')).toBe('a');
    });

    it("resolves a bracket quoted string key ['key']", () => {
        const accessor = Inline.fromArray({ key: 'value' });
        expect(accessor.get("['key']")).toBe('value');
    });
});

describe(`${Inline.name} > PathQuery > combined queries (parity)`, () => {
    it('chains filter with wildcard', () => {
        const accessor = Inline.fromArray({
            items: [{ tags: ['a', 'b'] }, { tags: ['c'] }],
        });
        expect(accessor.get('items.*.tags[0]')).toEqual(['a', 'c']);
    });

    it('uses default value when path does not exist', () => {
        const accessor = Inline.fromArray({ a: 1 });
        expect(accessor.get('missing.path', 'fallback')).toBe('fallback');
    });

    it('resolves deeply nested path through multiple levels', () => {
        const accessor = Inline.fromArray({
            level1: { level2: { level3: { value: 'deep' } } },
        });
        expect(accessor.get('level1.level2.level3.value')).toBe('deep');
    });
});
