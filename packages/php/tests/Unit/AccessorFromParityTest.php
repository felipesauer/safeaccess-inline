<?php

declare(strict_types=1);

use SafeAccess\Inline\Accessors\AbstractAccessor;
use SafeAccess\Inline\Exceptions\InvalidFormatException;
use SafeAccess\Inline\Tests\Mocks\FakeParseIntegration;

describe(AbstractAccessor::class . '::from() > ArrayAccessor (parity)', function (): void {
    it('hydrates from a PHP array and resolves a key', function (): void {
        expect(factory()->array(['name' => 'Alice'])->get('name'))->toBe('Alice');
    });

    it('throws InvalidFormatException for a non-array non-object input', function (): void {
        expect(fn () => factory()->array('not-an-array'))->toThrow(InvalidFormatException::class);
    });
});

describe(AbstractAccessor::class . '::from() > ObjectAccessor (parity)', function (): void {
    it('hydrates from a PHP object and resolves a property', function (): void {
        expect(factory()->object((object) ['name' => 'Alice'])->get('name'))->toBe('Alice');
    });

    it('throws InvalidFormatException for an integer input', function (): void {
        expect(fn () => factory()->object(42))->toThrow(InvalidFormatException::class);
    });
});

describe(AbstractAccessor::class . '::from() > JsonAccessor (parity)', function (): void {
    it('hydrates from a JSON string and resolves a key', function (): void {
        expect(factory()->json('{"name":"Alice"}')->get('name'))->toBe('Alice');
    });

    it('throws InvalidFormatException for an integer input', function (): void {
        expect(fn () => factory()->json(42))->toThrow(InvalidFormatException::class);
    });
});

describe(AbstractAccessor::class . '::from() > XmlAccessor (parity)', function (): void {
    it('hydrates from an XML string and resolves an element', function (): void {
        expect(factory()->xml('<root><name>Alice</name></root>')->get('name'))->toBe('Alice');
    });

    it('throws InvalidFormatException for an integer input', function (): void {
        expect(fn () => factory()->xml(42))->toThrow(InvalidFormatException::class);
    });
});

describe(AbstractAccessor::class . '::from() > YamlAccessor (parity)', function (): void {
    it('hydrates from a YAML string and resolves a key', function (): void {
        expect(factory()->yaml("name: Alice\n")->get('name'))->toBe('Alice');
    });

    it('throws InvalidFormatException for an integer input', function (): void {
        expect(fn () => factory()->yaml(42))->toThrow(InvalidFormatException::class);
    });
});

describe(AbstractAccessor::class . '::from() > IniAccessor (parity)', function (): void {
    it('hydrates from an INI string and resolves a key', function (): void {
        expect(factory()->ini("[s]\nname=Alice")->get('s.name'))->toBe('Alice');
    });

    it('throws InvalidFormatException for an integer input', function (): void {
        expect(fn () => factory()->ini(42))->toThrow(InvalidFormatException::class);
    });
});

describe(AbstractAccessor::class . '::from() > EnvAccessor (parity)', function (): void {
    it('hydrates from a dotenv string and resolves a key', function (): void {
        expect(factory()->env("NAME=Alice\n")->get('NAME'))->toBe('Alice');
    });

    it('throws InvalidFormatException for an integer input', function (): void {
        expect(fn () => factory()->env(42))->toThrow(InvalidFormatException::class);
    });
});

describe(AbstractAccessor::class . '::from() > NdjsonAccessor (parity)', function (): void {
    it('hydrates from an NDJSON string and resolves via index', function (): void {
        expect(factory()->ndjson('{"name":"Alice"}')->get('0.name'))->toBe('Alice');
    });

    it('throws InvalidFormatException for an integer input', function (): void {
        expect(fn () => factory()->ndjson(42))->toThrow(InvalidFormatException::class);
    });
});

describe(AbstractAccessor::class . '::from() > AnyAccessor (parity)', function (): void {
    it('hydrates via integration and resolves a key', function (): void {
        $integration = new FakeParseIntegration(accepts: true, parsed: ['name' => 'Alice']);
        expect(factory()->any('raw', $integration)->get('name'))->toBe('Alice');
    });

    it('throws InvalidFormatException when the integration rejects the input', function (): void {
        $integration = new FakeParseIntegration(accepts: false, parsed: []);
        expect(fn () => factory()->any('bad', $integration))->toThrow(InvalidFormatException::class);
    });
});
