<?php

declare(strict_types=1);

use SafeAccess\Inline\Accessors\Formats\ObjectAccessor;
use SafeAccess\Inline\Core\InlineBuilderAccessor;
use SafeAccess\Inline\Exceptions\InvalidFormatException;
use SafeAccess\Inline\Exceptions\SecurityException;
use SafeAccess\Inline\Security\SecurityParser;

describe(ObjectAccessor::class, function (): void {
    describe(ObjectAccessor::class . ' > from', function (): void {
        it('parses a stdClass object', function (): void {
            $obj = (object) ['name' => 'Alice'];
            $accessor = factory()->object($obj);

            expect($accessor->get('name'))->toBe('Alice');
        });

        it('parses nested object properties', function (): void {
            $obj = (object) ['user' => (object) ['city' => 'Porto']];
            $accessor = factory()->object($obj);

            expect($accessor->get('user.city'))->toBe('Porto');
        });

        it('stores the raw input', function (): void {
            $obj = (object) ['key' => 'val'];
            $accessor = factory()->object($obj);

            expect($accessor->getRaw())->toBe($obj);
        });

        it('throws InvalidFormatException for an array input', function (): void {
            expect(fn () => factory()->object(['key' => 'val']))
                ->toThrow(InvalidFormatException::class);
        });

        it('throws InvalidFormatException for a string input', function (): void {
            expect(fn () => factory()->object('not-an-object'))
                ->toThrow(InvalidFormatException::class);
        });

        it('throws InvalidFormatException for null input', function (): void {
            expect(fn () => factory()->object(null))
                ->toThrow(InvalidFormatException::class);
        });

        it('converts an object with a nested object property', function (): void {
            $obj = (object) ['outer' => (object) ['inner' => 42]];
            $accessor = factory()->object($obj);

            expect($accessor->get('outer.inner'))->toBe(42);
        });

        it('converts an object with an array property containing objects', function (): void {
            $obj = (object) ['items' => [(object) ['x' => 1], (object) ['x' => 2]]];
            $accessor = factory()->object($obj);

            expect($accessor->get('items.0.x'))->toBe(1);
            expect($accessor->get('items.1.x'))->toBe(2);
        });

        it('converts an object with an array property containing nested sub-arrays', function (): void {
            $obj = (object) ['data' => [['a' => 1], ['b' => 2]]];
            $accessor = factory()->object($obj);

            expect($accessor->get('data.0.a'))->toBe(1);
            expect($accessor->get('data.1.b'))->toBe(2);
        });

        it('throws SecurityException when object nesting exceeds the configured maxDepth', function (): void {
            $builder = (new InlineBuilderAccessor())->withSecurityParser(new SecurityParser(maxDepth: 1));

            $inner = (object) ['value' => 'deep'];
            $middle = (object) ['child' => $inner];
            $root = (object) ['nested' => $middle];

            expect(fn () => $builder->builder()->object($root))->toThrow(SecurityException::class);
        });

        it('does not throw when object nesting is within the configured maxDepth', function (): void {
            $builder = (new InlineBuilderAccessor())->withSecurityParser(new SecurityParser(maxDepth: 10));
            $obj = (object) ['user' => (object) ['city' => 'Porto']];

            $accessor = $builder->builder()->object($obj);

            expect($accessor->get('user.city'))->toBe('Porto');
        });

        it('throws SecurityException when a deeply nested array inside an object exceeds maxDepth', function (): void {
            $builder = (new InlineBuilderAccessor())->withSecurityParser(new SecurityParser(maxDepth: 1));

            $obj = (object) ['data' => [['deep' => 'value']]];

            expect(fn () => $builder->builder()->object($obj))->toThrow(SecurityException::class);
        });

        it('does not throw for an object nested within the configured maxDepth', function (): void {
            $builder = (new InlineBuilderAccessor())->withSecurityParser(new SecurityParser(maxDepth: 10));
            $obj = (object) ['l1' => (object) ['l2' => (object) ['value' => 'ok']]];

            $accessor = $builder->builder()->object($obj);

            expect($accessor->get('l1.l2.value'))->toBe('ok');
        });

        it('does not throw for a flat object with default SecurityParser settings', function (): void {
            $obj = (object) ['name' => 'Alice', 'age' => 30];

            $accessor = factory()->object($obj);

            expect($accessor->get('name'))->toBe('Alice');
        });

        it('SecurityException message mentions the exceeded depth for objects', function (): void {
            $builder = (new InlineBuilderAccessor())->withSecurityParser(new SecurityParser(maxDepth: 0));

            $inner = (object) ['value' => 'deep'];
            $root = (object) ['nested' => $inner];

            expect(fn () => $builder->builder()->object($root))
                ->toThrow(SecurityException::class, 'exceeds maximum');
        });
    });
});
