<?php

declare(strict_types=1);

use SafeAccess\Inline\Exceptions\AccessorException;
use SafeAccess\Inline\Schema\SchemaResult;
use SafeAccess\Inline\Schema\SchemaValidator;

/**
 * Build a validator backed by a plain nested array, resolving dotted paths
 * against it. Keeps the validator test independent of the accessor.
 *
 * @param array<string, mixed> $data
 */
function validatorFor(array $data): SchemaValidator
{
    $resolve = static function (string $path) use ($data): array {
        $node = $data;
        foreach (explode('.', $path) as $key) {
            if (!is_array($node) || !array_key_exists($key, $node)) {
                return ['found' => false, 'value' => null];
            }
            $node = $node[$key];
        }

        return ['found' => true, 'value' => $node];
    };

    return new SchemaValidator(
        static fn (string $path): bool => $resolve($path)['found'],
        static function (string $path, mixed $fallback) use ($resolve): mixed {
            $r = $resolve($path);

            return $r['found'] ? $r['value'] : $fallback;
        },
    );
}

/**
 * @param array<string, mixed>  $data
 * @param array<string, string> $schema
 */
function schemaValidate(array $data, array $schema): SchemaResult
{
    return validatorFor($data)->validate($schema);
}

describe(SchemaValidator::class, function (): void {
    it('accepts data that satisfies every rule', function (): void {
        $result = schemaValidate(
            ['name' => 'Alice', 'age' => 30, 'ratio' => 1.5, 'active' => true, 'tags' => ['a'], 'meta' => ['k' => 1]],
            ['name' => 'string', 'age' => 'int', 'ratio' => 'float', 'active' => 'bool', 'tags' => 'array', 'meta' => 'object'],
        );

        expect($result->isValid())->toBeTrue();
        expect($result->errors())->toBe([]);
    });

    it('reports a missing required path', function (): void {
        $result = schemaValidate(['name' => 'Alice'], ['email' => 'string']);

        expect($result->isValid())->toBeFalse();
        expect($result->errors()[0]->path)->toBe('email');
        expect($result->errors()[0]->actual)->toBe('missing');
        expect($result->errors()[0]->message)->toBe('Missing required path "email" (expected string).');
    });

    it('reports a type mismatch', function (): void {
        $result = schemaValidate(['age' => '30'], ['age' => 'int']);

        expect($result->errors()[0]->expected)->toBe('int');
        expect($result->errors()[0]->actual)->toBe('string');
        expect($result->errors()[0]->message)->toBe('Path "age" expected int, got string.');
    });

    describe('optional rules', function (): void {
        it('allows an absent optional path', function (): void {
            expect(schemaValidate([], ['nickname' => 'string?'])->isValid())->toBeTrue();
        });

        it('validates an optional path when present', function (): void {
            expect(schemaValidate(['nickname' => 'Al'], ['nickname' => 'string?'])->isValid())->toBeTrue();
        });

        it('rejects an optional path present with the wrong type', function (): void {
            $result = schemaValidate(['nickname' => 42], ['nickname' => 'string?']);

            expect($result->isValid())->toBeFalse();
            expect($result->errors()[0]->expected)->toBe('string?');
        });
    });

    describe('type rules', function (): void {
        it('int rejects a float', function (): void {
            expect(schemaValidate(['n' => 1.5], ['n' => 'int'])->isValid())->toBeFalse();
        });

        it('float accepts an int', function (): void {
            expect(schemaValidate(['n' => 5], ['n' => 'float'])->isValid())->toBeTrue();
        });

        it('number is an alias of float', function (): void {
            expect(schemaValidate(['n' => 1.5], ['n' => 'number'])->isValid())->toBeTrue();
        });

        it('array rejects an associative map', function (): void {
            expect(schemaValidate(['x' => ['k' => 1]], ['x' => 'array'])->isValid())->toBeFalse();
        });

        it('object rejects a list', function (): void {
            expect(schemaValidate(['x' => [1, 2]], ['x' => 'object'])->isValid())->toBeFalse();
        });

        it('object rejects null', function (): void {
            expect(schemaValidate(['x' => null], ['x' => 'object'])->isValid())->toBeFalse();
        });

        it('null accepts null', function (): void {
            expect(schemaValidate(['x' => null], ['x' => 'null'])->isValid())->toBeTrue();
        });

        it('null rejects a non-null value', function (): void {
            expect(schemaValidate(['x' => 0], ['x' => 'null'])->isValid())->toBeFalse();
        });

        it('any accepts any present value', function (): void {
            expect(schemaValidate(['x' => null], ['x' => 'any'])->isValid())->toBeTrue();
        });

        it('any still requires the path to be present', function (): void {
            expect(schemaValidate([], ['x' => 'any'])->isValid())->toBeFalse();
        });
    });

    describe('type names in errors', function (): void {
        it('labels a float value as float', function (): void {
            expect(schemaValidate(['n' => 1.5], ['n' => 'int'])->errors()[0]->actual)->toBe('float');
        });

        it('labels null as null', function (): void {
            expect(schemaValidate(['n' => null], ['n' => 'int'])->errors()[0]->actual)->toBe('null');
        });

        it('labels a list as array', function (): void {
            expect(schemaValidate(['n' => [1]], ['n' => 'int'])->errors()[0]->actual)->toBe('array');
        });

        it('labels an associative map as object', function (): void {
            expect(schemaValidate(['n' => ['k' => 1]], ['n' => 'int'])->errors()[0]->actual)->toBe('object');
        });

        it('labels a boolean as bool', function (): void {
            expect(schemaValidate(['n' => true], ['n' => 'int'])->errors()[0]->actual)->toBe('bool');
        });
    });

    it('validates nested dotted paths', function (): void {
        $result = schemaValidate(
            ['db' => ['host' => 'localhost', 'port' => 5432]],
            ['db.host' => 'string', 'db.port' => 'int'],
        );

        expect($result->isValid())->toBeTrue();
    });

    it('aggregates multiple failures', function (): void {
        $result = schemaValidate(['a' => 1], ['a' => 'string', 'b' => 'int']);

        expect($result->errors())->toHaveCount(2);
    });

    it('throws on an unknown rule', function (): void {
        expect(fn () => schemaValidate(['x' => 1], ['x' => 'integer']))
            ->toThrow(AccessorException::class, 'Unknown schema rule "integer" for path "x".');
    });

    it('throws on an unknown rule even with the optional suffix', function (): void {
        expect(fn () => schemaValidate([], ['x' => 'wat?']))
            ->toThrow(AccessorException::class);
    });
});
