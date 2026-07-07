<?php

declare(strict_types=1);

use SafeAccess\Inline\Exceptions\AccessorException;
use SafeAccess\Inline\Schema\SchemaResult;
use SafeAccess\Inline\Schema\SchemaValidator;

/**
 * @param array<string, mixed> $data
 */
function constraintValidatorFor(array $data): SchemaValidator
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
function cValidate(array $data, array $schema): SchemaResult
{
    return constraintValidatorFor($data)->validate($schema);
}

describe('SchemaValidator constraints', function (): void {
    describe('min / max on numbers', function (): void {
        it('passes within bounds', function (): void {
            expect(cValidate(['n' => 50], ['n' => 'int|min:1|max:100'])->isValid())->toBeTrue();
        });

        it('fails below min', function (): void {
            $r = cValidate(['n' => 0], ['n' => 'int|min:1']);
            expect($r->isValid())->toBeFalse();
            expect($r->errors()[0]->message)->toBe('Path "n" must be >= 1, got 0.');
        });

        it('fails above max', function (): void {
            expect(cValidate(['n' => 150], ['n' => 'int|max:100'])->errors()[0]->message)
                ->toBe('Path "n" must be <= 100, got 150.');
        });

        it('accepts a decimal bound on a float', function (): void {
            expect(cValidate(['n' => 2.5], ['n' => 'float|min:2.0|max:3.0'])->isValid())->toBeTrue();
        });

        it('accepts a negative bound', function (): void {
            expect(cValidate(['n' => -5], ['n' => 'int|min:-10'])->isValid())->toBeTrue();
        });
    });

    describe('min / max on strings', function (): void {
        it('measures string length', function (): void {
            expect(cValidate(['s' => 'abc'], ['s' => 'string|min:2|max:5'])->isValid())->toBeTrue();
        });

        it('fails a too-short string with a length message', function (): void {
            expect(cValidate(['s' => 'a'], ['s' => 'string|min:3'])->errors()[0]->message)
                ->toBe('Path "s" length must be >= 3, got 1.');
        });

        it('fails a too-long string', function (): void {
            expect(cValidate(['s' => 'abcdef'], ['s' => 'string|max:3'])->errors()[0]->message)
                ->toBe('Path "s" length must be <= 3, got 6.');
        });
    });

    describe('min / max on arrays', function (): void {
        it('measures array size', function (): void {
            expect(cValidate(['a' => [1, 2]], ['a' => 'array|min:1|max:3'])->isValid())->toBeTrue();
        });

        it('fails a too-small array', function (): void {
            expect(cValidate(['a' => [1]], ['a' => 'array|min:2'])->isValid())->toBeFalse();
        });
    });

    describe('enum', function (): void {
        it('accepts a string in the list', function (): void {
            expect(cValidate(['s' => 'active'], ['s' => 'string|enum:active,inactive'])->isValid())->toBeTrue();
        });

        it('rejects a string outside the list', function (): void {
            expect(cValidate(['s' => 'x'], ['s' => 'string|enum:active,inactive'])->errors()[0]->message)
                ->toBe('Path "s" must be one of [active, inactive], got "x".');
        });

        it('accepts an int matched against its string form', function (): void {
            expect(cValidate(['n' => 8080], ['n' => 'int|enum:80,8080,443'])->isValid())->toBeTrue();
        });

        it('rejects an int not in the list', function (): void {
            expect(cValidate(['n' => 22], ['n' => 'int|enum:80,443'])->isValid())->toBeFalse();
        });
    });

    describe('pattern', function (): void {
        it('accepts a matching string', function (): void {
            expect(cValidate(['s' => 'ABC'], ['s' => 'string|pattern:^[A-Z]{3}$'])->isValid())->toBeTrue();
        });

        it('rejects a non-matching string', function (): void {
            expect(cValidate(['s' => 'abc'], ['s' => 'string|pattern:^[A-Z]{3}$'])->errors()[0]->message)
                ->toBe('Path "s" must match pattern ^[A-Z]{3}$.');
        });
    });

    describe('format shortcuts', function (): void {
        it('validates email', function (): void {
            expect(cValidate(['e' => 'a@b.com'], ['e' => 'string|email'])->isValid())->toBeTrue();
            expect(cValidate(['e' => 'nope'], ['e' => 'string|email'])->errors()[0]->message)
                ->toBe('Path "e" must be a valid email.');
        });

        it('validates url', function (): void {
            expect(cValidate(['u' => 'https://x.io/p'], ['u' => 'string|url'])->isValid())->toBeTrue();
            expect(cValidate(['u' => 'ftp://x'], ['u' => 'string|url'])->isValid())->toBeFalse();
        });

        it('validates uuid', function (): void {
            $id = '550e8400-e29b-41d4-a716-446655440000';
            expect(cValidate(['id' => $id], ['id' => 'string|uuid'])->isValid())->toBeTrue();
            expect(cValidate(['id' => 'not-a-uuid'], ['id' => 'string|uuid'])->isValid())->toBeFalse();
        });
    });

    describe('composition and ordering', function (): void {
        it('chains multiple constraints', function (): void {
            expect(cValidate(['s' => 'abcd'], ['s' => 'string|min:2|max:10|pattern:^[a-z]+$'])->isValid())->toBeTrue();
        });

        it('reports the first failing constraint only', function (): void {
            $r = cValidate(['s' => 'A'], ['s' => 'string|min:3|pattern:^[a-z]+$']);
            expect($r->errors())->toHaveCount(1);
            expect($r->errors()[0]->message)->toContain('length must be >= 3');
        });

        it('skips constraints when the base type fails', function (): void {
            $r = cValidate(['n' => 5], ['n' => 'string|min:2']);
            expect($r->errors())->toHaveCount(1);
            expect($r->errors()[0]->message)->toContain('expected string, got int');
        });

        it('applies constraints to a present optional path', function (): void {
            expect(cValidate(['s' => 'a'], ['s' => 'string|min:3?'])->isValid())->toBeFalse();
        });

        it('skips an absent optional path with constraints', function (): void {
            expect(cValidate([], ['s' => 'string|min:3?'])->isValid())->toBeTrue();
        });
    });

    describe('constraint on an incompatible value type', function (): void {
        it('reports a data error for min on a boolean', function (): void {
            $r = cValidate(['b' => true], ['b' => 'any|min:1']);
            expect($r->isValid())->toBeFalse();
            expect($r->errors()[0]->message)->toContain('requires a number, string, or array');
        });

        it('reports a data error for max on a boolean', function (): void {
            expect(cValidate(['b' => true], ['b' => 'any|max:1'])->errors()[0]->message)
                ->toContain('requires a number, string, or array');
        });

        it('reports a data error for email on a non-string', function (): void {
            expect(cValidate(['n' => 5], ['n' => 'any|email'])->isValid())->toBeFalse();
        });

        it('describes null in an enum failure', function (): void {
            expect(cValidate(['x' => null], ['x' => 'any|enum:a,b'])->errors()[0]->message)->toContain('got null');
        });

        it('describes a list in an enum failure', function (): void {
            expect(cValidate(['x' => [1]], ['x' => 'any|enum:a,b'])->errors()[0]->message)->toContain('got array');
        });

        it('describes a map in an enum failure', function (): void {
            expect(cValidate(['x' => ['k' => 1]], ['x' => 'any|enum:a,b'])->errors()[0]->message)->toContain('got object');
        });

        it('describes a boolean in an enum failure', function (): void {
            expect(cValidate(['x' => true], ['x' => 'any|enum:a,b'])->errors()[0]->message)->toContain('got true');
        });
    });

    describe('schema (programming) errors', function (): void {
        it('throws on a non-numeric min argument', function (): void {
            expect(fn () => cValidate(['n' => 1], ['n' => 'int|min:abc']))
                ->toThrow(AccessorException::class, 'needs a numeric argument');
        });

        it('throws on a missing min argument', function (): void {
            expect(fn () => cValidate(['n' => 1], ['n' => 'int|min']))
                ->toThrow(AccessorException::class);
        });

        it('throws on an empty enum', function (): void {
            expect(fn () => cValidate(['s' => 'a'], ['s' => 'string|enum:']))
                ->toThrow(AccessorException::class, 'is empty');
        });

        it('throws on an invalid regex', function (): void {
            expect(fn () => cValidate(['s' => 'a'], ['s' => 'string|pattern:[']))
                ->toThrow(AccessorException::class, 'invalid regex');
        });

        it('throws on an unknown constraint', function (): void {
            expect(fn () => cValidate(['n' => 1], ['n' => 'int|between:1,2']))
                ->toThrow(AccessorException::class, 'Unknown schema constraint "between"');
        });

        it('still throws on an unknown base type', function (): void {
            expect(fn () => cValidate(['n' => 1], ['n' => 'integer|min:1']))
                ->toThrow(AccessorException::class, 'Unknown schema rule "integer"');
        });
    });
});
