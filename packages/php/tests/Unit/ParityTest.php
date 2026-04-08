<?php

declare(strict_types=1);

use SafeAccess\Inline\Accessors\Formats\EnvAccessor;
use SafeAccess\Inline\Accessors\Formats\IniAccessor;
use SafeAccess\Inline\Accessors\Formats\NdjsonAccessor;
use SafeAccess\Inline\Accessors\Formats\ObjectAccessor;
use SafeAccess\Inline\Exceptions\InvalidFormatException;
use SafeAccess\Inline\Inline;
use SafeAccess\Inline\Tests\Mocks\FakeParseIntegration;

describe(Inline::class . ' > fromAny (parity)', function (): void {
    beforeEach(function (): void {
        $this->inline = new Inline();
    });

    it('throws InvalidFormatException when integration rejects the input', function (): void {
        $integration = new FakeParseIntegration(accepts: false, parsed: []);

        expect(fn () => $this->inline->fromAny('bad-input', $integration))
            ->toThrow(InvalidFormatException::class);
    });

    it('inline integration override takes precedence over builder integration', function (): void {
        $builderIntegration = new FakeParseIntegration(accepts: true, parsed: ['from' => 'builder']);
        $overrideIntegration = new FakeParseIntegration(accepts: true, parsed: ['from' => 'override']);

        $accessor = $this->inline
            ->withParserIntegration($builderIntegration)
            ->fromAny('raw', $overrideIntegration);

        expect($accessor->get('from'))->toBe('override');
    });

    it('resolves nested path through AnyAccessor', function (): void {
        $integration = new FakeParseIntegration(accepts: true, parsed: ['user' => ['name' => 'Alice']]);

        $accessor = $this->inline->fromAny('raw', $integration);

        expect($accessor->get('user.name'))->toBe('Alice');
    });

    it('throws InvalidFormatException when no integration is available', function (): void {
        expect(fn () => $this->inline->fromAny('data'))
            ->toThrow(InvalidFormatException::class);
    });

    it('throws InvalidFormatException with guidance message when no integration is set', function (): void {
        expect(fn () => $this->inline->fromAny('data'))
            ->toThrow('AnyAccessor requires a ParseIntegrationInterface');
    });
});

describe(Inline::class . ' > withStrictMode (parity)', function (): void {
    beforeEach(function (): void {
        $this->inline = new Inline();
    });

    it('withStrictMode(false) bypasses payload size validation for JSON', function (): void {
        $tinyParser = new \SafeAccess\Inline\Security\SecurityParser(maxPayloadBytes: 5);

        $accessor = $this->inline
            ->withSecurityParser($tinyParser)
            ->withStrictMode(false)
            ->fromJson('{"name":"Alice"}');

        expect($accessor->get('name'))->toBe('Alice');
    });

    it('withStrictMode(false) bypasses forbidden key validation for JSON', function (): void {
        $accessor = $this->inline
            ->withStrictMode(false)
            ->fromJson('{"__construct":"injected"}');

        expect($accessor->get('__construct'))->toBe('injected');
    });

    it('withStrictMode(true) enforces forbidden key validation for JSON', function (): void {
        expect(
            fn () => $this->inline
            ->withStrictMode(true)
            ->fromJson('{"__construct":"injected"}')
        )->toThrow(\SafeAccess\Inline\Exceptions\SecurityException::class);
    });

    it('strict(false) bypasses payload size validation for JSON', function (): void {
        $tinyParser = new \SafeAccess\Inline\Security\SecurityParser(maxPayloadBytes: 5);
        $parser = new \SafeAccess\Inline\Core\DotNotationParser(
            new \SafeAccess\Inline\Security\SecurityGuard(),
            $tinyParser,
            new \SafeAccess\Inline\Cache\SimplePathCache(),
            new \SafeAccess\Inline\PathQuery\SegmentParser(
                new \SafeAccess\Inline\PathQuery\SegmentFilterParser(new \SafeAccess\Inline\Security\SecurityGuard())
            ),
            new \SafeAccess\Inline\PathQuery\SegmentPathResolver(
                new \SafeAccess\Inline\PathQuery\SegmentFilterParser(new \SafeAccess\Inline\Security\SecurityGuard())
            ),
        );

        $accessor = (new \SafeAccess\Inline\Accessors\Formats\JsonAccessor($parser))
            ->strict(false)
            ->from('{"name":"Alice"}');

        expect($accessor->get('name'))->toBe('Alice');
    });

    it('strict(false) bypasses forbidden key validation for JSON', function (): void {
        $parser = new \SafeAccess\Inline\Core\DotNotationParser(
            new \SafeAccess\Inline\Security\SecurityGuard(),
            new \SafeAccess\Inline\Security\SecurityParser(),
            new \SafeAccess\Inline\Cache\SimplePathCache(),
            new \SafeAccess\Inline\PathQuery\SegmentParser(
                new \SafeAccess\Inline\PathQuery\SegmentFilterParser(new \SafeAccess\Inline\Security\SecurityGuard())
            ),
            new \SafeAccess\Inline\PathQuery\SegmentPathResolver(
                new \SafeAccess\Inline\PathQuery\SegmentFilterParser(new \SafeAccess\Inline\Security\SecurityGuard())
            ),
        );

        $accessor = (new \SafeAccess\Inline\Accessors\Formats\JsonAccessor($parser))
            ->strict(false)
            ->from('{"__construct":"injected"}');

        expect($accessor->get('__construct'))->toBe('injected');
    });
});

describe(Inline::class . ' > withStrictMode + make (parity)', function (): void {
    beforeEach(function (): void {
        $this->inline = new Inline();
    });

    it('withStrictMode(false) bypasses forbidden key validation through make()', function (): void {
        $accessor = $this->inline
            ->withStrictMode(false)
            ->make(\SafeAccess\Inline\Accessors\Formats\JsonAccessor::class, '{"__construct":"ok"}');

        expect($accessor->get('__construct'))->toBe('ok');
    });

    it('withStrictMode(true) enforces forbidden key validation through make()', function (): void {
        expect(
            fn () => $this->inline
            ->withStrictMode(true)
            ->make(\SafeAccess\Inline\Accessors\Formats\JsonAccessor::class, '{"__construct":"injected"}')
        )->toThrow(\SafeAccess\Inline\Exceptions\SecurityException::class);
    });

    it('withStrictMode(false) bypasses payload size validation through make()', function (): void {
        $tinyParser = new \SafeAccess\Inline\Security\SecurityParser(maxPayloadBytes: 5);

        $accessor = $this->inline
            ->withSecurityParser($tinyParser)
            ->withStrictMode(false)
            ->make(\SafeAccess\Inline\Accessors\Formats\JsonAccessor::class, '{"name":"Alice"}');

        expect($accessor->get('name'))->toBe('Alice');
    });

    it('withStrictMode(true) enforces payload size validation through make()', function (): void {
        $tinyParser = new \SafeAccess\Inline\Security\SecurityParser(maxPayloadBytes: 5);

        expect(
            fn () => $this->inline
            ->withSecurityParser($tinyParser)
            ->withStrictMode(true)
            ->make(\SafeAccess\Inline\Accessors\Formats\JsonAccessor::class, '{"name":"Alice"}')
        )->toThrow(\SafeAccess\Inline\Exceptions\SecurityException::class);
    });
});

describe(Inline::class . ' > PathQuery > wildcard (parity)', function (): void {
    beforeEach(function (): void {
        $this->inline = new Inline();
    });

    it('expands all children with a wildcard', function (): void {
        $accessor = $this->inline->fromArray(['users' => [['name' => 'Alice'], ['name' => 'Bob']]]);
        expect($accessor->get('users.*.name'))->toBe(['Alice', 'Bob']);
    });

    it('returns null for a wildcard on a scalar value', function (): void {
        $accessor = $this->inline->fromArray(['x' => 42]);
        expect($accessor->get('x.*'))->toBeNull();
    });
});

describe(Inline::class . ' > PathQuery > filter (parity)', function (): void {
    beforeEach(function (): void {
        $this->inline = new Inline();
    });

    it('filters array items that satisfy a condition', function (): void {
        $accessor = $this->inline->fromArray([
            'items' => [
                ['name' => 'Alice', 'age' => 30],
                ['name' => 'Bob', 'age' => 20],
                ['name' => 'Charlie', 'age' => 35],
            ],
        ]);
        expect($accessor->get('items[?age > 25].name'))->toBe(['Alice', 'Charlie']);
    });

    it('returns empty array when no items match the filter', function (): void {
        $accessor = $this->inline->fromArray([
            'items' => [['name' => 'Alice', 'age' => 10]],
        ]);
        expect($accessor->get('items[?age > 100]'))->toBe([]);
    });

    it('filters with equality on a string field', function (): void {
        $accessor = $this->inline->fromArray([
            'users' => [
                ['role' => 'admin', 'name' => 'Alice'],
                ['role' => 'user', 'name' => 'Bob'],
            ],
        ]);
        expect($accessor->get("users[?role == 'admin'].name"))->toBe(['Alice']);
    });

    it('filters with logical AND', function (): void {
        $accessor = $this->inline->fromArray([
            'items' => [
                ['a' => 1, 'b' => 2],
                ['a' => 1, 'b' => 5],
                ['a' => 3, 'b' => 2],
            ],
        ]);
        expect($accessor->get('items[?a == 1 && b == 2]'))->toBe([['a' => 1, 'b' => 2]]);
    });

    it('filters with starts_with function', function (): void {
        $accessor = $this->inline->fromArray([
            'items' => [
                ['name' => 'Alice'],
                ['name' => 'Anna'],
                ['name' => 'Bob'],
            ],
        ]);
        expect($accessor->get("items[?starts_with(@.name, 'A')].name"))->toBe(['Alice', 'Anna']);
    });

    it('filters with contains function on a string', function (): void {
        $accessor = $this->inline->fromArray([
            'items' => [
                ['tag' => 'hello-world'],
                ['tag' => 'foo-bar'],
            ],
        ]);
        expect($accessor->get("items[?contains(@.tag, 'world')].tag"))->toBe(['hello-world']);
    });
});

describe(Inline::class . ' > PathQuery > multi-key and multi-index (parity)', function (): void {
    beforeEach(function (): void {
        $this->inline = new Inline();
    });

    it("selects multiple keys with ['a','b']", function (): void {
        $accessor = $this->inline->fromArray(['a' => 1, 'b' => 2, 'c' => 3]);
        expect($accessor->get("['a','b']"))->toBe([1, 2]);
    });

    it('selects multiple indices [0,2]', function (): void {
        $accessor = $this->inline->fromArray(['items' => ['x', 'y', 'z']]);
        expect($accessor->get('items[0,2]'))->toBe(['x', 'z']);
    });

    it('resolves a negative index [-1] as a key lookup', function (): void {
        $accessor = $this->inline->fromArray(['items' => ['a', 'b', 'c']]);
        expect($accessor->get('items[-1]'))->toBeNull();
    });
});

describe(Inline::class . ' > PathQuery > slice (parity)', function (): void {
    beforeEach(function (): void {
        $this->inline = new Inline();
    });

    it('slices an array [1:3]', function (): void {
        $accessor = $this->inline->fromArray(['items' => [10, 20, 30, 40, 50]]);
        expect($accessor->get('items[1:3]'))->toBe([20, 30]);
    });

    it('slices with a step [0:6:2]', function (): void {
        $accessor = $this->inline->fromArray(['items' => [0, 1, 2, 3, 4, 5]]);
        expect($accessor->get('items[0:6:2]'))->toBe([0, 2, 4]);
    });

    it('returns null for a slice on a scalar', function (): void {
        $accessor = $this->inline->fromArray(['x' => 'hello']);
        expect($accessor->get('x[0:2]'))->toBeNull();
    });
});

describe(Inline::class . ' > PathQuery > recursive descent (parity)', function (): void {
    beforeEach(function (): void {
        $this->inline = new Inline();
    });

    it('collects all values for a recursive descent key', function (): void {
        $accessor = $this->inline->fromArray([
            'a' => ['name' => 'top'],
            'b' => ['nested' => ['name' => 'deep']],
        ]);
        expect($accessor->get('..name'))->toBe(['top', 'deep']);
    });

    it('collects values for DescentMulti with multiple keys', function (): void {
        $accessor = $this->inline->fromArray([
            'a' => ['x' => 1, 'y' => 2],
            'b' => ['x' => 3, 'z' => 4],
        ]);
        expect($accessor->get("..['x','y']"))->toBe([1, 3, 2]);
    });
});

describe(Inline::class . ' > PathQuery > projection (parity)', function (): void {
    beforeEach(function (): void {
        $this->inline = new Inline();
    });

    it('projects specific fields from a map', function (): void {
        $accessor = $this->inline->fromArray(['name' => 'Alice', 'age' => 30, 'city' => 'NYC']);
        expect($accessor->get('.{name,age}'))->toBe(['name' => 'Alice', 'age' => 30]);
    });

    it('projects fields with an alias', function (): void {
        $accessor = $this->inline->fromArray(['name' => 'Alice', 'age' => 30]);
        expect($accessor->get('.{fullName: name, years: age}'))->toBe(['fullName' => 'Alice', 'years' => 30]);
    });

    it('projects fields from a list of items', function (): void {
        $accessor = $this->inline->fromArray([
            'users' => [
                ['name' => 'Alice', 'age' => 30],
                ['name' => 'Bob', 'age' => 25],
            ],
        ]);
        expect($accessor->get('users.{name}'))->toBe([['name' => 'Alice'], ['name' => 'Bob']]);
    });

    it('sets projected field to null when source key is missing', function (): void {
        $accessor = $this->inline->fromArray(['name' => 'Alice']);
        expect($accessor->get('.{name,missing}'))->toBe(['name' => 'Alice', 'missing' => null]);
    });
});

describe(Inline::class . ' > PathQuery > bracket notation (parity)', function (): void {
    beforeEach(function (): void {
        $this->inline = new Inline();
    });

    it('resolves a bracket numeric index [0]', function (): void {
        $accessor = $this->inline->fromArray(['items' => ['a', 'b', 'c']]);
        expect($accessor->get('items[0]'))->toBe('a');
    });

    it("resolves a bracket quoted string key ['key']", function (): void {
        $accessor = $this->inline->fromArray(['key' => 'value']);
        expect($accessor->get("['key']"))->toBe('value');
    });
});

describe(Inline::class . ' > PathQuery > combined queries (parity)', function (): void {
    beforeEach(function (): void {
        $this->inline = new Inline();
    });

    it('chains filter with wildcard', function (): void {
        $accessor = $this->inline->fromArray([
            'items' => [
                ['tags' => ['a', 'b']],
                ['tags' => ['c']],
            ],
        ]);
        expect($accessor->get('items.*.tags[0]'))->toBe(['a', 'c']);
    });

    it('uses default value when path does not exist', function (): void {
        $accessor = $this->inline->fromArray(['a' => 1]);
        expect($accessor->get('missing.path', 'fallback'))->toBe('fallback');
    });

    it('resolves deeply nested path through multiple levels', function (): void {
        $accessor = $this->inline->fromArray([
            'level1' => ['level2' => ['level3' => ['value' => 'deep']]],
        ]);
        expect($accessor->get('level1.level2.level3.value'))->toBe('deep');
    });
});

describe(Inline::class . ' > fromObject (parity)', function (): void {
    it('returns correct accessor and resolves property', function (): void {
        $accessor = Inline::fromObject((object) ['user' => ['name' => 'Alice']]);
        expect($accessor->get('user.name'))->toBe('Alice');
    });
});

describe(Inline::class . ' > make (parity)', function (): void {
    it('creates IniAccessor by class-string', function (): void {
        $accessor = Inline::make(IniAccessor::class, "[section]\nkey=value");
        expect($accessor->get('section.key'))->toBe('value');
    });

    it('creates EnvAccessor by class-string', function (): void {
        $accessor = Inline::make(EnvAccessor::class, 'APP_NAME=MyApp');
        expect($accessor->get('APP_NAME'))->toBe('MyApp');
    });

    it('creates NdjsonAccessor by class-string', function (): void {
        $accessor = Inline::make(NdjsonAccessor::class, "{\"id\":1}\n{\"id\":2}");
        expect($accessor->get('0.id'))->toBe(1);
    });

    it('creates ObjectAccessor by class-string', function (): void {
        $accessor = Inline::make(ObjectAccessor::class, (object) ['name' => 'Alice']);
        expect($accessor->get('name'))->toBe('Alice');
    });
});

describe(Inline::class . ' > getMany (parity)', function (): void {
    it('returns multiple values keyed by path', function (): void {
        $accessor = Inline::fromArray(['a' => 1, 'b' => ['c' => 2]]);
        $result = $accessor->getMany(['a' => null, 'b.c' => null]);
        expect($result)->toBe(['a' => 1, 'b.c' => 2]);
    });

    it('uses provided default for missing paths', function (): void {
        $accessor = Inline::fromArray(['a' => 1]);
        $result = $accessor->getMany(['a' => null, 'missing' => 'fallback']);
        expect($result)->toBe(['a' => 1, 'missing' => 'fallback']);
    });
});

describe(Inline::class . ' > keys (parity)', function (): void {
    it('returns string keys for object-keyed data', function (): void {
        $accessor = Inline::fromJson('{"name":"Alice","age":30}');
        expect($accessor->keys())->toBe(['name', 'age']);
    });

    it('returns numeric indices as strings for NDJSON', function (): void {
        $accessor = Inline::fromNdjson("{\"name\":\"Alice\"}\n{\"name\":\"Bob\"}");
        expect($accessor->keys())->toBe(['0', '1']);
    });
});

describe(Inline::class . ' > getRaw (parity)', function (): void {
    it('stores raw input for ArrayAccessor', function (): void {
        $raw = ['name' => 'Alice', 'age' => 30];
        $accessor = Inline::fromArray($raw);
        expect($accessor->getRaw())->toBe($raw);
    });

    it('stores raw input for JsonAccessor', function (): void {
        $raw = '{"name":"Alice"}';
        $accessor = Inline::fromJson($raw);
        expect($accessor->getRaw())->toBe($raw);
    });

    it('stores raw input for YamlAccessor', function (): void {
        $raw = 'name: Alice';
        $accessor = Inline::fromYaml($raw);
        expect($accessor->getRaw())->toBe($raw);
    });

    it('stores raw input for IniAccessor', function (): void {
        $raw = "[section]\nkey=value";
        $accessor = Inline::fromIni($raw);
        expect($accessor->getRaw())->toBe($raw);
    });

    it('stores raw input for EnvAccessor', function (): void {
        $raw = 'APP_NAME=MyApp';
        $accessor = Inline::fromEnv($raw);
        expect($accessor->getRaw())->toBe($raw);
    });
});
