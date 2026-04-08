<?php

declare(strict_types=1);

use SafeAccess\Inline\Exceptions\SecurityException;
use SafeAccess\Inline\PathQuery\Enums\SegmentType;
use SafeAccess\Inline\PathQuery\SegmentFilterParser;
use SafeAccess\Inline\PathQuery\SegmentParser;
use SafeAccess\Inline\PathQuery\SegmentPathResolver;
use SafeAccess\Inline\Security\SecurityGuard;

describe(SegmentPathResolver::class, function (): void {
    beforeEach(function (): void {
        $guard = new SecurityGuard();
        $this->filterParser = new SegmentFilterParser($guard);
        $this->segmentParser = new SegmentParser($this->filterParser);
        $this->resolver = new SegmentPathResolver($this->filterParser);
        $this->r = function (array $data, string $path, mixed $default = null): mixed {
            $segments = $this->segmentParser->parseSegments($path);
            return $this->resolver->resolve($data, $segments, 0, $default, 100);
        };
    });

    // resolve() - basic traversal
    describe(SegmentPathResolver::class . ' > resolve basics', function (): void {
        it('returns the value for an existing key', function (): void {
            $data = ['name' => 'Alice'];

            expect(($this->r)($data, 'name'))->toBe('Alice');
        });

        it('returns the default when the key does not exist', function (): void {
            $data = ['name' => 'Alice'];

            expect(($this->r)($data, 'missing', 'fallback'))->toBe('fallback');
        });

        it('resolves a nested two-level path', function (): void {
            $data = ['user' => ['name' => 'Alice']];

            expect(($this->r)($data, 'user.name'))->toBe('Alice');
        });

        it('resolves a nested three-level path', function (): void {
            $data = ['user' => ['address' => ['city' => 'Porto Alegre']]];

            expect(($this->r)($data, 'user.address.city'))->toBe('Porto Alegre');
        });

        it('returns current value when segments list is empty', function (): void {
            $data = ['key' => 'value'];
            $result = $this->resolver->resolve($data, [], 0, null, 100);

            expect($result)->toBe($data);
        });

        it('throws SecurityException when index exceeds maxDepth', function (): void {
            $data = ['a' => 1];
            $segments = [['type' => SegmentType::Key, 'value' => 'a']];

            expect(fn () => $this->resolver->resolve($data, $segments, 200, null, 100))
                ->toThrow(SecurityException::class);
        });
    });

    // resolve() - wildcard
    describe(SegmentPathResolver::class . ' > resolve wildcard', function (): void {
        it('expands all children with a wildcard', function (): void {
            $data = ['users' => ['Alice', 'Bob', 'Carol']];

            expect(($this->r)($data, 'users.*'))->toBe(['Alice', 'Bob', 'Carol']);
        });

        it('returns default for a wildcard on a non-array value', function (): void {
            $data = ['name' => 'Alice'];

            expect(($this->r)($data, 'name.*', 'default'))->toBe('default');
        });

        it('chains wildcard with a nested key', function (): void {
            $data = ['users' => [['name' => 'Alice'], ['name' => 'Bob']]];

            expect(($this->r)($data, 'users.*.name'))->toBe(['Alice', 'Bob']);
        });
    });

    // resolve() - recursive descent
    describe(SegmentPathResolver::class . ' > resolve descent', function (): void {
        it('collects all values for a recursive descent key', function (): void {
            $data = [
                'name' => 'Alice',
                'friend' => ['name' => 'Bob'],
            ];

            $result = ($this->r)($data, '..name');

            expect($result)->toContain('Alice');
            expect($result)->toContain('Bob');
        });

        it('collects values for DescentMulti with multiple keys', function (): void {
            $data = [
                'a' => 1,
                'b' => 2,
                'nested' => ['a' => 10, 'b' => 20],
            ];

            $result = ($this->r)($data, "..['a','b']");

            expect($result)->toContain(1);
            expect($result)->toContain(2);
            expect($result)->toContain(10);
            expect($result)->toContain(20);
        });

        it('returns default when DescentMulti finds no keys', function (): void {
            $data = ['x' => 1];

            $result = ($this->r)($data, "..['missing1','missing2']", 'fallback');

            expect($result)->toBe('fallback');
        });
    });

    // resolve() - filter
    describe(SegmentPathResolver::class . ' > resolve filter', function (): void {
        it('filters array items that satisfy a condition', function (): void {
            $data = ['users' => [
                ['name' => 'Alice', 'age' => 30],
                ['name' => 'Bob', 'age' => 17],
                ['name' => 'Carol', 'age' => 25],
            ]];

            $result = ($this->r)($data, 'users[?age>18]');

            expect($result)->toHaveCount(2);
            expect($result[0]['name'])->toBe('Alice');
            expect($result[1]['name'])->toBe('Carol');
        });

        it('returns empty array when no items match the filter', function (): void {
            $data = ['users' => [['name' => 'Alice', 'age' => 10]]];

            $result = ($this->r)($data, 'users[?age>100]');

            expect($result)->toBeEmpty();
        });

        it('returns default when the filter is applied to a non-array value', function (): void {
            $data = ['name' => 'Alice'];

            $result = ($this->r)($data, 'name[?age>18]', 'fallback');

            expect($result)->toBe('fallback');
        });

        it('chains filter with a key to access a field of filtered items', function (): void {
            $data = ['users' => [
                ['name' => 'Alice', 'active' => true],
                ['name' => 'Bob', 'active' => false],
            ]];

            $result = ($this->r)($data, 'users[?active==true].name');

            expect($result)->toBe(['Alice']);
        });
    });

    // resolve() - multi-key / multi-index
    describe(SegmentPathResolver::class . ' > resolve multi-key and multi-index', function (): void {
        it("selects multiple keys with ['a','b']", function (): void {
            $data = ['data' => ['a' => 1, 'b' => 2, 'c' => 3]];

            $result = ($this->r)($data, "data['a','b']");

            expect($result)->toBe([1, 2]);
        });

        it('returns default for a multi-key miss', function (): void {
            $data = ['data' => ['a' => 1]];

            $result = ($this->r)($data, "data['missing']", 'fallback');

            expect($result)->toBe('fallback');
        });

        it('selects multiple indices [0,2]', function (): void {
            $data = ['items' => ['a', 'b', 'c', 'd']];

            $result = ($this->r)($data, 'items[0,2]');

            expect($result)->toBe(['a', 'c']);
        });

        it('resolves a negative multi-index [-1] via MultiIndex segment', function (): void {
            $segments = [
                ['type' => SegmentType::Key, 'value' => 'items'],
                ['type' => SegmentType::MultiIndex, 'indices' => [-1]],
            ];
            $data = ['items' => ['a', 'b', 'c']];

            $result = $this->resolver->resolve($data, $segments, 0, null, 100);

            expect($result)->toBe(['c']);
        });

        it('returns default when multi-index is out of bounds', function (): void {
            $data = ['items' => ['a']];

            $result = ($this->r)($data, 'items[0,99]', 'fallback');

            expect($result[1])->toBe('fallback');
        });

        it('returns default for multi-key on a non-array', function (): void {
            $segments = [
                ['type' => SegmentType::MultiKey, 'keys' => ['a', 'b']],
            ];

            $result = $this->resolver->resolve('not-an-array', $segments, 0, 'fallback', 100);

            expect($result)->toBe('fallback');
        });

        it('returns default for multi-index on a non-array', function (): void {
            $segments = [
                ['type' => SegmentType::MultiIndex, 'indices' => [0, 1]],
            ];

            $result = $this->resolver->resolve('not-an-array', $segments, 0, 'fallback', 100);

            expect($result)->toBe('fallback');
        });
    });

    // resolve() - slice
    describe(SegmentPathResolver::class . ' > resolve slice', function (): void {
        it('slices an array [1:3]', function (): void {
            $data = ['items' => ['a', 'b', 'c', 'd', 'e']];

            $result = ($this->r)($data, 'items[1:3]');

            expect($result)->toBe(['b', 'c']);
        });

        it('slices with a step [0:6:2]', function (): void {
            $data = ['items' => ['a', 'b', 'c', 'd', 'e', 'f']];

            $result = ($this->r)($data, 'items[0:6:2]');

            expect($result)->toBe(['a', 'c', 'e']);
        });

        it('returns default for a slice on a non-array', function (): void {
            $data = ['name' => 'Alice'];

            $result = ($this->r)($data, 'name[0:1]', 'fallback');

            expect($result)->toBe('fallback');
        });

        it('returns empty array for an out-of-range slice', function (): void {
            $data = ['items' => ['a', 'b']];

            $result = ($this->r)($data, 'items[99:100]');

            expect($result)->toBeEmpty();
        });
    });

    // resolve() - projection
    describe(SegmentPathResolver::class . ' > resolve projection', function (): void {
        it('projects specific fields from a map', function (): void {
            $data = ['user' => ['name' => 'Alice', 'age' => 30, 'password' => 'secret']];

            $result = ($this->r)($data, 'user.{name,age}');

            expect($result)->toBe(['name' => 'Alice', 'age' => 30]);
            expect($result)->not->toHaveKey('password');
        });

        it('projects fields with an alias', function (): void {
            $data = ['user' => ['name' => 'Alice']];

            $result = ($this->r)($data, 'user.{fullName: name}');

            expect($result)->toHaveKey('fullName');
            expect($result['fullName'])->toBe('Alice');
        });

        it('projects fields from a list of items', function (): void {
            $data = ['users' => [
                ['name' => 'Alice', 'age' => 30],
                ['name' => 'Bob', 'age' => 25],
            ]];

            $result = ($this->r)($data, 'users.{name}');

            expect($result)->toBe([['name' => 'Alice'], ['name' => 'Bob']]);
        });

        it('sets projected field to null when source key is missing', function (): void {
            $data = ['user' => ['name' => 'Alice']];

            $result = ($this->r)($data, 'user.{name,missing}');

            expect($result['missing'])->toBeNull();
        });

        it('returns default for a projection on a non-array', function (): void {
            $data = ['name' => 'Alice'];

            $result = ($this->r)($data, 'name.{foo}', 'fallback');

            expect($result)->toBe('fallback');
        });
    });

    // resolve() - coverage-gap scenarios
    describe(SegmentPathResolver::class . ' > resolve edge cases', function (): void {
        it('resolves further segments after a multi-key selection', function (): void {
            // Line 260: segmentMultiKey resolve branch ($nextIndex < $segmentCount)
            $data = ['users' => ['alice' => ['age' => 30], 'bob' => ['age' => 25]]];

            $segments = [
                ['type' => SegmentType::Key, 'value' => 'users'],
                ['type' => SegmentType::MultiKey, 'keys' => ['alice', 'bob']],
                ['type' => SegmentType::Key, 'value' => 'age'],
            ];
            $result = $this->resolver->resolve($data, $segments, 0, null, 100);

            expect($result)->toBe([30, 25]);
        });

        it('resolves further segments after a multi-index selection', function (): void {
            // Line 299: segmentMultiIndex resolve branch ($nextIndex < $segmentCount)
            $data = ['items' => [['name' => 'a'], ['name' => 'b'], ['name' => 'c'], ['name' => 'd']]];

            $segments = [
                ['type' => SegmentType::Key, 'value' => 'items'],
                ['type' => SegmentType::MultiIndex, 'indices' => [0, 2]],
                ['type' => SegmentType::Key, 'value' => 'name'],
            ];
            $result = $this->resolver->resolve($data, $segments, 0, null, 100);

            expect($result)->toBe(['a', 'c']);
        });

        it('adjusts a negative start index in a slice', function (): void {
            // Line 331: $start < 0 → $start = max($len + $start, 0)
            $segments = [
                ['type' => SegmentType::Key, 'value' => 'items'],
                ['type' => SegmentType::Slice, 'start' => -2, 'end' => null, 'step' => 1],
            ];
            $data = ['items' => ['a', 'b', 'c', 'd']];

            $result = $this->resolver->resolve($data, $segments, 0, null, 100);

            expect($result)->toBe(['c', 'd']);
        });

        it('adjusts a negative end index in a slice', function (): void {
            // Line 335: $end < 0 → $end = $len + $end
            $segments = [
                ['type' => SegmentType::Key, 'value' => 'items'],
                ['type' => SegmentType::Slice, 'start' => null, 'end' => -2, 'step' => 1],
            ];
            $data = ['items' => ['a', 'b', 'c', 'd']];

            $result = $this->resolver->resolve($data, $segments, 0, null, 100);

            expect($result)->toBe(['a', 'b']);
        });

        it('iterates in reverse order with a negative step', function (): void {
            // Lines 352-353: negative step loop
            $segments = [
                ['type' => SegmentType::Key, 'value' => 'items'],
                ['type' => SegmentType::Slice, 'start' => null, 'end' => null, 'step' => -1],
            ];
            $data = ['items' => ['a', 'b', 'c', 'd']];

            $result = $this->resolver->resolve($data, $segments, 0, null, 100);

            expect($result)->toBe(['d', 'c', 'b', 'a']);
        });

        it('applies further segments to each sliced item', function (): void {
            // Lines 362-365: slice followed by more segments
            $data = ['items' => [['name' => 'a'], ['name' => 'b'], ['name' => 'c'], ['name' => 'd']]];

            $result = ($this->r)($data, 'items[1:3].name');

            expect($result)->toBe(['b', 'c']);
        });

        it('projects null fields for non-array items in a list', function (): void {
            // Lines 386-390: $projectItem closure - item is not an array
            $data = ['items' => ['scalar1', 'scalar2']];

            $result = ($this->r)($data, 'items.{name}');

            expect($result[0]['name'])->toBeNull();
            expect($result[1]['name'])->toBeNull();
        });

        it('applies further segments after projecting a list of items', function (): void {
            // Lines 410-413: projection on list + $nextProjectionIndex < $segmentCount
            $segments = [
                ['type' => SegmentType::Key, 'value' => 'users'],
                ['type' => SegmentType::Projection, 'fields' => [['alias' => 'name', 'source' => 'name']]],
                ['type' => SegmentType::Key, 'value' => 'extra'],
            ];
            $data = ['users' => [['name' => 'Alice', 'extra' => 'x'], ['name' => 'Bob', 'extra' => 'y']]];

            $result = $this->resolver->resolve($data, $segments, 0, null, 100);

            expect($result)->toBe([null, null]);
        });

        it('applies further segments after projecting a single map', function (): void {
            // Line 422: projection on non-list array + $nextProjectionIndex < $segmentCount
            $segments = [
                ['type' => SegmentType::Key, 'value' => 'user'],
                ['type' => SegmentType::Projection, 'fields' => [['alias' => 'name', 'source' => 'name']]],
                ['type' => SegmentType::Key, 'value' => 'missing'],
            ];
            $data = ['user' => ['name' => 'Alice', 'age' => 30]];

            $result = $this->resolver->resolve($data, $segments, 0, 'fallback', 100);

            expect($result)->toBe('fallback');
        });

        it('returns empty results from a descent on a non-array resolved value', function (): void {
            // Line 442: collectDescent called with non-array $current → return early
            $data = ['name' => 'Alice'];

            $result = ($this->r)($data, 'name..key');

            expect($result)->toBe([]);
        });

        it('resolves further segments after descent finds a matching key (scalar result)', function (): void {
            // Lines 449-453: $nextIndex < count($segments), resolved is scalar → $results[] = $resolved
            $data = ['config' => ['settings' => ['debug' => true]]];

            $result = ($this->r)($data, '..settings.debug');

            expect($result)->toBe([true]);
        });

        it('spreads list results from descent followed by a wildcard segment', function (): void {
            // Lines 449-451: $nextIndex < count($segments), resolved is list → array_push
            $data = ['a' => ['targets' => [1, 2, 3]]];

            $result = ($this->r)($data, '..targets[*]');

            expect($result)->toBe([1, 2, 3]);
        });
    });
});
