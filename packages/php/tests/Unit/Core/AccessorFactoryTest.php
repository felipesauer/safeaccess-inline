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
use SafeAccess\Inline\Core\AccessorFactory;
use SafeAccess\Inline\Exceptions\InvalidFormatException;
use SafeAccess\Inline\Tests\Mocks\FakeParseIntegration;

function makeFactory(?FakeParseIntegration $integration = null): AccessorFactory
{
    return (new \SafeAccess\Inline\Core\InlineBuilderAccessor())
        ->builder();
}

describe(AccessorFactory::class, function (): void {
    beforeEach(function (): void {
        $this->factory = makeFactory();
        $this->integration = new FakeParseIntegration(
            accepts: true,
            parsed: ['key' => 'value'],
        );
    });

    // array()
    describe(AccessorFactory::class . ' > array', function (): void {
        it('returns an ArrayAccessor from an array', function (): void {
            $accessor = $this->factory->array(['name' => 'Alice']);

            expect($accessor)->toBeInstanceOf(ArrayAccessor::class);
        });

        it('resolves a key from array data', function (): void {
            $accessor = $this->factory->array(['city' => 'Porto Alegre']);

            expect($accessor->get('city'))->toBe('Porto Alegre');
        });
    });

    // object()
    describe(AccessorFactory::class . ' > object', function (): void {
        it('returns an ObjectAccessor from an object', function (): void {
            $obj = (object) ['name' => 'Alice'];

            $accessor = $this->factory->object($obj);

            expect($accessor)->toBeInstanceOf(ObjectAccessor::class);
        });

        it('resolves a property from object data', function (): void {
            $obj = (object) ['city' => 'Porto'];

            $accessor = $this->factory->object($obj);

            expect($accessor->get('city'))->toBe('Porto');
        });
    });

    // json()
    describe(AccessorFactory::class . ' > json', function (): void {
        it('returns a JsonAccessor from a JSON string', function (): void {
            $accessor = $this->factory->json('{"name":"Alice"}');

            expect($accessor)->toBeInstanceOf(JsonAccessor::class);
        });

        it('resolves a key from JSON data', function (): void {
            $accessor = $this->factory->json('{"city":"Porto"}');

            expect($accessor->get('city'))->toBe('Porto');
        });
    });

    // xml()
    describe(AccessorFactory::class . ' > xml', function (): void {
        it('returns an XmlAccessor from an XML string', function (): void {
            $accessor = $this->factory->xml('<root><name>Alice</name></root>');

            expect($accessor)->toBeInstanceOf(XmlAccessor::class);
        });

        it('resolves an element from XML data', function (): void {
            $accessor = $this->factory->xml('<root><city>Porto</city></root>');

            expect($accessor->get('city'))->toBe('Porto');
        });
    });

    // yaml()
    describe(AccessorFactory::class . ' > yaml', function (): void {
        it('returns a YamlAccessor from a YAML string', function (): void {
            $accessor = $this->factory->yaml("name: Alice\n");

            expect($accessor)->toBeInstanceOf(YamlAccessor::class);
        });

        it('resolves a key from YAML data', function (): void {
            $accessor = $this->factory->yaml("city: Porto\n");

            expect($accessor->get('city'))->toBe('Porto');
        });
    });

    // ini()
    describe(AccessorFactory::class . ' > ini', function (): void {
        it('returns an IniAccessor from an INI string', function (): void {
            $accessor = $this->factory->ini("name=Alice\n");

            expect($accessor)->toBeInstanceOf(IniAccessor::class);
        });

        it('resolves a key from INI data', function (): void {
            $accessor = $this->factory->ini("city=Porto\n");

            expect($accessor->get('city'))->toBe('Porto');
        });
    });

    // env()
    describe(AccessorFactory::class . ' > env', function (): void {
        it('returns an EnvAccessor from an env string', function (): void {
            $accessor = $this->factory->env("NAME=Alice\n");

            expect($accessor)->toBeInstanceOf(EnvAccessor::class);
        });

        it('resolves a key from env data', function (): void {
            $accessor = $this->factory->env("CITY=Porto\n");

            expect($accessor->get('CITY'))->toBe('Porto');
        });
    });

    // ndjson()
    describe(AccessorFactory::class . ' > ndjson', function (): void {
        it('returns an NdjsonAccessor from an NDJSON string', function (): void {
            $accessor = $this->factory->ndjson("{\"a\":1}\n{\"b\":2}\n");

            expect($accessor)->toBeInstanceOf(NdjsonAccessor::class);
        });

        it('resolves an index from NDJSON data', function (): void {
            $accessor = $this->factory->ndjson("{\"name\":\"Alice\"}\n");

            expect($accessor->get('0.name'))->toBe('Alice');
        });
    });

    // any()
    describe(AccessorFactory::class . ' > any', function (): void {
        it('returns an AnyAccessor when a valid integration is provided', function (): void {
            $builder = (new \SafeAccess\Inline\Core\InlineBuilderAccessor())
                ->withParserIntegration($this->integration)
                ->builder();

            $accessor = $builder->any(['key' => 'value']);

            expect($accessor)->toBeInstanceOf(AnyAccessor::class);
        });

        it('throws InvalidFormatException when no integration is available', function (): void {
            expect(fn () => $this->factory->any(['key' => 'value']))
                ->toThrow(InvalidFormatException::class);
        });

        it('throws InvalidFormatException when the integration rejects the format', function (): void {
            $rejecting = new FakeParseIntegration(accepts: false);
            $builder = (new \SafeAccess\Inline\Core\InlineBuilderAccessor())
                ->withParserIntegration($rejecting)
                ->builder();

            expect(fn () => $builder->any(['key' => 'value']))
                ->toThrow(InvalidFormatException::class);
        });
    });
});
