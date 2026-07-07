<?php

declare(strict_types=1);

use SafeAccess\Inline\Exceptions\AccessorException;
use SafeAccess\Inline\Schema\SchemaResult;
use SafeAccess\Inline\Schema\SchemaValidator;

/**
 * @param array<string, mixed> $data
 */
function eachValidatorFor(array $data): SchemaValidator
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
function eachValidate(array $data, array $schema): SchemaResult
{
    return eachValidatorFor($data)->validate($schema);
}

describe('SchemaValidator each', function (): void {
    describe('shortcut form', function (): void {
        it('accepts an array of the item type', function (): void {
            expect(eachValidate(['t' => [1, 2, 3]], ['t' => 'array|each:int'])->isValid())->toBeTrue();
        });

        it('reports the first failing item with an indexed path', function (): void {
            $r = eachValidate(['t' => [1, 'x', 3]], ['t' => 'array|each:int']);
            expect($r->isValid())->toBeFalse();
            expect($r->errors()[0]->path)->toBe('t.1');
            expect($r->errors()[0]->message)->toBe('Path "t.1" expected int, got string.');
        });

        it('reports the correct index for a later failure', function (): void {
            $r = eachValidate(['t' => [1, 2, 'x']], ['t' => 'array|each:int']);
            expect($r->errors()[0]->path)->toBe('t.2');
        });

        it('supports the shortcut form followed by another constraint', function (): void {
            expect(eachValidate(['s' => [1, 2, 3]], ['s' => 'array|each:int|max:5'])->isValid())->toBeTrue();
            expect(eachValidate(['s' => [1, 2, 3, 4]], ['s' => 'array|each:int|max:3'])->isValid())->toBeFalse();
        });
    });

    describe('parenthesised form', function (): void {
        it('validates a compound item rule', function (): void {
            expect(eachValidate(['e' => ['a@b.com', 'c@d.io']], ['e' => 'array|each:(string|email)'])->isValid())->toBeTrue();
        });

        it('reports a failing compound item', function (): void {
            $r = eachValidate(['e' => ['a@b.com', 'nope']], ['e' => 'array|each:(string|email)']);
            expect($r->errors()[0]->path)->toBe('e.1');
            expect($r->errors()[0]->message)->toBe('Path "e.1" must be a valid email.');
        });

        it('combines array constraints with a per-item rule', function (): void {
            expect(eachValidate(['s' => [1, 2]], ['s' => 'array|min:1|each:(int|min:0)'])->isValid())->toBeTrue();
        });

        it('reports an item that fails its own constraint', function (): void {
            $r = eachValidate(['s' => [1, -5]], ['s' => 'array|min:1|each:(int|min:0)']);
            expect($r->errors()[0]->message)->toBe('Path "s.1" must be >= 0, got -5.');
        });

        it('honours each combined with a following constraint', function (): void {
            expect(eachValidate(['s' => [1, 2, 3]], ['s' => 'array|each:(int)|max:5'])->isValid())->toBeTrue();
        });
    });

    describe('nesting', function (): void {
        it('validates an array of arrays', function (): void {
            expect(eachValidate(['m' => [[1], [2, 3]]], ['m' => 'array|each:(array|each:(int))'])->isValid())->toBeTrue();
        });

        it('reports a nested item with a fully-qualified path', function (): void {
            $r = eachValidate(['m' => [[1], ['x']]], ['m' => 'array|each:(array|each:(int))']);
            expect($r->errors()[0]->path)->toBe('m.1.0');
        });
    });

    describe('edge cases', function (): void {
        it('accepts an empty array', function (): void {
            expect(eachValidate(['t' => []], ['t' => 'array|each:int'])->isValid())->toBeTrue();
        });

        it('still requires the base type to be array', function (): void {
            $r = eachValidate(['t' => 'nope'], ['t' => 'array|each:int']);
            expect($r->errors()[0]->message)->toContain('expected array, got string');
        });

        it('treats each on a non-array value as a data error', function (): void {
            $r = eachValidate(['s' => 'hello'], ['s' => 'any|each:(int)']);
            expect($r->isValid())->toBeFalse();
            expect($r->errors()[0]->message)->toBe('Path "s" each constraint requires an array.');
        });

        it('applies each to a present optional array', function (): void {
            expect(eachValidate(['t' => [1, 'x']], ['t' => 'array|each:int?'])->isValid())->toBeFalse();
        });

        it('skips each on an absent optional path', function (): void {
            expect(eachValidate([], ['t' => 'array|each:int?'])->isValid())->toBeTrue();
        });
    });

    describe('schema (programming) errors', function (): void {
        it('throws on unbalanced parentheses', function (): void {
            expect(fn () => eachValidate(['t' => []], ['t' => 'array|each:(int']))
                ->toThrow(AccessorException::class, 'unbalanced parentheses');
        });

        it('throws on an unknown item type', function (): void {
            expect(fn () => eachValidate(['t' => []], ['t' => 'array|each:(nope)']))
                ->toThrow(AccessorException::class, 'Unknown schema rule "nope"');
        });

        it('throws on an unknown constraint inside the item rule', function (): void {
            expect(fn () => eachValidate(['t' => []], ['t' => 'array|each:(int|wat:1)']))
                ->toThrow(AccessorException::class, 'Unknown schema constraint "wat"');
        });
    });
});
