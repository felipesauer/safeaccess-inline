<?php

declare(strict_types=1);

use SafeAccess\Inline\Exceptions\SecurityException;
use SafeAccess\Inline\Security\SecurityGuard;

describe(SecurityGuard::class, function (): void {
    // assertSafeKey()
    describe(SecurityGuard::class . ' > assertSafeKey', function (): void {
        it('does not throw for a safe key', function (): void {
            $guard = new SecurityGuard();

            $guard->assertSafeKey('username');

            expect($guard->isForbiddenKey('username'))->toBeFalse();
        });

        it('throws SecurityException for a forbidden key', function (): void {
            $guard = new SecurityGuard();

            expect(fn () => $guard->assertSafeKey('__construct'))->toThrow(SecurityException::class);
        });

        it('throws SecurityException for a superglobal key', function (): void {
            $guard = new SecurityGuard();

            expect(fn () => $guard->assertSafeKey('_GET'))->toThrow(SecurityException::class);
        });
    });

    // assertSafeKeys()
    describe(SecurityGuard::class . ' > assertSafeKeys', function (): void {
        it('does not throw for a flat array with safe keys', function (): void {
            $guard = new SecurityGuard();

            $guard->assertSafeKeys(['name' => 'Alice', 'age' => 30]);

            expect($guard->isForbiddenKey('name'))->toBeFalse();
        });

        it('does not throw for integer keys (not validated)', function (): void {
            $guard = new SecurityGuard();

            $guard->assertSafeKeys([0 => 'a', 1 => 'b']);

            expect($guard->isForbiddenKey('0'))->toBeFalse();
        });

        it('does not throw for non-array input', function (): void {
            $guard = new SecurityGuard();

            $guard->assertSafeKeys('a string');
            $guard->assertSafeKeys(null);

            expect($guard->isForbiddenKey('safe'))->toBeFalse();
        });

        it('throws SecurityException when a nested key is forbidden', function (): void {
            $guard = new SecurityGuard();

            $data = ['user' => ['__construct' => 'evil']];

            expect(fn () => $guard->assertSafeKeys($data))->toThrow(SecurityException::class);
        });

        it('throws SecurityException when recursion depth exceeds maxDepth', function (): void {
            $guard = new SecurityGuard(maxDepth: 1);

            // depth=0 (root) → depth=1 (middle) → depth=2 (inner array) which exceeds maxDepth=1
            $data = ['a' => ['b' => ['c' => 'val']]];

            expect(fn () => $guard->assertSafeKeys($data))->toThrow(SecurityException::class);
        });
    });

    // sanitize()
    describe(SecurityGuard::class . ' > sanitize', function (): void {
        it('removes a forbidden key from the root level', function (): void {
            $guard = new SecurityGuard();

            $result = $guard->sanitize(['name' => 'Alice', '__construct' => 'evil']);

            expect($result)->toBe(['name' => 'Alice']);
        });

        it('recursively removes forbidden keys from nested arrays', function (): void {
            $guard = new SecurityGuard();

            $data = [
                'user' => [
                    'name'        => 'Alice',
                    '__destruct'  => 'evil',
                ],
            ];

            $result = $guard->sanitize($data);

            expect($result)->toBe(['user' => ['name' => 'Alice']]);
        });

        it('returns the array unchanged when no forbidden keys are present', function (): void {
            $guard = new SecurityGuard();
            $data = ['name' => 'Alice', 'age' => 30];

            expect($guard->sanitize($data))->toBe($data);
        });

        it('throws SecurityException when sanitize recursion exceeds maxDepth', function (): void {
            $guard = new SecurityGuard(maxDepth: 1);

            // 3rd level forces depth=2, which exceeds maxDepth=1
            $data = ['a' => ['b' => ['c' => 'deep']]];

            expect(fn () => $guard->sanitize($data))->toThrow(SecurityException::class);
        });
    });

    describe(SecurityGuard::class . ' > sanitize recursion into arrays', function (): void {
        it('strips forbidden keys from objects nested inside an array', function (): void {
            $guard = new SecurityGuard();
            $data = ['users' => [['name' => 'Alice', '__construct' => 'bad']]];
            $result = $guard->sanitize($data);

            expect($result)->toBe(['users' => [['name' => 'Alice']]]);
        });

        it('strips forbidden keys from deeply nested arrays of objects', function (): void {
            $guard = new SecurityGuard();
            $data = ['matrix' => [[['__destruct' => 'bad', 'ok' => 1]]]];
            $result = $guard->sanitize($data);

            expect($result)->toBe(['matrix' => [[['ok' => 1]]]]);
        });

        it('preserves safe objects inside arrays', function (): void {
            $guard = new SecurityGuard();
            $data = ['items' => [['name' => 'Alice'], ['name' => 'Bob']]];
            $result = $guard->sanitize($data);

            expect($result)->toBe($data);
        });

        it('preserves primitive values inside arrays', function (): void {
            $guard = new SecurityGuard();
            $data = ['tags' => ['a', 'b', 'c']];
            $result = $guard->sanitize($data);

            expect($result)->toBe($data);
        });

        it('strips stream wrapper keys from objects inside arrays', function (): void {
            $guard = new SecurityGuard();
            $data = ['rows' => [['php://filter' => 'bad', 'value' => 1]]];
            $result = $guard->sanitize($data);

            expect($result)->toBe(['rows' => [['value' => 1]]]);
        });

        it('handles mixed arrays with objects and primitives', function (): void {
            $guard = new SecurityGuard();
            $data = ['list' => ['safe', ['__clone' => 'bad', 'ok' => true], 42]];
            $result = $guard->sanitize($data);

            expect($result)->toBe(['list' => ['safe', ['ok' => true], 42]]);
        });

        it('throws SecurityException when array nesting exceeds maxDepth', function (): void {
            $guard = new SecurityGuard(maxDepth: 1);
            $data = ['a' => [['b' => [['c' => 'deep']]]]];

            expect(fn () => $guard->sanitize($data))->toThrow(SecurityException::class);
        });
    });
    describe(SecurityGuard::class . ' > prototype pollution keys', function (): void {
        it('returns true for __proto__ as forbidden', function (): void {
            $guard = new SecurityGuard();

            expect($guard->isForbiddenKey('__proto__'))->toBeTrue();
        });

        it('returns true for constructor as forbidden', function (): void {
            $guard = new SecurityGuard();

            expect($guard->isForbiddenKey('constructor'))->toBeTrue();
        });

        it('returns true for prototype as forbidden', function (): void {
            $guard = new SecurityGuard();

            expect($guard->isForbiddenKey('prototype'))->toBeTrue();
        });

        it('assertSafeKey throws SecurityException for __proto__', function (): void {
            $guard = new SecurityGuard();

            expect(fn () => $guard->assertSafeKey('__proto__'))->toThrow(SecurityException::class);
        });

        it('assertSafeKey throws SecurityException for constructor', function (): void {
            $guard = new SecurityGuard();

            expect(fn () => $guard->assertSafeKey('constructor'))->toThrow(SecurityException::class);
        });

        it('assertSafeKeys throws for nested __proto__ key', function (): void {
            $guard = new SecurityGuard();

            expect(fn () => $guard->assertSafeKeys(['safe' => ['__proto__' => ['isAdmin' => true]]]))
                ->toThrow(SecurityException::class);
        });

        it('sanitize removes __proto__ key', function (): void {
            $guard = new SecurityGuard();
            $result = $guard->sanitize(['__proto__' => ['isAdmin' => true], 'name' => 'Alice']);

            expect($result)->toBe(['name' => 'Alice']);
        });

        it('sanitize removes constructor key from nested objects', function (): void {
            $guard = new SecurityGuard();
            $result = $guard->sanitize(['user' => ['constructor' => 'bad', 'name' => 'Alice']]);

            expect($result)->toBe(['user' => ['name' => 'Alice']]);
        });

        it('returns true for __PROTO__ (uppercase, case-insensitive magic match)', function (): void {
            $guard = new SecurityGuard();

            expect($guard->isForbiddenKey('__PROTO__'))->toBeTrue();
        });
    });
    describe(SecurityGuard::class . ' > case-insensitive stream wrapper prefix', function (): void {
        it('returns true for uppercase PHP:// stream wrapper URI', function (): void {
            $guard = new SecurityGuard();

            expect($guard->isForbiddenKey('PHP://input'))->toBeTrue();
        });

        it('returns true for mixed-case Phar:// stream wrapper URI', function (): void {
            $guard = new SecurityGuard();

            expect($guard->isForbiddenKey('Phar://shell.phar/exec.php'))->toBeTrue();
        });

        it('returns true for uppercase HTTP:// stream wrapper URI', function (): void {
            $guard = new SecurityGuard();

            expect($guard->isForbiddenKey('HTTP://evil.com/data'))->toBeTrue();
        });

        it('returns true for uppercase FILE:// stream wrapper URI', function (): void {
            $guard = new SecurityGuard();

            expect($guard->isForbiddenKey('FILE:///etc/passwd'))->toBeTrue();
        });

        it('assertSafeKey throws SecurityException for PHP://filter', function (): void {
            $guard = new SecurityGuard();

            expect(fn () => $guard->assertSafeKey('PHP://filter/convert.base64-encode/resource=index.php'))
                ->toThrow(SecurityException::class);
        });

        it('returns false for a word starting with php but without scheme', function (): void {
            $guard = new SecurityGuard();

            expect($guard->isForbiddenKey('phpunit_test'))->toBeFalse();
        });

        it('returns true for DATA:// uppercase stream wrapper', function (): void {
            $guard = new SecurityGuard();

            expect($guard->isForbiddenKey('DATA://text/plain;base64,abc'))->toBeTrue();
        });
    });

    describe(SecurityGuard::class . ' > SEC-013 de-coupled keys (JS-specific keys not blocked in PHP)', function (): void {
        it('does not block JS legacy prototype __defineGetter__', function (): void {
            $guard = new SecurityGuard();

            expect($guard->isForbiddenKey('__defineGetter__'))->toBeFalse();
        });

        it('does not block JS legacy prototype __defineSetter__', function (): void {
            $guard = new SecurityGuard();

            expect($guard->isForbiddenKey('__defineSetter__'))->toBeFalse();
        });

        it('does not block JS legacy prototype __lookupGetter__', function (): void {
            $guard = new SecurityGuard();

            expect($guard->isForbiddenKey('__lookupGetter__'))->toBeFalse();
        });

        it('does not block JS Object.prototype shadow hasOwnProperty', function (): void {
            $guard = new SecurityGuard();

            expect($guard->isForbiddenKey('hasOwnProperty'))->toBeFalse();
        });

        it('does not block JS-specific javascript: URI scheme', function (): void {
            $guard = new SecurityGuard();

            expect($guard->isForbiddenKey('javascript:'))->toBeFalse();
        });

        it('does not block JS-specific blob: protocol', function (): void {
            $guard = new SecurityGuard();

            expect($guard->isForbiddenKey('blob:'))->toBeFalse();
        });

        it('does not block Node.js __dirname global', function (): void {
            $guard = new SecurityGuard();

            expect($guard->isForbiddenKey('__dirname'))->toBeFalse();
        });

        it('does not block Node.js __filename global', function (): void {
            $guard = new SecurityGuard();

            expect($guard->isForbiddenKey('__filename'))->toBeFalse();
        });

        it('does not block ws:// WebSocket URI scheme', function (): void {
            $guard = new SecurityGuard();

            expect($guard->isForbiddenKey('ws://'))->toBeFalse();
        });

        it('does not block node: protocol URI scheme', function (): void {
            $guard = new SecurityGuard();

            expect($guard->isForbiddenKey('node:'))->toBeFalse();
        });
    });
});
