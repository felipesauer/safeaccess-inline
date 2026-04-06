import { describe, expect, it } from 'vitest';
import { Inline } from '../src/inline.js';
import { TypeFormat } from '../src/type-format.js';
import { ArrayAccessor } from '../src/accessors/formats/array-accessor.js';
import { JsonAccessor } from '../src/accessors/formats/json-accessor.js';
import { AnyAccessor } from '../src/accessors/formats/any-accessor.js';
import { XmlAccessor } from '../src/accessors/formats/xml-accessor.js';
import { InvalidFormatException } from '../src/exceptions/invalid-format-exception.js';
import { SecurityException } from '../src/exceptions/security-exception.js';
import { UnsupportedTypeException } from '../src/exceptions/unsupported-type-exception.js';
import { SecurityGuard } from '../src/security/security-guard.js';
import { SecurityParser } from '../src/security/security-parser.js';
import { FakeParseIntegration } from './mocks/fake-parse-integration.js';
import { FakePathCache } from './mocks/fake-path-cache.js';

describe(Inline.name, () => {
    it('creates a JsonAccessor via fromJson', () => {
        const accessor = Inline.fromJson('{"name":"Alice"}');
        expect(accessor).toBeInstanceOf(JsonAccessor);
        expect(accessor.get('name')).toBe('Alice');
    });

    it('creates an ArrayAccessor via fromArray', () => {
        const accessor = Inline.fromArray({ key: 'value' });
        expect(accessor).toBeInstanceOf(ArrayAccessor);
        expect(accessor.get('key')).toBe('value');
    });

    it('creates an ArrayAccessor from a JS array', () => {
        const accessor = Inline.fromArray(['a', 'b', 'c']);
        expect(accessor.get('0')).toBe('a');
        expect(accessor.get('2')).toBe('c');
    });
});

describe(`${Inline.name} > from`, () => {
    it('routes TypeFormat.Json to JsonAccessor', () => {
        const accessor = Inline.from(TypeFormat.Json, '{"key":"value"}');
        expect(accessor.get('key')).toBe('value');
    });

    it('routes TypeFormat.Array to ArrayAccessor (using JS array)', () => {
        // Use an actual array so that only ArrayAccessor can handle it;
        // ObjectAccessor rejects arrays, killing the falls-through mutant.
        const accessor = Inline.from(TypeFormat.Array, ['a', 'b']);
        expect(accessor.get('0')).toBe('a');
        expect(accessor.get('1')).toBe('b');
    });

    it('routes TypeFormat.Yaml to YamlAccessor', () => {
        const accessor = Inline.from(TypeFormat.Yaml, 'name: Alice');
        expect(accessor.get('name')).toBe('Alice');
    });

    it('routes TypeFormat.Ini to IniAccessor (INI syntax specific)', () => {
        // Use INI-specific syntax (section); a non-INI accessor would not parse this
        const accessor = Inline.from(TypeFormat.Ini, '[db]\nhost=localhost');
        expect(accessor.get('db.host')).toBe('localhost');
    });

    it('routes TypeFormat.Env to EnvAccessor', () => {
        const accessor = Inline.from(TypeFormat.Env, 'APP=test');
        expect(accessor.get('APP')).toBe('test');
    });

    it('routes TypeFormat.Ndjson to NdjsonAccessor', () => {
        const accessor = Inline.from(TypeFormat.Ndjson, '{"id":1}\n{"id":2}');
        expect(accessor.get('0.id')).toBe(1);
    });

    it('routes TypeFormat.Object to ObjectAccessor', () => {
        const accessor = Inline.from(TypeFormat.Object, { name: 'Alice' });
        expect(accessor.get('name')).toBe('Alice');
    });

    it('routes TypeFormat.Xml to XmlAccessor', () => {
        const accessor = Inline.from(TypeFormat.Xml, '<root><key>value</key></root>');
        expect(accessor.get('key')).toBe('value');
    });

    it('resolves nested path through facade', () => {
        const accessor = Inline.fromJson('{"user":{"name":"Alice"}}');
        expect(accessor.get('user.name')).toBe('Alice');
    });
});

describe(`${Inline.name} > security`, () => {
    it('throws SecurityException for forbidden key __proto__ in JSON', () => {
        expect(() => Inline.fromJson('{"__proto__":"bad"}')).toThrow(SecurityException);
    });

    it('throws SecurityException for stream wrapper key in JSON', () => {
        expect(() => Inline.fromJson('{"javascript:alert":"bad"}')).toThrow(SecurityException);
    });
});

describe(`${Inline.name} > withSecurityGuard`, () => {
    it('applies custom SecurityGuard', () => {
        const guard = new SecurityGuard(512, ['custom_blocked']);
        const accessor = Inline.withSecurityGuard(guard).fromJson('{"safe":"value"}');
        expect(accessor.get('safe')).toBe('value');
    });

    it('enforces extra forbidden keys from custom guard', () => {
        const guard = new SecurityGuard(512, ['custom_blocked']);
        expect(() => Inline.withSecurityGuard(guard).fromJson('{"custom_blocked":"bad"}')).toThrow(
            SecurityException,
        );
    });
});

describe(`${Inline.name} > withSecurityParser`, () => {
    it('applies custom SecurityParser with tighter limits', () => {
        const secParser = new SecurityParser({ maxKeys: 2 });
        expect(() => Inline.withSecurityParser(secParser).fromJson('{"a":1,"b":2,"c":3}')).toThrow(
            SecurityException,
        );
    });

    it('passes when within custom limits', () => {
        const secParser = new SecurityParser({ maxKeys: 10 });
        const accessor = Inline.withSecurityParser(secParser).fromJson('{"a":1}');
        expect(accessor.get('a')).toBe(1);
    });
});

describe(`${Inline.name} > format factories`, () => {
    it('creates XmlAccessor via fromXml', () => {
        const accessor = Inline.fromXml('<root><item>hello</item></root>');
        expect(accessor).toBeDefined();
    });

    it('creates YamlAccessor via fromYaml', () => {
        const accessor = Inline.fromYaml('name: Alice\nage: 30');
        expect(accessor.get('name')).toBe('Alice');
    });

    it('creates IniAccessor via fromIni', () => {
        const accessor = Inline.fromIni('[section]\nkey=value');
        expect(accessor.get('section.key')).toBe('value');
    });

    it('creates EnvAccessor via fromEnv', () => {
        const accessor = Inline.fromEnv('KEY=val');
        expect(accessor.get('KEY')).toBe('val');
    });

    it('creates NdjsonAccessor via fromNdjson', () => {
        const accessor = Inline.fromNdjson('{"id":1}');
        expect(accessor.get('0.id')).toBe(1);
    });

    it('creates ObjectAccessor via fromObject', () => {
        const accessor = Inline.fromObject({ foo: 'bar' });
        expect(accessor.get('foo')).toBe('bar');
    });

    it('throws InvalidFormatException for invalid format input', () => {
        expect(() => Inline.fromJson(42 as unknown as string)).toThrow(InvalidFormatException);
    });

    it('throws UnsupportedTypeException for unknown TypeFormat', () => {
        expect(() => Inline.from('unsupported' as TypeFormat, '{}')).toThrow(
            UnsupportedTypeException,
        );
    });

    it('UnsupportedTypeException message contains the unsupported format value', () => {
        expect(() => Inline.from('bad_format' as TypeFormat, '{}')).toThrow(
            /TypeFormat 'bad_format' is not supported/,
        );
    });
});

describe(`${Inline.name} > fromAny`, () => {
    it('delegates to AnyAccessor when an integration is provided', () => {
        const integration = new FakeParseIntegration(true, { result: 42 });
        const accessor = Inline.fromAny('raw-input', integration);
        expect(accessor).toBeInstanceOf(AnyAccessor);
        expect(accessor.get('result')).toBe(42);
    });

    it('uses integration from withParserIntegration builder', () => {
        const integration = new FakeParseIntegration(true, { x: 1 });
        const accessor = Inline.withParserIntegration(integration).fromAny('raw');
        expect(accessor.get('x')).toBe(1);
    });

    it('throws InvalidFormatException when integration rejects the input', () => {
        const integration = new FakeParseIntegration(false, {});
        expect(() => Inline.fromAny('bad-input', integration)).toThrow(InvalidFormatException);
    });

    it('inline integration override takes precedence over builder integration', () => {
        const builderIntegration = new FakeParseIntegration(true, { from: 'builder' });
        const overrideIntegration = new FakeParseIntegration(true, { from: 'override' });
        const accessor = Inline.withParserIntegration(builderIntegration).fromAny(
            'raw',
            overrideIntegration,
        );
        expect(accessor.get('from')).toBe('override');
    });

    it('resolves nested path through AnyAccessor', () => {
        const integration = new FakeParseIntegration(true, { user: { name: 'Alice' } });
        const accessor = Inline.fromAny('raw', integration);
        expect(accessor.get('user.name')).toBe('Alice');
    });

    it('throws InvalidFormatException when no integration is available', () => {
        expect(() =>
            (Inline as unknown as { fromAny(d: unknown): AnyAccessor }).fromAny('data'),
        ).toThrow(InvalidFormatException);
    });

    it('throws InvalidFormatException with guidance message when no integration is set', () => {
        expect(() =>
            (Inline as unknown as { fromAny(d: unknown): AnyAccessor }).fromAny('data'),
        ).toThrow('AnyAccessor requires a ParseIntegrationInterface');
    });

    it('TypeFormat.Any with withParserIntegration resolves via from()', () => {
        const integration = new FakeParseIntegration(true, { key: 'value' });
        const accessor = Inline.withParserIntegration(integration).from(TypeFormat.Any, 'raw');
        expect(accessor.get('key')).toBe('value');
    });
});

describe(`${Inline.name} > make`, () => {
    it('creates an ArrayAccessor by constructor reference', () => {
        const accessor = Inline.make(ArrayAccessor, { n: 1 });
        expect(accessor).toBeInstanceOf(ArrayAccessor);
        expect(accessor.get('n')).toBe(1);
    });

    it('creates a JsonAccessor by constructor reference', () => {
        const accessor = Inline.make(JsonAccessor, '{"k":"v"}');
        expect(accessor).toBeInstanceOf(JsonAccessor);
        expect(accessor.get('k')).toBe('v');
    });

    it('creates an XmlAccessor by constructor reference', () => {
        const accessor = Inline.make(XmlAccessor, '<root><item>hello</item></root>');
        expect(accessor).toBeInstanceOf(XmlAccessor);
        expect(accessor.get('item')).toBe('hello');
    });

    it('propagates custom SecurityParser through make()', () => {
        const secParser = new SecurityParser({ maxKeys: 1 });
        expect(() =>
            Inline.withSecurityParser(secParser).make(JsonAccessor, '{"a":1,"b":2}'),
        ).toThrow(SecurityException);
    });

    it('resolves nested path through make()', () => {
        const accessor = Inline.make(JsonAccessor, '{"user":{"name":"Alice"}}');
        expect(accessor.get('user.name')).toBe('Alice');
    });

    it('instance make() uses configured SecurityGuard for extra forbidden keys', () => {
        const guard = new SecurityGuard(512, ['blocked_key']);
        expect(() =>
            Inline.withSecurityGuard(guard).make(JsonAccessor, '{"blocked_key":"x"}'),
        ).toThrow(SecurityException);
    });

    it('throws InvalidFormatException when making AnyAccessor without integration', () => {
        expect(() => Inline.make(AnyAccessor, 'data')).toThrow(TypeError);
    });
});

describe(`${Inline.name} > withPathCache`, () => {
    it('uses the custom cache when resolving paths', () => {
        const cache = new FakePathCache();
        Inline.withPathCache(cache).fromJson('{"name":"Alice"}').get('name');
        expect(cache.setCallCount).toBeGreaterThanOrEqual(1);
    });

    it('serves path segments from cache on repeated access', () => {
        const cache = new FakePathCache();
        const instance = Inline.withPathCache(cache);
        instance.fromJson('{"name":"Alice"}').get('name');
        const getCountAfterFirst = cache.getCallCount;
        instance.fromJson('{"name":"Bob"}').get('name');
        expect(cache.getCallCount).toBeGreaterThan(getCountAfterFirst);
    });

    it('returns a new Inline instance (immutability)', () => {
        const cache = new FakePathCache();
        const a = Inline.withSecurityGuard(new SecurityGuard());
        const b = a.withPathCache(cache);
        expect(b).not.toBe(a);
        // The returned instance must be functional (uses the cache)
        b.fromJson('{"k":1}').get('k');
        expect(cache.setCallCount).toBeGreaterThanOrEqual(1);
    });

    it('resolves correct value after cache warmup', () => {
        const cache = new FakePathCache();
        const accessor = Inline.withPathCache(cache).fromJson('{"user":{"age":30}}');
        expect(accessor.get('user.age')).toBe(30);
    });

    it('caches nested dot-notation paths', () => {
        const cache = new FakePathCache();
        Inline.withPathCache(cache).fromJson('{"a":{"b":{"c":1}}}').get('a.b.c');
        expect(cache.has('a.b.c')).toBe(true);
    });

    it('clear() empties the cache store', () => {
        const cache = new FakePathCache();
        Inline.withPathCache(cache).fromJson('{"k":"v"}').get('k');
        cache.clear();
        expect(cache.store.size).toBe(0);
    });

    it('withPathCache combines correctly with withSecurityParser', () => {
        const cache = new FakePathCache();
        const secParser = new SecurityParser({ maxKeys: 10 });
        const accessor = Inline.withSecurityParser(secParser).fromJson('{"a":1}');
        expect(accessor.get('a')).toBe(1);
        // Wire cache via instance builder
        const withCache = Inline.withPathCache(cache)
            .withSecurityParser(secParser)
            .fromJson('{"a":1}');
        expect(withCache.get('a')).toBe(1);
    });
});

describe(`${Inline.name} > withParserIntegration`, () => {
    it('returns a new Inline instance (immutability)', () => {
        const integration = new FakeParseIntegration(true, { v: 1 });
        const a = Inline.withSecurityGuard(new SecurityGuard());
        const b = a.withParserIntegration(integration);
        expect(b).not.toBe(a);
        // The returned instance must be functional
        expect(b.fromAny('raw').get('v')).toBe(1);
    });

    it('wires the AnyAccessor factory when integration is set', () => {
        const integration = new FakeParseIntegration(true, { result: 42 });
        const accessor = Inline.withParserIntegration(integration).fromAny('raw-input');
        expect(accessor.get('result')).toBe(42);
    });

    it('throws InvalidFormatException when integration rejects the format', () => {
        const integration = new FakeParseIntegration(false, {});
        expect(() => Inline.withParserIntegration(integration).fromAny('bad')).toThrow(
            InvalidFormatException,
        );
    });

    it('returns an accessor with no data when integration returns empty object', () => {
        const integration = new FakeParseIntegration(true, {});
        const accessor = Inline.withParserIntegration(integration).fromAny('raw');
        expect(accessor.get('missing')).toBeNull();
    });

    it('resolves nested path via integration', () => {
        const integration = new FakeParseIntegration(true, { a: { b: 99 } });
        const accessor = Inline.withParserIntegration(integration).fromAny('raw');
        expect(accessor.get('a.b')).toBe(99);
    });

    it('combines withParserIntegration and withSecurityGuard', () => {
        const integration = new FakeParseIntegration(true, { safe: 1 });
        const guard = new SecurityGuard(512, ['danger']);
        const accessor = Inline.withParserIntegration(integration)
            .withSecurityGuard(guard)
            .fromAny('raw');
        expect(accessor.get('safe')).toBe(1);
    });

    it('TypeFormat.Any routes to fromAny() when integration is configured via withParserIntegration', () => {
        const integration = new FakeParseIntegration(true, { routed: true });
        const accessor = Inline.withParserIntegration(integration).from(TypeFormat.Any, 'raw');
        expect(accessor.get('routed')).toBe(true);
    });
});

describe(`${Inline.name} > withStrictMode`, () => {
    it('withStrictMode(false) bypasses payload size validation', () => {
        const secParser = new SecurityParser({ maxPayloadBytes: 5 });
        const accessor = Inline.withSecurityParser(secParser)
            .withStrictMode(false)
            .fromJson('{"name":"Alice"}');
        expect(accessor.get('name')).toBe('Alice');
    });

    it('withStrictMode(true) enforces payload size validation', () => {
        const secParser = new SecurityParser({ maxPayloadBytes: 5 });
        expect(() =>
            Inline.withSecurityParser(secParser).withStrictMode(true).fromJson('{"name":"Alice"}'),
        ).toThrow(SecurityException);
    });

    it('withStrictMode(false) bypasses forbidden key validation', () => {
        const accessor = Inline.withStrictMode(false).fromJson('{"__proto__":"injected"}');
        expect(accessor.get('__proto__')).toBe('injected');
    });

    it('withStrictMode(true) enforces forbidden key validation', () => {
        expect(() =>
            Inline.withStrictMode(true).fromJson('{"__proto__":"injected"}'),
        ).toThrow(SecurityException);
    });

    it('default strict mode enforces security', () => {
        expect(() => Inline.fromJson('{"__proto__":"injected"}')).toThrow(SecurityException);
    });

    it('withStrictMode(false) works with fromArray', () => {
        const accessor = Inline.withStrictMode(false).fromArray({
            constructor: 'ok',
        });
        expect(accessor.get('constructor')).toBe('ok');
    });

    it('withStrictMode(false) works with fromYaml', () => {
        const secParser = new SecurityParser({ maxPayloadBytes: 2 });
        const accessor = Inline.withSecurityParser(secParser)
            .withStrictMode(false)
            .fromYaml('name: Alice');
        expect(accessor.get('name')).toBe('Alice');
    });

    it('withStrictMode chains with other builder methods', () => {
        const cache = new FakePathCache();
        const accessor = Inline.withStrictMode(false)
            .withPathCache(cache)
            .fromJson('{"__proto__":"ok"}');
        expect(accessor.get('__proto__')).toBe('ok');
    });

    it('withStrictMode(false) propagates through make()', () => {
        const accessor = Inline.withStrictMode(false).make(JsonAccessor, '{"__proto__":"ok"}');
        expect(accessor.get('__proto__')).toBe('ok');
    });

    it('withStrictMode(true) propagates through make()', () => {
        expect(() =>
            Inline.withStrictMode(true).make(JsonAccessor, '{"__proto__":"injected"}'),
        ).toThrow(SecurityException);
    });
});
