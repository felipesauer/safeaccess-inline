<?php

declare(strict_types=1);

namespace SafeAccess\Inline\PathQuery;

use SafeAccess\Inline\Contracts\FilterEvaluatorInterface;
use SafeAccess\Inline\Exceptions\SecurityException;
use SafeAccess\Inline\PathQuery\Enums\SegmentType;

/**
 * Resolve typed path segments against nested data structures.
 *
 * Traverses data using segment arrays produced by {@see SegmentParser},
 * dispatching to segment-type-specific handlers for key, wildcard,
 * descent, filter, slice, multi-key/index, and projection operations.
 *
 * @internal
 *
 * @see SegmentParser           Produces the segment arrays this resolver consumes.
 * @see SegmentType             Enum governing which handler is dispatched.
 * @see FilterEvaluatorInterface  Delegate for filter predicate evaluation.
 * @see DotNotationParser       Invokes this resolver for path queries.
 */
final class SegmentPathResolver
{
    /**
     * Create a resolver with a filter evaluator.
     *
     * @param FilterEvaluatorInterface $segmentFilterParser Delegate for filter evaluation.
     */
    public function __construct(
        private readonly FilterEvaluatorInterface $segmentFilterParser
    ) {
    }

    /**
     * Resolve a value by walking segments starting at the given index.
     *
     * @param mixed                            $current  Current data node.
     * @param array<int, array<string, mixed>> $segments Typed segment array from {@see SegmentParser}.
     * @param int                              $index    Current segment index.
     * @param mixed                            $default  Fallback value when resolution fails.
     * @param int                              $maxDepth Maximum recursion depth.
     *
     * @return mixed Resolved value or the default.
     *
     * @throws \SafeAccess\Inline\Exceptions\SecurityException When recursion depth exceeds the limit.
     */
    public function resolve(mixed $current, array $segments, int $index, mixed $default, int $maxDepth): mixed
    {
        if ($index > $maxDepth) {
            throw new SecurityException("Recursion depth {$index} exceeds maximum of {$maxDepth}.");
        }

        if ($index >= count($segments)) {
            return $current;
        }

        $type = $segments[$index]['type'];

        return match (true) {
            $type === SegmentType::Descent => $this->segmentDescent($current, $segments, $index, $default, $maxDepth),
            $type === SegmentType::DescentMulti => $this->segmentDescentMulti($current, $segments, $index, $default, $maxDepth),
            $type === SegmentType::Wildcard => $this->segmentWildcard($current, $segments, $index, $default, $maxDepth),
            $type === SegmentType::Filter => $this->segmentFilter($current, $segments, $index, $default, $maxDepth),
            $type === SegmentType::MultiKey => $this->segmentMultiKey($current, $segments, $index, $default, $maxDepth),
            $type === SegmentType::MultiIndex => $this->segmentMultiIndex($current, $segments, $index, $default, $maxDepth),
            $type === SegmentType::Slice => $this->segmentSlice($current, $segments, $index, $default, $maxDepth),
            $type === SegmentType::Projection => $this->segmentProjection($current, $segments, $index, $default, $maxDepth),
            default => $this->segmentAny($current, $segments, $index, $default, $maxDepth),
        };
    }

    /**
     * Resolve a simple key/index segment.
     *
     * @param mixed                            $current  Current data node.
     * @param array<int, array<string, mixed>> $segments Typed segment array.
     * @param int                              $index    Current segment index.
     * @param mixed                            $default  Fallback value.
     * @param int                              $maxDepth Maximum recursion depth.
     *
     * @return mixed Resolved value or the default.
     */
    private function segmentAny(mixed $current, array $segments, int $index, mixed $default, int $maxDepth): mixed
    {
        $segment = $segments[$index];
        /** @var string $keyValue */
        $keyValue = $segment['value'] ?? '';
        if (is_array($current) && array_key_exists($keyValue, $current)) {
            return $this->resolve($current[$keyValue], $segments, $index + 1, $default, $maxDepth);
        }

        return $default;
    }

    /**
     * Resolve a recursive descent segment for a single key.
     *
     * @param mixed                            $current  Current data node.
     * @param array<int, array<string, mixed>> $segments Typed segment array.
     * @param int                              $index    Current segment index.
     * @param mixed                            $default  Fallback value.
     * @param int                              $maxDepth Maximum recursion depth.
     *
     * @return array<mixed> All values found by recursive descent.
     */
    private function segmentDescent(mixed $current, array $segments, int $index, mixed $default, int $maxDepth): array
    {
        $results = [];
        $segment = $segments[$index];
        /** @var string $descentKey */
        $descentKey = $segment['key'] ?? '';
        $this->collectDescent($current, $descentKey, $segments, $index + 1, $default, $results, $maxDepth);

        return $results;
    }

    /**
     * Resolve a recursive descent segment for multiple keys.
     *
     * @param mixed                            $current  Current data node.
     * @param array<int, array<string, mixed>> $segments Typed segment array.
     * @param int                              $index    Current segment index.
     * @param mixed                            $default  Fallback value.
     * @param int                              $maxDepth Maximum recursion depth.
     *
     * @return mixed Collected results or the default.
     */
    private function segmentDescentMulti(mixed $current, array $segments, int $index, mixed $default, int $maxDepth): mixed
    {
        $segment = $segments[$index];
        /** @var list<string> $descentKeys */
        $descentKeys = $segment['keys'] ?? [];
        $results = [];

        foreach ($descentKeys as $dk) {
            $this->collectDescent(
                $current,
                $dk,
                $segments,
                $index + 1,
                $default,
                $results,
                $maxDepth
            );
        }

        return count($results) > 0 ? $results : $default;
    }

    /**
     * Resolve a wildcard segment, expanding all children.
     *
     * @param mixed                            $current  Current data node.
     * @param array<int, array<string, mixed>> $segments Typed segment array.
     * @param int                              $index    Current segment index.
     * @param mixed                            $default  Fallback value.
     * @param int                              $maxDepth Maximum recursion depth.
     *
     * @return mixed Array of child values or the default.
     */
    private function segmentWildcard(mixed $current, array $segments, int $index, mixed $default, int $maxDepth): mixed
    {
        if (!is_array($current)) {
            return $default;
        }

        $items = array_values($current);
        $nextIndex = $index + 1;

        if ($nextIndex >= count($segments)) {
            return $items;
        }

        return array_map(
            fn ($item) => $this->resolve(
                $item,
                $segments,
                $nextIndex,
                $default,
                $maxDepth
            ),
            $items
        );
    }

    /**
     * Resolve a filter segment, applying predicates to array items.
     *
     * @param mixed                            $current  Current data node.
     * @param array<int, array<string, mixed>> $segments Typed segment array.
     * @param int                              $index    Current segment index.
     * @param mixed                            $default  Fallback value.
     * @param int                              $maxDepth Maximum recursion depth.
     *
     * @return mixed Filtered results or the default.
     */
    private function segmentFilter(mixed $current, array $segments, int $index, mixed $default, int $maxDepth): mixed
    {
        if (!is_array($current)) {
            return $default;
        }

        $segment = $segments[$index];
        /** @var array{conditions: list<array<string, mixed>>, logicals: list<string>} $filterExpr */
        $filterExpr = $segment['expression'] ?? [];
        $filteredRaw = [];
        foreach ($current as $item) {
            if (is_array($item)) {
                /** @var array<string, mixed> $item */
                if ($this->segmentFilterParser->evaluate($item, $filterExpr)) {
                    $filteredRaw[] = $item;
                }
            }
        }
        $filtered = $filteredRaw;

        $nextIndex = $index + 1;
        if ($nextIndex >= count($segments)) {
            return $filtered;
        }

        return array_map(
            fn ($item) => $this->resolve($item, $segments, $nextIndex, $default, $maxDepth),
            $filtered
        );
    }

    /**
     * Resolve a multi-key segment, selecting values by multiple keys.
     *
     * @param mixed                            $current  Current data node.
     * @param array<int, array<string, mixed>> $segments Typed segment array.
     * @param int                              $index    Current segment index.
     * @param mixed                            $default  Fallback value.
     * @param int                              $maxDepth Maximum recursion depth.
     *
     * @return mixed Array of selected values or the default.
     */
    private function segmentMultiKey(mixed $current, array $segments, int $index, mixed $default, int $maxDepth): mixed
    {
        if (!is_array($current)) {
            return $default;
        }

        $nextIndex = $index + 1;
        $segmentCount = count($segments);
        $segment = $segments[$index];
        /** @var list<string> $multiKeys */
        $multiKeys = $segment['keys'] ?? [];

        return array_map(function ($k) use ($current, $segments, $nextIndex, $segmentCount, $default, $maxDepth) {
            $val = array_key_exists($k, $current) ? $current[$k] : $default;
            if ($nextIndex >= $segmentCount) {
                return $val;
            }

            return $this->resolve($val, $segments, $nextIndex, $default, $maxDepth);
        }, $multiKeys);
    }

    /**
     * Resolve a multi-index segment, selecting values by multiple indices.
     *
     * @param mixed                            $current  Current data node.
     * @param array<int, array<string, mixed>> $segments Typed segment array.
     * @param int                              $index    Current segment index.
     * @param mixed                            $default  Fallback value.
     * @param int                              $maxDepth Maximum recursion depth.
     *
     * @return mixed Array of selected values or the default.
     */
    private function segmentMultiIndex(mixed $current, array $segments, int $index, mixed $default, int $maxDepth): mixed
    {
        if (!is_array($current)) {
            return $default;
        }

        $nextIndex = $index + 1;
        $segmentCount = count($segments);
        $segment = $segments[$index];
        /** @var list<int> $indices */
        $indices = $segment['indices'] ?? [];
        $items = array_values($current);
        $len = count($items);

        return array_map(function ($idx) use ($items, $len, $segments, $nextIndex, $segmentCount, $default, $maxDepth) {
            $resolved = $idx < 0 ? ($items[$len + $idx] ?? null) : ($items[$idx] ?? null);
            if ($resolved === null) {
                return $default;
            }

            if ($nextIndex >= $segmentCount) {
                return $resolved;
            }

            return $this->resolve($resolved, $segments, $nextIndex, $default, $maxDepth);
        }, $indices);
    }

    /**
     * Resolve a slice segment on an array (start:end:step).
     *
     * @param mixed                            $current  Current data node.
     * @param array<int, array<string, mixed>> $segments Typed segment array.
     * @param int                              $index    Current segment index.
     * @param mixed                            $default  Fallback value.
     * @param int                              $maxDepth Maximum recursion depth.
     *
     * @return mixed Sliced array or the default.
     */
    private function segmentSlice(mixed $current, array $segments, int $index, mixed $default, int $maxDepth): mixed
    {
        if (!is_array($current)) {
            return $default;
        }

        $items = array_values($current);
        $len = count($items);
        $segment = $segments[$index];
        /** @var int $step */
        $step = $segment['step'] ?? 1;
        /** @var int $start */
        $start = $segment['start'] ?? ($step > 0 ? 0 : $len - 1);
        /** @var int $end */
        $end = $segment['end'] ?? ($step > 0 ? $len : -$len - 1);

        if ($start < 0) {
            $start = max($len + $start, 0);
        }

        if ($end < 0) {
            $end = $len + $end;
        }

        if ($start >= $len) {
            $start = $len;
        }

        if ($end > $len) {
            $end = $len;
        }

        $sliced = [];
        if ($step > 0) {
            for ($si = $start; $si < $end; $si += $step) {
                $sliced[] = $items[$si];
            }
        } else {
            for ($si = $start; $si > $end; $si += $step) {
                $sliced[] = $items[$si];
            }
        }

        $nextSliceIndex = $index + 1;
        if ($nextSliceIndex >= count($segments)) {
            return $sliced;
        }

        return array_map(
            fn ($item) => $this->resolve($item, $segments, $nextSliceIndex, $default, $maxDepth),
            $sliced
        );
    }

    /**
     * Resolve a projection segment, selecting specific fields from items.
     *
     * @param mixed                            $current  Current data node.
     * @param array<int, array<string, mixed>> $segments Typed segment array.
     * @param int                              $index    Current segment index.
     * @param mixed                            $default  Fallback value.
     * @param int                              $maxDepth Maximum recursion depth.
     *
     * @return mixed Projected data or the default.
     */
    private function segmentProjection(mixed $current, array $segments, int $index, mixed $default, int $maxDepth): mixed
    {
        $segment = $segments[$index];
        /** @var list<array{alias: string, source: string}> $fields */
        $fields = $segment['fields'] ?? [];
        $projectItem = static function (mixed $item) use ($fields): array {
            if (!is_array($item)) {
                $result = [];
                foreach ($fields as $field) {
                    $result[$field['alias']] = null;
                }
                return $result;
            }

            $result = [];
            foreach ($fields as $field) {
                $result[$field['alias']] = array_key_exists($field['source'], $item) ? $item[$field['source']] : null;
            }

            return $result;
        };

        $nextProjectionIndex = $index + 1;
        $segmentCount = count($segments);

        if (is_array($current) && array_is_list($current)) {
            $projected = array_map($projectItem, $current);
            if ($nextProjectionIndex >= $segmentCount) {
                return $projected;
            }

            return array_map(
                fn ($item) => $this->resolve($item, $segments, $nextProjectionIndex, $default, $maxDepth),
                $projected
            );
        }

        if (is_array($current)) {
            $result = $projectItem($current);
            if ($nextProjectionIndex >= $segmentCount) {
                return $result;
            }

            return $this->resolve($result, $segments, $nextProjectionIndex, $default, $maxDepth);
        }

        return $default;
    }

    /**
     * Recursively collect values matching a descent key from nested data.
     *
     * @param mixed                            $current   Current data node.
     * @param string                           $key       Key to search for recursively.
     * @param array<int, array<string, mixed>> $segments  Typed segment array.
     * @param int                              $nextIndex Next segment index after the descent.
     * @param mixed                            $default   Fallback value.
     * @param array<mixed>                     $results   Collector array (passed by reference).
     * @param int                              $maxDepth  Maximum recursion depth.
     */
    private function collectDescent(mixed $current, string $key, array $segments, int $nextIndex, mixed $default, array &$results, int $maxDepth): void
    {
        if (!is_array($current)) {
            return;
        }

        if (array_key_exists($key, $current)) {
            if ($nextIndex >= count($segments)) {
                $results[] = $current[$key];
            } else {
                $resolved = $this->resolve($current[$key], $segments, $nextIndex, $default, $maxDepth);
                if (is_array($resolved) && array_is_list($resolved)) {
                    array_push($results, ...$resolved);
                } else {
                    $results[] = $resolved;
                }
            }
        }

        foreach (array_values($current) as $child) {
            if (is_array($child)) {
                $this->collectDescent($child, $key, $segments, $nextIndex, $default, $results, $maxDepth);
            }
        }
    }
}
