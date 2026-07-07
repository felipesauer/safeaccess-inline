<?php

declare(strict_types=1);

use SafeAccess\Inline\Schema\SchemaError;
use SafeAccess\Inline\Schema\SchemaResult;

function schemaError(string $path, string $message): SchemaError
{
    return new SchemaError($path, 'string', 'int', $message);
}

describe(SchemaResult::class, function (): void {
    it('is valid with no failures', function (): void {
        $result = new SchemaResult([]);
        expect($result->isValid())->toBeTrue();
        expect($result->errors())->toBe([]);
        expect($result->errorsByPath())->toBe([]);
    });

    it('is invalid with failures', function (): void {
        $failures = [schemaError('a', 'msg a')];
        $result = new SchemaResult($failures);
        expect($result->isValid())->toBeFalse();
        expect($result->errors())->toBe($failures);
    });

    describe('errorsByPath', function (): void {
        it('groups a single message under its path', function (): void {
            $result = new SchemaResult([schemaError('user.email', 'bad email')]);
            expect($result->errorsByPath())->toBe(['user.email' => ['bad email']]);
        });

        it('groups multiple paths in first-seen order', function (): void {
            $result = new SchemaResult([
                schemaError('email', 'bad email'),
                schemaError('age', 'bad age'),
            ]);
            expect($result->errorsByPath())->toBe([
                'email' => ['bad email'],
                'age' => ['bad age'],
            ]);
            expect(array_keys($result->errorsByPath()))->toBe(['email', 'age']);
        });

        it('collects multiple messages under the same path', function (): void {
            $result = new SchemaResult([
                schemaError('field', 'first problem'),
                schemaError('field', 'second problem'),
            ]);
            expect($result->errorsByPath())->toBe([
                'field' => ['first problem', 'second problem'],
            ]);
        });
    });
});
