<?php

declare(strict_types=1);

use SafeAccess\Inline\Exceptions\SecurityException;
use SafeAccess\Inline\Security\SecurityGuard;

describe(SecurityGuard::class, function (): void {
    // isForbiddenKey()
    describe(SecurityGuard::class . ' > isForbiddenKey', function (): void {
        it('returns true for a PHP magic method key', function (): void {
            $guard = new SecurityGuard();

            expect($guard->isForbiddenKey('__construct'))->toBeTrue();
        });

        it('returns true for each default PHP magic method', function (): void {
            $guard = new SecurityGuard();
            $magics = [
                '__destruct', '__call', '__callStatic', '__get', '__set',
                '__isset', '__unset', '__sleep', '__wakeup', '__serialize',
                '__unserialize', '__toString', '__invoke', '__set_state', '__debugInfo',
            ];

            foreach ($magics as $key) {
                expect($guard->isForbiddenKey($key))->toBeTrue("Expected '{$key}' to be forbidden");
            }
        });

        it('returns true for superglobal keys', function (): void {
            $guard = new SecurityGuard();
            $superglobals = ['GLOBALS', '_GET', '_POST', '_COOKIE', '_REQUEST', '_SERVER', '_ENV', '_FILES', '_SESSION'];

            foreach ($superglobals as $key) {
                expect($guard->isForbiddenKey($key))->toBeTrue("Expected '{$key}' to be forbidden");
            }
        });

        it('returns true for stream wrapper URI keys', function (): void {
            $guard = new SecurityGuard();
            $wrappers = ['php://', 'http://', 'https://', 'ftp://', 'phar://', 'file://', 'data://'];

            foreach ($wrappers as $key) {
                expect($guard->isForbiddenKey($key))->toBeTrue("Expected '{$key}' to be forbidden");
            }
        });
        it('returns true for fully-formed phar stream wrapper URI', function (): void {
            $guard = new SecurityGuard();

            expect($guard->isForbiddenKey('phar://shell.phar/exec.php'))->toBeTrue();
        });

        it('returns true for fully-formed http stream wrapper URI', function (): void {
            $guard = new SecurityGuard();

            expect($guard->isForbiddenKey('http://evil.com/data'))->toBeTrue();
        });

        it('returns true for fully-formed ftp stream wrapper URI', function (): void {
            $guard = new SecurityGuard();

            expect($guard->isForbiddenKey('ftp://attacker.host/etc/passwd'))->toBeTrue();
        });

        it('returns true for fully-formed file stream wrapper URI', function (): void {
            $guard = new SecurityGuard();

            expect($guard->isForbiddenKey('file:///etc/passwd'))->toBeTrue();
        });

        it('returns false for a key that starts with php but not the php:// scheme', function (): void {
            $guard = new SecurityGuard();

            expect($guard->isForbiddenKey('phpunit_config'))->toBeFalse();
        });

        it('returns false for a key that starts with phar but not the phar:// scheme', function (): void {
            $guard = new SecurityGuard();

            expect($guard->isForbiddenKey('pharaoh'))->toBeFalse();
        });

        it('returns true for a nested php:// path used as a key', function (): void {
            $guard = new SecurityGuard();

            expect($guard->isForbiddenKey('php://filter/convert.base64-encode/resource=/etc/passwd'))->toBeTrue();
        });
        it('returns true for an uppercase magic method key __CONSTRUCT', function (): void {
            $guard = new SecurityGuard();

            expect($guard->isForbiddenKey('__CONSTRUCT'))->toBeTrue();
        });

        it('returns true for a mixed-case magic method key __ToString', function (): void {
            $guard = new SecurityGuard();

            expect($guard->isForbiddenKey('__ToString'))->toBeTrue();
        });

        it('returns true for __GET in uppercase', function (): void {
            $guard = new SecurityGuard();

            expect($guard->isForbiddenKey('__GET'))->toBeTrue();
        });

        it('returns true for __CALLSTATIC in uppercase', function (): void {
            $guard = new SecurityGuard();

            expect($guard->isForbiddenKey('__CALLSTATIC'))->toBeTrue();
        });

        it('assertSafeKey throws SecurityException for uppercase __CONSTRUCT', function (): void {
            $guard = new SecurityGuard();

            expect(fn () => $guard->assertSafeKey('__CONSTRUCT'))->toThrow(
                SecurityException::class,
                "Forbidden key '__CONSTRUCT' detected."
            );
        });

        it('assertSafeKey throws SecurityException for mixed-case __ToString', function (): void {
            $guard = new SecurityGuard();

            expect(fn () => $guard->assertSafeKey('__ToString'))->toThrow(SecurityException::class);
        });

        it('returns false for a double-underscore-prefixed key that is not a magic method', function (): void {
            $guard = new SecurityGuard();

            expect($guard->isForbiddenKey('__custom_field'))->toBeFalse();
        });
        it('returns true for __clone', function (): void {
            $guard = new SecurityGuard();

            expect($guard->isForbiddenKey('__clone'))->toBeTrue();
        });

        it('returns true for uppercase __CLONE (SEC-006, SEC-002 combined)', function (): void {
            $guard = new SecurityGuard();

            expect($guard->isForbiddenKey('__CLONE'))->toBeTrue();
        });

        it('assertSafeKey throws SecurityException for __clone', function (): void {
            $guard = new SecurityGuard();

            expect(fn () => $guard->assertSafeKey('__clone'))->toThrow(SecurityException::class);
        });

        it('assertSafeKey exception message includes the forbidden key name for __clone', function (): void {
            $guard = new SecurityGuard();

            expect(fn () => $guard->assertSafeKey('__clone'))
                ->toThrow(SecurityException::class, '__clone');
        });

        it('returns true for mixed-case __Clone (SEC-006, SEC-002 combined)', function (): void {
            $guard = new SecurityGuard();

            expect($guard->isForbiddenKey('__Clone'))->toBeTrue();
        });

        it('returns true for randomly cased __cLone (SEC-006, SEC-002 combined)', function (): void {
            $guard = new SecurityGuard();

            expect($guard->isForbiddenKey('__cLone'))->toBeTrue();
        });

        it('assertSafeKeys throws for a nested __clone key', function (): void {
            $guard = new SecurityGuard();

            expect(fn () => $guard->assertSafeKeys(['normal' => 'ok', '__clone' => 'bad']))
                ->toThrow(SecurityException::class);
        });

        it('returns false for a safe key', function (): void {
            $guard = new SecurityGuard();

            expect($guard->isForbiddenKey('username'))->toBeFalse();
            expect($guard->isForbiddenKey('email'))->toBeFalse();
            expect($guard->isForbiddenKey('0'))->toBeFalse();
        });

        it('returns true for an extra forbidden key provided at construction', function (): void {
            $guard = new SecurityGuard(extraForbiddenKeys: ['custom_bad_key']);

            expect($guard->isForbiddenKey('custom_bad_key'))->toBeTrue();
            expect($guard->isForbiddenKey('safe_key'))->toBeFalse();
        });
    });

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
