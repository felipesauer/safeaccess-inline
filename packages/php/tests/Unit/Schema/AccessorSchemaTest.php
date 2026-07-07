<?php

declare(strict_types=1);

use SafeAccess\Inline\Exceptions\AccessorException;
use SafeAccess\Inline\Exceptions\SchemaValidationException;
use SafeAccess\Inline\Inline;

function sample(): \SafeAccess\Inline\Accessors\Formats\JsonAccessor
{
    return Inline::fromJson('{"db":{"host":"localhost","port":5432,"ssl":true},"tags":["x","y"]}');
}

describe('AbstractAccessor > validate', function (): void {
    it('returns a valid result when the data matches', function (): void {
        $result = sample()->validate([
            'db.host' => 'string',
            'db.port' => 'int',
            'db.ssl' => 'bool',
            'tags' => 'array',
        ]);

        expect($result->isValid())->toBeTrue();
        expect($result->errors())->toBe([]);
    });

    it('reports a missing required path', function (): void {
        $result = sample()->validate(['db.password' => 'string']);

        expect($result->isValid())->toBeFalse();
        expect($result->errors()[0]->path)->toBe('db.password');
        expect($result->errors()[0]->actual)->toBe('missing');
    });

    it('allows an absent optional path', function (): void {
        expect(sample()->validate(['db.password' => 'string?'])->isValid())->toBeTrue();
    });

    it('reports a type mismatch with a descriptive message', function (): void {
        $result = sample()->validate(['db.port' => 'string']);

        expect($result->errors()[0]->message)->toBe('Path "db.port" expected string, got int.');
    });

    it('throws AccessorException on an unknown rule', function (): void {
        expect(fn () => sample()->validate(['db.host' => 'text']))
            ->toThrow(AccessorException::class);
    });
});

describe('AbstractAccessor > assert', function (): void {
    it('returns the same accessor when valid, allowing chaining', function (): void {
        $accessor = sample();
        $returned = $accessor->assert(['db.host' => 'string']);

        expect($returned)->toBe($accessor);
        expect($returned->get('db.host'))->toBe('localhost');
    });

    it('throws SchemaValidationException carrying all errors', function (): void {
        try {
            sample()->assert(['db.port' => 'string', 'missing' => 'int']);
            $this->fail('expected SchemaValidationException');
        } catch (SchemaValidationException $e) {
            expect($e->getErrors())->toHaveCount(2);
            expect($e->getMessage())->toContain('Schema validation failed:');
        }
    });

    it('does not throw for a valid schema', function (): void {
        expect(sample()->assert(['db.port' => 'int'])->get('db.port'))->toBe(5432);
    });
});

describe('schema validation across formats', function (): void {
    it('treats CSV values as strings (int rule fails, string passes)', function (): void {
        $csv = Inline::fromCsv("port\n8000");

        expect($csv->validate(['0.port' => 'int'])->isValid())->toBeFalse();
        expect($csv->validate(['0.port' => 'string'])->isValid())->toBeTrue();
    });

    it('validates coerced TOML scalars by their parsed type', function (): void {
        $toml = Inline::fromToml("[db]\nport = 5432\nssl = true");

        expect($toml->validate(['db.port' => 'int', 'db.ssl' => 'bool'])->isValid())->toBeTrue();
    });
});
