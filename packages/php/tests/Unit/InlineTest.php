<?php

declare(strict_types=1);

use SafeAccess\Inline\Accessors\Formats\AnyAccessor;
use SafeAccess\Inline\Accessors\Formats\ArrayAccessor;
use SafeAccess\Inline\Accessors\Formats\EnvAccessor;
use SafeAccess\Inline\Accessors\Formats\IniAccessor;
use SafeAccess\Inline\Accessors\Formats\JsonAccessor;
use SafeAccess\Inline\Accessors\Formats\NdjsonAccessor;
use SafeAccess\Inline\Accessors\Formats\ObjectAccessor;
use SafeAccess\Inline\Accessors\Formats\XmlAccessor;
use SafeAccess\Inline\Accessors\Formats\YamlAccessor;
use SafeAccess\Inline\Enums\TypeFormat;
use SafeAccess\Inline\Exceptions\InvalidFormatException;
use SafeAccess\Inline\Exceptions\UnsupportedTypeException;
use SafeAccess\Inline\Inline;
use SafeAccess\Inline\Tests\Mocks\FakeParseIntegration;
use SafeAccess\Inline\Tests\Mocks\FakePathCache;

describe(Inline::class, function (): void {
    beforeEach(function (): void {
        $this->inline = new Inline();
    });

    // fromArray / fromObject / fromJson / fromXml / fromYaml / fromIni / fromEnv / fromNdjson
    describe(Inline::class . ' > fromXxx instance methods', function (): void {
        it('fromArray returns ArrayAccessor and resolves a key', function (): void {
            $accessor = $this->inline->fromArray(['name' => 'Alice']);

            expect($accessor)->toBeInstanceOf(ArrayAccessor::class);
            expect($accessor->get('name'))->toBe('Alice');
        });

        it('fromObject returns ObjectAccessor and resolves a property', function (): void {
            $accessor = $this->inline->fromObject((object) ['city' => 'Porto']);

            expect($accessor)->toBeInstanceOf(ObjectAccessor::class);
            expect($accessor->get('city'))->toBe('Porto');
        });

        it('fromJson returns JsonAccessor and resolves a key', function (): void {
            $accessor = $this->inline->fromJson('{"name":"Alice"}');

            expect($accessor)->toBeInstanceOf(JsonAccessor::class);
            expect($accessor->get('name'))->toBe('Alice');
        });

        it('fromXml returns XmlAccessor and resolves an element', function (): void {
            $accessor = $this->inline->fromXml('<root><city>Porto</city></root>');

            expect($accessor)->toBeInstanceOf(XmlAccessor::class);
            expect($accessor->get('city'))->toBe('Porto');
        });

        it('fromYaml returns YamlAccessor and resolves a key', function (): void {
            $accessor = $this->inline->fromYaml("name: Alice\n");

            expect($accessor)->toBeInstanceOf(YamlAccessor::class);
            expect($accessor->get('name'))->toBe('Alice');
        });

        it('fromIni returns IniAccessor and resolves a key', function (): void {
            $accessor = $this->inline->fromIni("name=Alice\n");

            expect($accessor)->toBeInstanceOf(IniAccessor::class);
            expect($accessor->get('name'))->toBe('Alice');
        });

        it('fromEnv returns EnvAccessor and resolves a key', function (): void {
            $accessor = $this->inline->fromEnv("NAME=Alice\n");

            expect($accessor)->toBeInstanceOf(EnvAccessor::class);
            expect($accessor->get('NAME'))->toBe('Alice');
        });

        it('fromNdjson returns NdjsonAccessor and resolves via index', function (): void {
            $accessor = $this->inline->fromNdjson("{\"name\":\"Alice\"}\n");

            expect($accessor)->toBeInstanceOf(NdjsonAccessor::class);
            expect($accessor->get('0.name'))->toBe('Alice');
        });
    });

    // fromAny()
    describe(Inline::class . ' > fromAny', function (): void {
        it('delegates to AnyAccessor when an integration is provided', function (): void {
            $integration = new FakeParseIntegration(accepts: true, parsed: ['result' => 42]);

            $accessor = $this->inline
                ->withParserIntegration($integration)
                ->fromAny('raw-input');

            expect($accessor->get('result'))->toBe(42);
        });

        it('accepts an inline integration override', function (): void {
            $integration = new FakeParseIntegration(accepts: true, parsed: ['x' => 1]);

            $accessor = $this->inline->fromAny('raw', $integration);

            expect($accessor->get('x'))->toBe(1);
        });
    });

    // make()
    describe(Inline::class . ' > make', function (): void {
        it('creates an ArrayAccessor by class name', function (): void {
            $accessor = $this->inline->make(ArrayAccessor::class, ['n' => 1]);

            expect($accessor)->toBeInstanceOf(ArrayAccessor::class);
            expect($accessor->get('n'))->toBe(1);
        });

        it('creates a JsonAccessor by class name', function (): void {
            $accessor = $this->inline->make(JsonAccessor::class, '{"k":"v"}');

            expect($accessor)->toBeInstanceOf(JsonAccessor::class);
        });

        it('creates an XmlAccessor by class name', function (): void {
            $accessor = $this->inline->make(XmlAccessor::class, '<root/>');

            expect($accessor)->toBeInstanceOf(XmlAccessor::class);
        });

        it('creates a YamlAccessor by class name', function (): void {
            $accessor = $this->inline->make(YamlAccessor::class, "k: v\n");

            expect($accessor)->toBeInstanceOf(YamlAccessor::class);
        });

        it('creates an IniAccessor by class name', function (): void {
            $accessor = $this->inline->make(IniAccessor::class, "k=v\n");

            expect($accessor)->toBeInstanceOf(IniAccessor::class);
        });

        it('creates an EnvAccessor by class name', function (): void {
            $accessor = $this->inline->make(EnvAccessor::class, "K=V\n");

            expect($accessor)->toBeInstanceOf(EnvAccessor::class);
        });

        it('creates an NdjsonAccessor by class name', function (): void {
            $accessor = $this->inline->make(NdjsonAccessor::class, "{\"a\":1}\n");

            expect($accessor)->toBeInstanceOf(NdjsonAccessor::class);
        });

        it('creates an ObjectAccessor by class name', function (): void {
            $accessor = $this->inline->make(ObjectAccessor::class, (object) ['x' => 1]);

            expect($accessor)->toBeInstanceOf(ObjectAccessor::class);
        });

        it('throws UnsupportedTypeException for an unknown class', function (): void {
            expect(fn () => $this->inline->make(\stdClass::class, []))
                ->toThrow(UnsupportedTypeException::class);
        });

        it('invokes factory->any() for AnyAccessor::class', function (): void {
            expect(fn () => $this->inline->make(AnyAccessor::class, ['a' => 1]))
                ->toThrow(InvalidFormatException::class);
        });
    });

    // from(TypeFormat)
    describe(Inline::class . ' > from(TypeFormat)', function (): void {
        it('creates an ArrayAccessor via TypeFormat::Array', function (): void {
            $accessor = $this->inline->from(TypeFormat::Array, ['k' => 'v']);

            expect($accessor)->toBeInstanceOf(ArrayAccessor::class);
            expect($accessor->get('k'))->toBe('v');
        });

        it('creates an ObjectAccessor via TypeFormat::Object', function (): void {
            $accessor = $this->inline->from(TypeFormat::Object, (object) ['x' => 1]);

            expect($accessor)->toBeInstanceOf(ObjectAccessor::class);
        });

        it('creates a JsonAccessor via TypeFormat::Json', function (): void {
            $accessor = $this->inline->from(TypeFormat::Json, '{"a":1}');

            expect($accessor)->toBeInstanceOf(JsonAccessor::class);
        });

        it('creates an XmlAccessor via TypeFormat::Xml', function (): void {
            $accessor = $this->inline->from(TypeFormat::Xml, '<root/>');

            expect($accessor)->toBeInstanceOf(XmlAccessor::class);
        });

        it('creates a YamlAccessor via TypeFormat::Yaml', function (): void {
            $accessor = $this->inline->from(TypeFormat::Yaml, "k: v\n");

            expect($accessor)->toBeInstanceOf(YamlAccessor::class);
        });

        it('creates an IniAccessor via TypeFormat::Ini', function (): void {
            $accessor = $this->inline->from(TypeFormat::Ini, "k=v\n");

            expect($accessor)->toBeInstanceOf(IniAccessor::class);
        });

        it('creates an EnvAccessor via TypeFormat::Env', function (): void {
            $accessor = $this->inline->from(TypeFormat::Env, "K=V\n");

            expect($accessor)->toBeInstanceOf(EnvAccessor::class);
        });

        it('creates an NdjsonAccessor via TypeFormat::Ndjson', function (): void {
            $accessor = $this->inline->from(TypeFormat::Ndjson, "{\"a\":1}\n");

            expect($accessor)->toBeInstanceOf(NdjsonAccessor::class);
        });

        it('creates an AnyAccessor via TypeFormat::Any when integration is configured', function (): void {
            $integration = new FakeParseIntegration(accepts: true, parsed: ['routed' => true]);

            $accessor = $this->inline
                ->withParserIntegration($integration)
                ->from(TypeFormat::Any, 'raw');

            expect($accessor)->toBeInstanceOf(AnyAccessor::class);
            expect($accessor->get('routed'))->toBeTrue();
        });
    });

    // withPathCache()
    describe(Inline::class . ' > withPathCache', function (): void {
        it('returns a new Inline instance (immutability)', function (): void {
            $cache = new FakePathCache();
            $a = $this->inline->withSecurityGuard(new \SafeAccess\Inline\Security\SecurityGuard());
            $b = $a->withPathCache($cache);

            expect($b)->not->toBe($a);
        });

        it('uses the custom cache when resolving paths', function (): void {
            $cache = new FakePathCache();

            $this->inline->withPathCache($cache)->fromJson('{"name":"Alice"}')->get('name');

            expect($cache->setCallCount)->toBeGreaterThanOrEqual(1);
        });

        it('resolves correct value after cache warmup', function (): void {
            $cache = new FakePathCache();
            $accessor = $this->inline->withPathCache($cache)->fromJson('{"user":{"age":30}}');

            expect($accessor->get('user.age'))->toBe(30);
        });

        it('caches nested dot-notation paths', function (): void {
            $cache = new FakePathCache();
            $this->inline->withPathCache($cache)->fromJson('{"a":{"b":{"c":1}}}')->get('a.b.c');

            expect($cache->has('a.b.c'))->toBeTrue();
        });

        it('clear() empties the cache store', function (): void {
            $cache = new FakePathCache();
            $this->inline->withPathCache($cache)->fromJson('{"k":"v"}')->get('k');
            $cache->clear();

            expect($cache->store)->toBeEmpty();
        });

        it('withPathCache combines correctly with withParserIntegration', function (): void {
            $cache = new FakePathCache();
            $integration = new FakeParseIntegration(accepts: true, parsed: ['a' => 1]);

            $accessor = $this->inline
                ->withPathCache($cache)
                ->withParserIntegration($integration)
                ->fromAny('raw');

            expect($accessor->get('a'))->toBe(1);
        });
    });

    // withStrictMode()
    describe(Inline::class . ' > withStrictMode', function (): void {
        it('withStrictMode(false) bypasses payload size validation', function (): void {
            $tinyParser = new \SafeAccess\Inline\Security\SecurityParser(maxPayloadBytes: 5);

            $accessor = $this->inline
                ->withSecurityParser($tinyParser)
                ->withStrictMode(false)
                ->fromJson('{"name":"Alice"}');

            expect($accessor->get('name'))->toBe('Alice');
        });

        it('withStrictMode(true) enforces payload size validation', function (): void {
            $tinyParser = new \SafeAccess\Inline\Security\SecurityParser(maxPayloadBytes: 5);

            expect(
                fn () => $this->inline
                ->withSecurityParser($tinyParser)
                ->withStrictMode(true)
                ->fromJson('{"name":"Alice"}')
            )->toThrow(\SafeAccess\Inline\Exceptions\SecurityException::class);
        });

        it('withStrictMode(false) bypasses forbidden key validation', function (): void {
            $accessor = $this->inline
                ->withStrictMode(false)
                ->fromJson('{"__construct":"injected"}');

            expect($accessor->get('__construct'))->toBe('injected');
        });

        it('withStrictMode(true) enforces forbidden key validation', function (): void {
            expect(
                fn () => $this->inline
                ->withStrictMode(true)
                ->fromJson('{"__construct":"injected"}')
            )->toThrow(\SafeAccess\Inline\Exceptions\SecurityException::class);
        });

        it('default strict mode enforces security', function (): void {
            expect(
                fn () => $this->inline
                ->fromJson('{"__construct":"injected"}')
            )->toThrow(\SafeAccess\Inline\Exceptions\SecurityException::class);
        });

        it('withStrictMode(false) works with fromArray', function (): void {
            $accessor = $this->inline
                ->withStrictMode(false)
                ->fromArray(['__construct' => 'ok']);

            expect($accessor->get('__construct'))->toBe('ok');
        });

        it('withStrictMode(false) works with fromYaml', function (): void {
            $tinyParser = new \SafeAccess\Inline\Security\SecurityParser(maxPayloadBytes: 2);

            $accessor = $this->inline
                ->withSecurityParser($tinyParser)
                ->withStrictMode(false)
                ->fromYaml("name: Alice\n");

            expect($accessor->get('name'))->toBe('Alice');
        });

        it('withStrictMode chains with other builder methods', function (): void {
            $cache = new FakePathCache();

            $accessor = $this->inline
                ->withStrictMode(false)
                ->withPathCache($cache)
                ->fromJson('{"__construct":"ok"}');

            expect($accessor->get('__construct'))->toBe('ok');
        });

        it('withStrictMode(false) via new instance', function (): void {
            $accessor = (new Inline())->withStrictMode(false)->fromJson('{"__construct":"ok"}');

            expect($accessor->get('__construct'))->toBe('ok');
        });

        it('withStrictMode(false) propagates through make()', function (): void {
            $accessor = $this->inline
                ->withStrictMode(false)
                ->make(JsonAccessor::class, '{"__construct":"ok"}');

            expect($accessor->get('__construct'))->toBe('ok');
        });

        it('withStrictMode(true) propagates through make()', function (): void {
            expect(fn () => $this->inline
                ->withStrictMode(true)
                ->make(JsonAccessor::class, '{"__construct":"injected"}'))
                ->toThrow(\SafeAccess\Inline\Exceptions\SecurityException::class);
        });
    });
});
