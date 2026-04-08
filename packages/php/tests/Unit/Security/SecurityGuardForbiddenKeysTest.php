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
});
