<?php

declare(strict_types=1);

use SafeAccess\Inline\Accessors\Formats\ArrayAccessor;
use SafeAccess\Inline\Accessors\Formats\JsonAccessor;
use SafeAccess\Inline\Core\InlineBuilderAccessor;
use SafeAccess\Inline\Exceptions\InvalidFormatException;
use SafeAccess\Inline\Exceptions\PathNotFoundException;
use SafeAccess\Inline\Exceptions\ReadonlyViolationException;
use SafeAccess\Inline\Exceptions\SecurityException;
use SafeAccess\Inline\Security\SecurityGuard;
use SafeAccess\Inline\Tests\Mocks\FakePathCache;

function makeArrayAccessor(mixed $data = []): ArrayAccessor
{
    return (new InlineBuilderAccessor())->builder()->array($data);
}

describe(ArrayAccessor::class, function (): void {
    beforeEach(function (): void {
        $this->accessor = makeArrayAccessor(['name' => 'Alice', 'age' => 30]);
    });

    // ArrayAccessor::from() - format validation
    describe(ArrayAccessor::class . ' > from', function (): void {
        it('accepts a plain PHP array', function (): void {
            $accessor = makeArrayAccessor(['key' => 'val']);

            expect($accessor->get('key'))->toBe('val');
        });

        it('accepts an object and casts it to array', function (): void {
            $obj = (object) ['city' => 'Porto'];
            $accessor = (new InlineBuilderAccessor())->builder()->array($obj);

            expect($accessor->get('city'))->toBe('Porto');
        });

        it('throws InvalidFormatException for a string input', function (): void {
            $parser = (new InlineBuilderAccessor())->builder();

            expect(fn () => $parser->array('not-an-array'))
                ->toThrow(InvalidFormatException::class);
        });

        it('throws InvalidFormatException for null input', function (): void {
            $parser = (new InlineBuilderAccessor())->builder();

            expect(fn () => $parser->array(null))
                ->toThrow(InvalidFormatException::class);
        });

        it('throws InvalidFormatException for an integer input', function (): void {
            $parser = (new InlineBuilderAccessor())->builder();

            expect(fn () => $parser->array(42))
                ->toThrow(InvalidFormatException::class);
        });

        it('stores the raw input for retrieval via getRaw()', function (): void {
            $data = ['name' => 'Alice'];
            $accessor = makeArrayAccessor($data);

            expect($accessor->getRaw())->toBe($data);
        });
    });

    // AbstractAccessor via ArrayAccessor: read operations
    describe(ArrayAccessor::class . ' > get', function (): void {
        it('returns a top-level value by path', function (): void {
            expect($this->accessor->get('name'))->toBe('Alice');
        });

        it('returns a nested value', function (): void {
            $accessor = makeArrayAccessor(['user' => ['city' => 'Porto']]);

            expect($accessor->get('user.city'))->toBe('Porto');
        });

        it('returns null as the default when key is missing', function (): void {
            expect($this->accessor->get('missing'))->toBeNull();
        });

        it('returns the given default when key is missing', function (): void {
            expect($this->accessor->get('missing', 'fallback'))->toBe('fallback');
        });
    });

    describe(ArrayAccessor::class . ' > has', function (): void {
        it('returns true for an existing key', function (): void {
            expect($this->accessor->has('name'))->toBeTrue();
        });

        it('returns false for a missing key', function (): void {
            expect($this->accessor->has('missing'))->toBeFalse();
        });

        it('returns true even when the value is null (key exists)', function (): void {
            $accessor = makeArrayAccessor(['key' => null]);

            expect($accessor->has('key'))->toBeTrue();
        });
    });

    describe(ArrayAccessor::class . ' > getAt and hasAt', function (): void {
        it('getAt returns a value using a segment array', function (): void {
            $accessor = makeArrayAccessor(['user' => ['name' => 'Alice']]);

            expect($accessor->getAt(['user', 'name']))->toBe('Alice');
        });

        it('getAt returns the default for a missing segment', function (): void {
            expect($this->accessor->getAt(['missing'], 'fallback'))->toBe('fallback');
        });

        it('hasAt returns true when the segment path exists', function (): void {
            $accessor = makeArrayAccessor(['a' => ['b' => 1]]);

            expect($accessor->hasAt(['a', 'b']))->toBeTrue();
        });

        it('hasAt returns false when the segment path is missing', function (): void {
            expect($this->accessor->hasAt(['missing']))->toBeFalse();
        });
    });

    describe(ArrayAccessor::class . ' > getOrFail', function (): void {
        it('returns the value when the path exists', function (): void {
            expect($this->accessor->getOrFail('name'))->toBe('Alice');
        });

        it('throws PathNotFoundException when the path is missing', function (): void {
            expect(fn () => $this->accessor->getOrFail('missing'))
                ->toThrow(PathNotFoundException::class);
        });
    });

    describe(ArrayAccessor::class . ' > getMany', function (): void {
        it('returns multiple values keyed by path', function (): void {
            $result = $this->accessor->getMany(['name' => null, 'age' => null]);

            expect($result['name'])->toBe('Alice');
            expect($result['age'])->toBe(30);
        });

        it('uses the provided default for missing paths', function (): void {
            $result = $this->accessor->getMany(['missing' => 'default-val']);

            expect($result['missing'])->toBe('default-val');
        });
    });

    describe(ArrayAccessor::class . ' > count and keys', function (): void {
        it('count returns the number of top-level keys', function (): void {
            expect($this->accessor->count())->toBe(2);
        });

        it('count returns 0 for a non-array value at path', function (): void {
            expect($this->accessor->count('name'))->toBe(0);
        });

        it('count returns the size of an array at a path', function (): void {
            $accessor = makeArrayAccessor(['items' => ['a', 'b', 'c']]);

            expect($accessor->count('items'))->toBe(3);
        });

        it('keys returns the top-level key names', function (): void {
            expect($this->accessor->keys())->toBe(['name', 'age']);
        });

        it('keys returns numeric indices as strings for a sequential array (parity with JS Object.keys)', function (): void {
            $accessor = makeArrayAccessor(['x', 'y', 'z']);

            expect($accessor->keys())->toBe(['0', '1', '2']);
        });

        it('keys returns an empty array for a non-array value at path', function (): void {
            expect($this->accessor->keys('name'))->toBe([]);
        });
    });

    describe(ArrayAccessor::class . ' > all', function (): void {
        it('returns all parsed data', function (): void {
            expect($this->accessor->all())->toBe(['name' => 'Alice', 'age' => 30]);
        });
    });

    // AbstractAccessor via ArrayAccessor: write operations (immutable)
    describe(ArrayAccessor::class . ' > set', function (): void {
        it('returns a new accessor with the value set', function (): void {
            $updated = $this->accessor->set('name', 'Bob');

            expect($updated->get('name'))->toBe('Bob');
        });

        it('does not mutate the original', function (): void {
            $this->accessor->set('name', 'Bob');

            expect($this->accessor->get('name'))->toBe('Alice');
        });

        it('creates nested keys when setting a deep path', function (): void {
            $updated = makeArrayAccessor([])->set('user.name', 'Alice');

            expect($updated->get('user.name'))->toBe('Alice');
        });

        it('returns a new accessor from setAt', function (): void {
            $updated = $this->accessor->setAt(['name'], 'Bob');

            expect($updated->get('name'))->toBe('Bob');
        });
    });

    describe(ArrayAccessor::class . ' > remove', function (): void {
        it('returns a new accessor with the key removed', function (): void {
            $updated = $this->accessor->remove('name');

            expect($updated->has('name'))->toBeFalse();
        });

        it('does not mutate the original', function (): void {
            $this->accessor->remove('name');

            expect($this->accessor->has('name'))->toBeTrue();
        });

        it('returns a new accessor from removeAt', function (): void {
            $updated = $this->accessor->removeAt(['name']);

            expect($updated->has('name'))->toBeFalse();
        });
    });

    describe(ArrayAccessor::class . ' > merge and mergeAll', function (): void {
        it('deep-merges data at a path', function (): void {
            $accessor = makeArrayAccessor(['user' => ['name' => 'Alice', 'age' => 30]]);
            $updated = $accessor->merge('user', ['age' => 31, 'city' => 'Porto']);

            expect($updated->get('user.name'))->toBe('Alice');
            expect($updated->get('user.age'))->toBe(31);
            expect($updated->get('user.city'))->toBe('Porto');
        });

        it('mergeAll merges at the root level', function (): void {
            $updated = $this->accessor->mergeAll(['country' => 'BR']);

            expect($updated->get('name'))->toBe('Alice');
            expect($updated->get('country'))->toBe('BR');
        });

        it('does not mutate the original on merge', function (): void {
            $this->accessor->merge('user', ['age' => 99]);

            expect($this->accessor->has('user'))->toBeFalse();
        });
    });

    // AbstractAccessor via ArrayAccessor: readonly mode
    describe(ArrayAccessor::class . ' > readonly', function (): void {
        it('set() throws ReadonlyViolationException when readonly', function (): void {
            $ro = $this->accessor->readonly(true);

            expect(fn () => $ro->set('name', 'Bob'))
                ->toThrow(ReadonlyViolationException::class);
        });

        it('remove() throws ReadonlyViolationException when readonly', function (): void {
            $ro = $this->accessor->readonly(true);

            expect(fn () => $ro->remove('name'))
                ->toThrow(ReadonlyViolationException::class);
        });

        it('setAt() throws ReadonlyViolationException when readonly', function (): void {
            $ro = $this->accessor->readonly(true);

            expect(fn () => $ro->setAt(['name'], 'Bob'))
                ->toThrow(ReadonlyViolationException::class);
        });

        it('removeAt() throws ReadonlyViolationException when readonly', function (): void {
            $ro = $this->accessor->readonly(true);

            expect(fn () => $ro->removeAt(['name']))
                ->toThrow(ReadonlyViolationException::class);
        });

        it('merge() throws ReadonlyViolationException when readonly', function (): void {
            $ro = $this->accessor->readonly(true);

            expect(fn () => $ro->merge('user', ['name' => 'Bob']))
                ->toThrow(ReadonlyViolationException::class);
        });

        it('mergeAll() throws ReadonlyViolationException when readonly', function (): void {
            $ro = $this->accessor->readonly(true);

            expect(fn () => $ro->mergeAll(['extra' => 'data']))
                ->toThrow(ReadonlyViolationException::class);
        });

        it('readonly(false) re-enables mutations', function (): void {
            $ro = $this->accessor->readonly(true);
            $writable = $ro->readonly(false);

            $updated = $writable->set('name', 'Bob');

            expect($updated->get('name'))->toBe('Bob');
        });

        it('returns a new instance from readonly() (immutability)', function (): void {
            $ro = $this->accessor->readonly(true);

            expect($ro)->not->toBe($this->accessor);
        });
    });

    // AbstractAccessor via ArrayAccessor: strict mode
    describe(ArrayAccessor::class . ' > strict', function (): void {
        it('strict(false) skips security validation on ingestion', function (): void {
            $factory = (new InlineBuilderAccessor())->builder();
            // With strict=true (default), a forbidden key like __construct would throw
            // With strict=false, it is silently accepted
            $accessor = (new ArrayAccessor(
                (new \SafeAccess\Inline\Core\DotNotationParser(
                    new SecurityGuard(),
                    new \SafeAccess\Inline\Security\SecurityParser(),
                    new FakePathCache(),
                    new \SafeAccess\Inline\PathQuery\SegmentParser(
                        new \SafeAccess\Inline\PathQuery\SegmentFilterParser(new SecurityGuard())
                    ),
                    new \SafeAccess\Inline\PathQuery\SegmentPathResolver(
                        new \SafeAccess\Inline\PathQuery\SegmentFilterParser(new SecurityGuard())
                    ),
                ))
            ))->strict(false)->from(['__construct' => 'injected']);

            expect($accessor->get('__construct'))->toBe('injected');
        });

        it('strict(true) throws SecurityException for forbidden keys on ingestion', function (): void {
            $accessor = new ArrayAccessor(
                (new \SafeAccess\Inline\Core\DotNotationParser(
                    new SecurityGuard(),
                    new \SafeAccess\Inline\Security\SecurityParser(),
                    new FakePathCache(),
                    new \SafeAccess\Inline\PathQuery\SegmentParser(
                        new \SafeAccess\Inline\PathQuery\SegmentFilterParser(new SecurityGuard())
                    ),
                    new \SafeAccess\Inline\PathQuery\SegmentPathResolver(
                        new \SafeAccess\Inline\PathQuery\SegmentFilterParser(new SecurityGuard())
                    ),
                ))
            );

            expect(fn () => $accessor->strict(true)->from(['__construct' => 'injected']))
                ->toThrow(SecurityException::class);
        });
    });

    // AbstractAccessor via JsonAccessor: strict(false) bypasses assertPayload
    describe(JsonAccessor::class . ' > strict payload bypass', function (): void {
        it('strict(false) bypasses payload size validation', function (): void {
            $tinyParser = new \SafeAccess\Inline\Security\SecurityParser(maxPayloadBytes: 5);
            $accessor = (new JsonAccessor(
                (new \SafeAccess\Inline\Core\DotNotationParser(
                    new SecurityGuard(),
                    $tinyParser,
                    new FakePathCache(),
                    new \SafeAccess\Inline\PathQuery\SegmentParser(
                        new \SafeAccess\Inline\PathQuery\SegmentFilterParser(new SecurityGuard())
                    ),
                    new \SafeAccess\Inline\PathQuery\SegmentPathResolver(
                        new \SafeAccess\Inline\PathQuery\SegmentFilterParser(new SecurityGuard())
                    ),
                ))
            ))->strict(false)->from('{"name":"Alice"}');

            expect($accessor->get('name'))->toBe('Alice');
        });

        it('strict(true) enforces payload size validation', function (): void {
            $tinyParser = new \SafeAccess\Inline\Security\SecurityParser(maxPayloadBytes: 5);
            $accessor = new JsonAccessor(
                (new \SafeAccess\Inline\Core\DotNotationParser(
                    new SecurityGuard(),
                    $tinyParser,
                    new FakePathCache(),
                    new \SafeAccess\Inline\PathQuery\SegmentParser(
                        new \SafeAccess\Inline\PathQuery\SegmentFilterParser(new SecurityGuard())
                    ),
                    new \SafeAccess\Inline\PathQuery\SegmentPathResolver(
                        new \SafeAccess\Inline\PathQuery\SegmentFilterParser(new SecurityGuard())
                    ),
                ))
            );

            expect(fn () => $accessor->from('{"name":"Alice"}'))
                ->toThrow(SecurityException::class);
        });

        it('does not call assertPayload for non-string data', function (): void {
            $tinyParser = new \SafeAccess\Inline\Security\SecurityParser(maxPayloadBytes: 1);
            $accessor = new \SafeAccess\Inline\Accessors\Formats\ArrayAccessor(
                (new \SafeAccess\Inline\Core\DotNotationParser(
                    new SecurityGuard(),
                    $tinyParser,
                    new FakePathCache(),
                    new \SafeAccess\Inline\PathQuery\SegmentParser(
                        new \SafeAccess\Inline\PathQuery\SegmentFilterParser(new SecurityGuard())
                    ),
                    new \SafeAccess\Inline\PathQuery\SegmentPathResolver(
                        new \SafeAccess\Inline\PathQuery\SegmentFilterParser(new SecurityGuard())
                    ),
                ))
            );

            expect($accessor->from(['a' => 1])->get('a'))->toBe(1);
        });
    });
});
