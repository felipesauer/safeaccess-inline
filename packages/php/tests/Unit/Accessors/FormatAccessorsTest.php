<?php

declare(strict_types=1);

use SafeAccess\Inline\Accessors\Formats\EnvAccessor;
use SafeAccess\Inline\Accessors\Formats\IniAccessor;
use SafeAccess\Inline\Accessors\Formats\JsonAccessor;
use SafeAccess\Inline\Accessors\Formats\NdjsonAccessor;
use SafeAccess\Inline\Accessors\Formats\ObjectAccessor;
use SafeAccess\Inline\Accessors\Formats\XmlAccessor;
use SafeAccess\Inline\Accessors\Formats\YamlAccessor;
use SafeAccess\Inline\Core\InlineBuilderAccessor;
use SafeAccess\Inline\Exceptions\InvalidFormatException;
use SafeAccess\Inline\Exceptions\SecurityException;
use SafeAccess\Inline\Security\SecurityParser;

function factory(): \SafeAccess\Inline\Core\AccessorFactory
{
    return (new InlineBuilderAccessor())->builder();
}

// JsonAccessor
describe(JsonAccessor::class, function (): void {
    describe(JsonAccessor::class . ' > from', function (): void {
        it('parses a flat JSON string', function (): void {
            $accessor = factory()->json('{"name":"Alice"}');

            expect($accessor->get('name'))->toBe('Alice');
        });

        it('parses nested JSON', function (): void {
            $accessor = factory()->json('{"user":{"city":"Porto"}}');

            expect($accessor->get('user.city'))->toBe('Porto');
        });

        it('stores the raw input', function (): void {
            $raw = '{"name":"Alice"}';
            $accessor = factory()->json($raw);

            expect($accessor->getRaw())->toBe($raw);
        });

        it('throws InvalidFormatException for a non-string input', function (): void {
            expect(fn () => factory()->json(42))
                ->toThrow(InvalidFormatException::class);
        });

        it('throws InvalidFormatException for null input', function (): void {
            expect(fn () => factory()->json(null))
                ->toThrow(InvalidFormatException::class);
        });

        it('throws InvalidFormatException for malformed JSON', function (): void {
            expect(fn () => factory()->json('not-json'))
                ->toThrow(InvalidFormatException::class);
        });
    });
});

// XmlAccessor
describe(XmlAccessor::class, function (): void {
    describe(XmlAccessor::class . ' > from', function (): void {
        it('parses an XML string', function (): void {
            $accessor = factory()->xml('<root><name>Alice</name></root>');

            expect($accessor->get('name'))->toBe('Alice');
        });

        it('parses nested XML', function (): void {
            $accessor = factory()->xml('<root><user><city>Porto</city></user></root>');

            expect($accessor->get('user.city'))->toBe('Porto');
        });

        it('accepts a pre-parsed SimpleXMLElement', function (): void {
            $xml = simplexml_load_string('<root><name>Bob</name></root>');

            $accessor = factory()->xml($xml);

            expect($accessor->get('name'))->toBe('Bob');
        });

        it('stores the raw input', function (): void {
            $raw = '<root><n>1</n></root>';
            $accessor = factory()->xml($raw);

            expect($accessor->getRaw())->toBe($raw);
        });

        it('throws InvalidFormatException for a non-string, non-element input', function (): void {
            expect(fn () => factory()->xml(42))
                ->toThrow(InvalidFormatException::class);
        });

        it('throws InvalidFormatException for null input', function (): void {
            expect(fn () => factory()->xml(null))
                ->toThrow(InvalidFormatException::class);
        });

        it('throws InvalidFormatException for malformed XML', function (): void {
            expect(fn () => factory()->xml('<unclosed'))
                ->toThrow(InvalidFormatException::class);
        });
        it('throws SecurityException when the XML string contains a DOCTYPE declaration', function (): void {
            $xml = '<!DOCTYPE foo [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><root><name>&xxe;</name></root>';

            expect(fn () => factory()->xml($xml))->toThrow(SecurityException::class);
        });

        it('throws SecurityException for a DOCTYPE declaration without an entity', function (): void {
            $xml = '<!DOCTYPE root><root><name>Alice</name></root>';

            expect(fn () => factory()->xml($xml))->toThrow(SecurityException::class);
        });

        it('throws SecurityException for a lowercase doctype declaration', function (): void {
            $xml = '<!doctype root><root><name>Alice</name></root>';

            expect(fn () => factory()->xml($xml))->toThrow(SecurityException::class);
        });

        it('does not throw SecurityException for valid XML without DOCTYPE', function (): void {
            $accessor = factory()->xml('<root><name>Alice</name></root>');

            expect($accessor->get('name'))->toBe('Alice');
        });

        it('throws SecurityException when DOCTYPE has leading whitespace', function (): void {
            $xml = '  <!DOCTYPE root><root><name>Alice</name></root>';

            expect(fn () => factory()->xml($xml))->toThrow(SecurityException::class);
        });

        it('throws SecurityException for mixed-case DOCTYPE declaration', function (): void {
            $xml = '<!DoCTyPe root><root><name>Alice</name></root>';

            expect(fn () => factory()->xml($xml))->toThrow(SecurityException::class);
        });

        it('throws SecurityException for DOCTYPE with SYSTEM URI classic XXE vector', function (): void {
            $xml = '<!DOCTYPE foo SYSTEM "file:///etc/passwd"><root><data>x</data></root>';

            expect(fn () => factory()->xml($xml))->toThrow(SecurityException::class);
        });
        it('throws SecurityException when XML nesting exceeds the configured maxDepth', function (): void {
            // maxDepth=2 allows root + one level inside; three levels of nesting exceeds it
            $builder = (new InlineBuilderAccessor())->withSecurityParser(new SecurityParser(maxDepth: 2));
            $xml = '<root><a><b><c>deep</c></b></a></root>';

            expect(fn () => $builder->builder()->xml($xml))->toThrow(SecurityException::class);
        });

        it('does not throw when XML nesting is within the configured maxDepth', function (): void {
            $builder = (new InlineBuilderAccessor())->withSecurityParser(new SecurityParser(maxDepth: 10));
            $xml = '<root><name>Alice</name></root>';

            $accessor = $builder->builder()->xml($xml);

            expect($accessor->get('name'))->toBe('Alice');
        });

        it('SecurityException message reports the exceeded depth for XML roundtrip', function (): void {
            $builder = (new InlineBuilderAccessor())->withSecurityParser(new SecurityParser(maxDepth: 2));
            $xml = '<root><a><b><c>deep</c></b></a></root>';

            expect(fn () => $builder->builder()->xml($xml))
                ->toThrow(SecurityException::class, 'exceeds maximum');
        });

        it('throws SecurityException for a pre-parsed SimpleXMLElement that exceeds the configured maxDepth', function (): void {
            $builder = (new InlineBuilderAccessor())->withSecurityParser(new SecurityParser(maxDepth: 2));
            $xml = simplexml_load_string('<root><a><b><c>deep</c></b></a></root>');

            expect(fn () => $builder->builder()->xml($xml))->toThrow(SecurityException::class);
        });

        it('does not throw for two-level XML at maxDepth=3 boundary', function (): void {
            // JSON for <root><a><b>v</b></a></root> has depth 2: {"a":{"b":"v"}} → passes with maxDepth=3
            $builder = (new InlineBuilderAccessor())->withSecurityParser(new SecurityParser(maxDepth: 3));
            $xml = '<root><a><b>val</b></a></root>';

            $accessor = $builder->builder()->xml($xml);

            expect($accessor->get('a.b'))->toBe('val');
        });

        it('does not throw for XML with default SecurityParser settings', function (): void {
            $xml = '<root><a><b><c><d>deep</d></c></b></a></root>';

            $accessor = factory()->xml($xml);

            expect($accessor->get('a.b.c.d'))->toBe('deep');
        });
    });
});

// YamlAccessor
describe(YamlAccessor::class, function (): void {
    describe(YamlAccessor::class . ' > from', function (): void {
        it('parses a flat YAML string', function (): void {
            $accessor = factory()->yaml("name: Alice\n");

            expect($accessor->get('name'))->toBe('Alice');
        });

        it('parses nested YAML', function (): void {
            $accessor = factory()->yaml("user:\n  city: Porto\n");

            expect($accessor->get('user.city'))->toBe('Porto');
        });

        it('stores the raw input', function (): void {
            $raw = "name: Alice\n";
            $accessor = factory()->yaml($raw);

            expect($accessor->getRaw())->toBe($raw);
        });

        it('throws InvalidFormatException for a non-string input', function (): void {
            expect(fn () => factory()->yaml(42))
                ->toThrow(InvalidFormatException::class);
        });

        it('throws InvalidFormatException for null input', function (): void {
            expect(fn () => factory()->yaml(null))
                ->toThrow(InvalidFormatException::class);
        });

        it('throws InvalidFormatException for YAML with unsafe constructs (tag)', function (): void {
            expect(fn () => factory()->yaml("name: !!str Alice\n"))
                ->toThrow(InvalidFormatException::class);
        });
    });
});

// IniAccessor
describe(IniAccessor::class, function (): void {
    describe(IniAccessor::class . ' > from', function (): void {
        it('parses a flat INI string', function (): void {
            $accessor = factory()->ini("name=Alice\nage=30\n");

            expect($accessor->get('name'))->toBe('Alice');
            expect($accessor->get('age'))->toBe(30);
        });

        it('parses section-based INI', function (): void {
            $accessor = factory()->ini("[user]\nname=Alice\n");

            expect($accessor->get('user.name'))->toBe('Alice');
        });

        it('stores the raw input', function (): void {
            $raw = "key=val\n";
            $accessor = factory()->ini($raw);

            expect($accessor->getRaw())->toBe($raw);
        });

        it('throws InvalidFormatException for a non-string input', function (): void {
            expect(fn () => factory()->ini(42))
                ->toThrow(InvalidFormatException::class);
        });

        it('throws InvalidFormatException for null input', function (): void {
            expect(fn () => factory()->ini(null))
                ->toThrow(InvalidFormatException::class);
        });

        it('throws InvalidFormatException when parse_ini_string returns false', function (): void {
            expect(fn () => factory()->ini('[unclosed'))
                ->toThrow(InvalidFormatException::class);
        });
    });
});

// EnvAccessor
describe(EnvAccessor::class, function (): void {
    describe(EnvAccessor::class . ' > from', function (): void {
        it('parses a simple .env string', function (): void {
            $accessor = factory()->env("NAME=Alice\nCITY=Porto\n");

            expect($accessor->get('NAME'))->toBe('Alice');
            expect($accessor->get('CITY'))->toBe('Porto');
        });

        it('parses quoted .env values', function (): void {
            $accessor = factory()->env("MESSAGE=\"Hello World\"\n");

            expect($accessor->get('MESSAGE'))->toBe('Hello World');
        });

        it('stores the raw input', function (): void {
            $raw = "KEY=value\n";
            $accessor = factory()->env($raw);

            expect($accessor->getRaw())->toBe($raw);
        });

        it('throws InvalidFormatException for a non-string input', function (): void {
            expect(fn () => factory()->env(42))
                ->toThrow(InvalidFormatException::class);
        });

        it('throws InvalidFormatException for null input', function (): void {
            expect(fn () => factory()->env(null))
                ->toThrow(InvalidFormatException::class);
        });

        it('skips lines that contain no equals sign', function (): void {
            $accessor = factory()->env("NO_EQUALS_HERE\nKEY=value\n");

            expect($accessor->get('KEY'))->toBe('value');
            expect($accessor->get('NO_EQUALS_HERE', 'missing'))->toBe('missing');
        });
    });
});

// NdjsonAccessor
describe(NdjsonAccessor::class, function (): void {
    describe(NdjsonAccessor::class . ' > from', function (): void {
        it('parses a single NDJSON line', function (): void {
            $accessor = factory()->ndjson("{\"name\":\"Alice\"}\n");

            expect($accessor->get('0.name'))->toBe('Alice');
        });

        it('parses multiple NDJSON lines', function (): void {
            $accessor = factory()->ndjson("{\"name\":\"Alice\"}\n{\"name\":\"Bob\"}\n");

            expect($accessor->get('1.name'))->toBe('Bob');
        });

        it('stores the raw input', function (): void {
            $raw = "{\"a\":1}\n";
            $accessor = factory()->ndjson($raw);

            expect($accessor->getRaw())->toBe($raw);
        });

        it('throws InvalidFormatException for a non-string input', function (): void {
            expect(fn () => factory()->ndjson(42))
                ->toThrow(InvalidFormatException::class);
        });

        it('throws InvalidFormatException for null input', function (): void {
            expect(fn () => factory()->ndjson(null))
                ->toThrow(InvalidFormatException::class);
        });

        it('throws InvalidFormatException for malformed NDJSON', function (): void {
            expect(fn () => factory()->ndjson("not-json\n"))
                ->toThrow(InvalidFormatException::class);
        });

        it('returns an empty accessor for a string containing only blank lines', function (): void {
            $accessor = factory()->ndjson("\n\n");

            expect($accessor->get('0', 'none'))->toBe('none');
        });

        it('keys() returns numeric line positions as strings (parity with JS Object.keys)', function (): void {
            $accessor = factory()->ndjson("{\"name\":\"Alice\"}\n{\"name\":\"Bob\"}");

            expect($accessor->keys())->toBe(['0', '1']);
        });
    });
});

// ObjectAccessor
describe(ObjectAccessor::class, function (): void {
    describe(ObjectAccessor::class . ' > from', function (): void {
        it('parses a stdClass object', function (): void {
            $obj = (object) ['name' => 'Alice'];
            $accessor = factory()->object($obj);

            expect($accessor->get('name'))->toBe('Alice');
        });

        it('parses nested object properties', function (): void {
            $obj = (object) ['user' => (object) ['city' => 'Porto']];
            $accessor = factory()->object($obj);

            expect($accessor->get('user.city'))->toBe('Porto');
        });

        it('stores the raw input', function (): void {
            $obj = (object) ['key' => 'val'];
            $accessor = factory()->object($obj);

            expect($accessor->getRaw())->toBe($obj);
        });

        it('throws InvalidFormatException for an array input', function (): void {
            expect(fn () => factory()->object(['key' => 'val']))
                ->toThrow(InvalidFormatException::class);
        });

        it('throws InvalidFormatException for a string input', function (): void {
            expect(fn () => factory()->object('not-an-object'))
                ->toThrow(InvalidFormatException::class);
        });

        it('throws InvalidFormatException for null input', function (): void {
            expect(fn () => factory()->object(null))
                ->toThrow(InvalidFormatException::class);
        });

        it('converts an object with a nested object property', function (): void {
            $obj = (object) ['outer' => (object) ['inner' => 42]];
            $accessor = factory()->object($obj);

            expect($accessor->get('outer.inner'))->toBe(42);
        });

        it('converts an object with an array property containing objects', function (): void {
            $obj = (object) ['items' => [(object) ['x' => 1], (object) ['x' => 2]]];
            $accessor = factory()->object($obj);

            expect($accessor->get('items.0.x'))->toBe(1);
            expect($accessor->get('items.1.x'))->toBe(2);
        });

        it('converts an object with an array property containing nested sub-arrays', function (): void {
            $obj = (object) ['data' => [['a' => 1], ['b' => 2]]];
            $accessor = factory()->object($obj);

            expect($accessor->get('data.0.a'))->toBe(1);
            expect($accessor->get('data.1.b'))->toBe(2);
        });
        it('throws SecurityException when object nesting exceeds the configured maxDepth', function (): void {
            $builder = (new InlineBuilderAccessor())->withSecurityParser(new SecurityParser(maxDepth: 1));

            // depth=0 root → depth=1 inner → depth=2 exceeds maxDepth=1
            $inner = (object) ['value' => 'deep'];
            $middle = (object) ['child' => $inner];
            $root = (object) ['nested' => $middle];

            expect(fn () => $builder->builder()->object($root))->toThrow(SecurityException::class);
        });

        it('does not throw when object nesting is within the configured maxDepth', function (): void {
            $builder = (new InlineBuilderAccessor())->withSecurityParser(new SecurityParser(maxDepth: 10));
            $obj = (object) ['user' => (object) ['city' => 'Porto']];

            $accessor = $builder->builder()->object($obj);

            expect($accessor->get('user.city'))->toBe('Porto');
        });

        it('throws SecurityException when a deeply nested array inside an object exceeds maxDepth', function (): void {
            $builder = (new InlineBuilderAccessor())->withSecurityParser(new SecurityParser(maxDepth: 1));

            // depth=0 root object → depth=1 array property → depth=2 nested array exceeds maxDepth=1
            $obj = (object) ['data' => [['deep' => 'value']]];

            expect(fn () => $builder->builder()->object($obj))->toThrow(SecurityException::class);
        });

        it('does not throw for an object nested within the configured maxDepth', function (): void {
            // maxDepth=10 comfortably allows 3 levels of nesting (objectToArray depth≤3, structural depth≤4)
            $builder = (new InlineBuilderAccessor())->withSecurityParser(new SecurityParser(maxDepth: 10));
            $obj = (object) ['l1' => (object) ['l2' => (object) ['value' => 'ok']]];

            $accessor = $builder->builder()->object($obj);

            expect($accessor->get('l1.l2.value'))->toBe('ok');
        });

        it('does not throw for a flat object with default SecurityParser settings', function (): void {
            // Default maxDepth=512 allows any reasonable nesting
            $obj = (object) ['name' => 'Alice', 'age' => 30];

            $accessor = factory()->object($obj);

            expect($accessor->get('name'))->toBe('Alice');
        });

        it('SecurityException message mentions the exceeded depth for objects', function (): void {
            $builder = (new InlineBuilderAccessor())->withSecurityParser(new SecurityParser(maxDepth: 0));

            $inner = (object) ['value' => 'deep'];
            $root = (object) ['nested' => $inner];

            expect(fn () => $builder->builder()->object($root))
                ->toThrow(SecurityException::class, 'exceeds maximum');
        });
    });
});
