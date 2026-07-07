<?php

declare(strict_types=1);

use SafeAccess\Inline\Inline;

// Wildcard resolution lives in the parser, so these exercise the full path
// (Inline::validate) rather than the standalone validator.

function wildUsers(): \SafeAccess\Inline\Accessors\Formats\JsonAccessor
{
    return Inline::fromJson('{"users":[{"email":"a@b.com"},{"email":"c@d.io"},{"email":"e@f.net"}]}');
}

describe('schema wildcards', function (): void {
    it('validates every expanded value', function (): void {
        expect(wildUsers()->validate(['users.*.email' => 'string|email'])->isValid())->toBeTrue();
    });

    it('reports the first failing element with an expansion index', function (): void {
        $a = Inline::fromJson('{"users":[{"email":"a@b.com"},{"email":"bad"}]}');
        $r = $a->validate(['users.*.email' => 'string|email']);
        expect($r->isValid())->toBeFalse();
        expect($r->errors()[0]->path)->toBe('users.*.email.1');
        expect($r->errors()[0]->message)->toBe('Path "users.*.email.1" must be a valid email.');
    });

    it('reports a type mismatch per element', function (): void {
        $a = Inline::fromJson('{"users":[{"age":30},{"age":"x"}]}');
        $r = $a->validate(['users.*.age' => 'int']);
        expect($r->errors()[0]->path)->toBe('users.*.age.1');
        expect($r->errors()[0]->message)->toContain('expected int, got string');
    });

    describe('absent element keys', function (): void {
        $mixed = fn () => Inline::fromJson('{"users":[{"email":"a@b.com"},{"name":"x"}]}');

        it('treats an absent key as a failure for a required rule', function () use ($mixed): void {
            $r = $mixed()->validate(['users.*.email' => 'string']);
            expect($r->isValid())->toBeFalse();
            expect($r->errors()[0]->path)->toBe('users.*.email.1');
        });

        it('accepts an absent key for an optional rule', function () use ($mixed): void {
            expect($mixed()->validate(['users.*.email' => 'string?'])->isValid())->toBeTrue();
        });
    });

    describe('constraints and each on expanded values', function (): void {
        it('applies a numeric constraint to each element', function (): void {
            $a = Inline::fromJson('{"items":[{"price":5},{"price":-2}]}');
            $r = $a->validate(['items.*.price' => 'int|min:0']);
            expect($r->errors()[0]->path)->toBe('items.*.price.1');
            expect($r->errors()[0]->message)->toBe('Path "items.*.price.1" must be >= 0, got -2.');
        });

        it('applies an each rule to each expanded array', function (): void {
            $a = Inline::fromJson('{"users":[{"roles":["a","b"]},{"roles":["c"]}]}');
            expect($a->validate(['users.*.roles' => 'array|each:(string)'])->isValid())->toBeTrue();
        });

        it('reports a nested each failure under the expanded element', function (): void {
            $a = Inline::fromJson('{"users":[{"roles":["a"]},{"roles":[42]}]}');
            $r = $a->validate(['users.*.roles' => 'array|each:(string)']);
            expect($r->errors()[0]->path)->toBe('users.*.roles.1.0');
        });
    });

    describe('empty and absent collections', function (): void {
        it('passes for an empty collection', function (): void {
            expect(Inline::fromJson('{"users":[]}')->validate(['users.*.email' => 'string'])->isValid())->toBeTrue();
        });

        it('passes when the base collection is absent', function (): void {
            expect(Inline::fromJson('{"other":1}')->validate(['users.*.email' => 'string'])->isValid())->toBeTrue();
        });

        it('passes when the base is not a collection', function (): void {
            expect(Inline::fromJson('{"users":"scalar"}')->validate(['users.*.email' => 'string'])->isValid())->toBeTrue();
        });
    });

    it('supports a trailing wildcard over a list of scalars', function (): void {
        expect(Inline::fromJson('{"tags":["x","y","z"]}')->validate(['tags.*' => 'string'])->isValid())->toBeTrue();
        $bad = Inline::fromJson('{"tags":["x",2]}');
        expect($bad->validate(['tags.*' => 'string'])->errors()[0]->path)->toBe('tags.*.1');
    });

    it('leaves concrete (wildcard-free) paths unchanged', function (): void {
        expect(wildUsers()->validate(['users.0.email' => 'string|email'])->isValid())->toBeTrue();
        expect(wildUsers()->validate(['users.99.email' => 'string'])->isValid())->toBeFalse();
    });

    it('works through assert() as well', function (): void {
        expect(wildUsers()->assert(['users.*.email' => 'string|email'])->get('users.0.email'))->toBe('a@b.com');
    });
});
