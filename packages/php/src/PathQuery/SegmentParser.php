<?php

declare(strict_types=1);

namespace SafeAccess\Inline\PathQuery;

use SafeAccess\Inline\Contracts\FilterEvaluatorInterface;
use SafeAccess\Inline\Exceptions\InvalidFormatException;
use SafeAccess\Inline\PathQuery\Enums\SegmentType;

/**
 * Parse dot-notation path strings into typed segment arrays.
 *
 * Converts path expressions (e.g. "users[0].address..city") into ordered
 * segment arrays with {@see SegmentType} metadata for resolution by
 * {@see SegmentPathResolver}. Supports key, index, wildcard, descent,
 * multi-key/index, filter, slice, and projection segment types.
 *
 * @internal
 *
 * @phpstan-type Segment array{type: SegmentType, value?: string, key?: string, keys?: list<string>, indices?: list<int>, start?: int|null, end?: int|null, step?: int|null, expression?: array<string, mixed>, fields?: list<array{alias: string, source: string}>}
 *
 * @see SegmentType          Enum of all segment types produced.
 * @see SegmentPathResolver  Consumer that resolves segments against data.
 * @see FilterEvaluatorInterface  Delegate for filter expression parsing.
 */
final class SegmentParser
{
    /**
     * Create a segment parser with a filter evaluator.
     *
     * @param FilterEvaluatorInterface $segmentFilterParser Delegate for [?filter] parsing.
     */
    public function __construct(
        private readonly FilterEvaluatorInterface $segmentFilterParser
    ) {
    }

    /**
     * Parse a dot-notation path into an ordered array of typed segments.
     *
     * @param string $path Dot-notation path expression.
     *
     * @return list<Segment> Typed segment array.
     *
     * @throws \SafeAccess\Inline\Exceptions\InvalidFormatException When slice step is zero.
     */
    public function parseSegments(string $path): array
    {
        $segments = [];
        $i = 0;
        $len = strlen($path);

        if ($len > 0 && $path[0] === '$') {
            $i = 1;
            if ($i < $len && $path[$i] === '.') {
                $i++;
            }
        }

        while ($i < $len) {
            if ($path[$i] === '.') {
                if ($i + 1 < $len && $path[$i + 1] === '.') {
                    $i += 2;
                    $segments[] = $this->parseDescent($path, $i, $len);
                    continue;
                }
                $i++;
                $segment = $this->parseProjection($path, $i, $len);
                if ($segment !== null) {
                    $segments[] = $segment;
                }
                continue;
            }

            if ($path[$i] === '[' && $i + 1 < $len && $path[$i + 1] === '?') {
                $segments[] = $this->parseFilter($path, $i, $len);
                continue;
            }

            if ($path[$i] === '[') {
                $segments[] = $this->parseBracket($path, $i, $len);
                continue;
            }

            if ($path[$i] === '*') {
                $segments[] = ['type' => SegmentType::Wildcard];
                $i++;
                continue;
            }

            $segments[] = $this->parseKey($path, $i, $len);
        }

        return $segments;
    }

    /**
     * Parse a recursive descent segment (`..key` or `..[...]`).
     *
     * @param string $path Full path string.
     * @param int    &$i   Current position (updated in place).
     * @param int    $len  Total path length.
     *
     * @phpstan-return Segment
     *
     * @return array<string, mixed> Parsed descent segment.
     */
    private function parseDescent(string $path, int &$i, int $len): array
    {
        if ($i < $len && $path[$i] === '[') {
            $j = $i + 1;
            while ($j < $len && $path[$j] !== ']') {
                $j++;
            }

            $inner = substr($path, $i + 1, $j - $i - 1);
            $i = $j + 1;

            if (str_contains($inner, ',') && $this->allQuoted(explode(',', $inner))) {
                $parts = array_map('trim', explode(',', $inner));
                $keys = array_map(fn (string $p): string => substr($p, 1, -1), $parts);
                return ['type' => SegmentType::DescentMulti, 'keys' => $keys];
            }

            if (preg_match('/^([\'"])(.*?)\\1$/', $inner, $m)) {
                return ['type' => SegmentType::Descent, 'key' => $m[2]];
            }

            return ['type' => SegmentType::Descent, 'key' => $inner];
        }

        $key = '';
        while ($i < $len && $path[$i] !== '.' && $path[$i] !== '[') {
            if ($path[$i] === '\\' && $i + 1 < $len && $path[$i + 1] === '.') {
                $key .= '.';
                $i += 2;
            } else {
                $key .= $path[$i];
                $i++;
            }
        }

        return ['type' => SegmentType::Descent, 'key' => $key];
    }

    /**
     * Parse a projection segment (`.{field1, field2}` or `.{alias: field}`).
     *
     * @param string $path Full path string.
     * @param int    &$i   Current position (updated in place).
     * @param int    $len  Total path length.
     *
     * @phpstan-return Segment|null
     *
     * @return array<string, mixed>|null Parsed projection segment, or null if not a projection.
     */
    private function parseProjection(string $path, int &$i, int $len): ?array
    {
        if ($i >= $len || $path[$i] !== '{') {
            return null;
        }

        $j = $i + 1;
        while ($j < $len && $path[$j] !== '}') {
            $j++;
        }
        $inner = substr($path, $i + 1, $j - $i - 1);
        $i = $j + 1;

        $fields = [];
        foreach (array_filter(array_map('trim', explode(',', $inner))) as $entry) {
            $colonIdx = strpos($entry, ':');
            if ($colonIdx !== false) {
                $fields[] = [
                    'alias' => trim(substr($entry, 0, $colonIdx)),
                    'source' => trim(substr($entry, $colonIdx + 1)),
                ];
            } else {
                $fields[] = ['alias' => $entry, 'source' => $entry];
            }
        }

        return ['type' => SegmentType::Projection, 'fields' => $fields];
    }

    /**
     * Parse a filter segment (`[?expression]`).
     *
     * @param string $path Full path string.
     * @param int    &$i   Current position (updated in place).
     * @param int    $len  Total path length.
     *
     * @phpstan-return Segment
     *
     * @return array<string, mixed> Parsed filter segment.
     */
    private function parseFilter(string $path, int &$i, int $len): array
    {
        $depth = 1;
        $j = $i + 1;
        while ($j < $len && $depth > 0) {
            $j++;
            if ($j < $len && $path[$j] === '[') {
                $depth++;
            }
            if ($j < $len && $path[$j] === ']') {
                $depth--;
            }
        }
        $filterExpr = substr($path, $i + 2, $j - $i - 2);
        $i = $j + 1;

        return ['type' => SegmentType::Filter, 'expression' => $this->segmentFilterParser->parse($filterExpr)];
    }

    /**
     * Parse a bracket segment (`[0]`, `[0,1,2]`, `[0:5]`, `['key']`, `[*]`).
     *
     * @param string $path Full path string.
     * @param int    &$i   Current position (updated in place).
     * @param int    $len  Total path length.
     *
     * @phpstan-return Segment
     *
     * @return array<string, mixed> Parsed bracket segment.
     *
     * @throws \SafeAccess\Inline\Exceptions\InvalidFormatException When slice step is zero.
     */
    private function parseBracket(string $path, int &$i, int $len): array
    {
        $j = $i + 1;
        while ($j < $len && $path[$j] !== ']') {
            $j++;
        }
        $inner = substr($path, $i + 1, $j - $i - 1);
        $i = $j + 1;

        if (str_contains($inner, ',')) {
            $parts = array_map('trim', explode(',', $inner));

            if ($this->allQuoted($parts)) {
                $keys = array_map(fn ($p) => substr($p, 1, -1), $parts);
                return ['type' => SegmentType::MultiKey, 'keys' => $keys];
            }

            $allNumeric = true;
            foreach ($parts as $p) {
                if (!is_numeric(trim($p))) {
                    $allNumeric = false;
                    break;
                }
            }
            if ($allNumeric) {
                return ['type' => SegmentType::MultiIndex, 'indices' => array_map('intval', $parts)];
            }
        }

        if (preg_match('/^([\'"])(.*?)\1$/', $inner, $quotedMatch)) {
            return ['type' => SegmentType::Key, 'value' => $quotedMatch[2]];
        }

        if (str_contains($inner, ':')) {
            $sliceParts = explode(':', $inner);
            $start = $sliceParts[0] !== '' ? (int) $sliceParts[0] : null;
            $end = count($sliceParts) > 1 && $sliceParts[1] !== '' ? (int) $sliceParts[1] : null;
            $rawStep = count($sliceParts) > 2 && $sliceParts[2] !== '' ? (int) $sliceParts[2] : null;
            if ($rawStep === 0) {
                throw new InvalidFormatException('Slice step cannot be zero.');
            }
            return ['type' => SegmentType::Slice, 'start' => $start, 'end' => $end, 'step' => $rawStep];
        }

        if ($inner === '*') {
            return ['type' => SegmentType::Wildcard];
        }

        return ['type' => SegmentType::Key, 'value' => $inner];
    }

    /**
     * Parse a regular dot-separated key with escaped-dot support.
     *
     * @param string $path Full path string.
     * @param int    &$i   Current position (updated in place).
     * @param int    $len  Total path length.
     *
     * @phpstan-return Segment
     *
     * @return array<string, mixed> Parsed key segment.
     */
    private function parseKey(string $path, int &$i, int $len): array
    {
        $key = '';
        while ($i < $len && $path[$i] !== '.' && $path[$i] !== '[') {
            if ($path[$i] === '\\' && $i + 1 < $len && $path[$i + 1] === '.') {
                $key .= '.';
                $i += 2;
            } else {
                $key .= $path[$i];
                $i++;
            }
        }

        return ['type' => SegmentType::Key, 'value' => $key];
    }

    /**
     * Check if all parts in a comma-separated list are quoted strings.
     *
     * @param array<string> $parts Raw parts from explode.
     *
     * @return bool True if every part is single- or double-quoted.
     */
    private function allQuoted(array $parts): bool
    {
        foreach ($parts as $p) {
            $p = trim($p);
            if (
                !(str_starts_with($p, "'") && str_ends_with($p, "'"))
                && !(str_starts_with($p, '"') && str_ends_with($p, '"'))
            ) {
                return false;
            }
        }

        return true;
    }

    /**
     * Parse a simple dot-notation path into plain string keys.
     *
     * Handles bracket notation and escaped dots. Does not produce typed
     * segments — used for set/remove operations via {@see DotNotationParser}.
     *
     * @param string $path Simple dot-notation path.
     *
     * @return array<int, string> Ordered list of key strings.
     */
    public function parseKeys(string $path): array
    {
        // 1. Convert brackets to dot notation: "a[0][1]" → "a.0.1"
        $path = preg_replace('/\[([^\]]+)\]/', '.$1', $path) ?? $path;

        // 2. Split by "." respecting escaped "\."
        $placeholder = "\x00ESC_DOT\x00";
        $path = str_replace('\.', $placeholder, $path);
        $keys = explode('.', $path);

        // 3. Restore escaped dots
        return array_map(
            fn (string $k) => str_replace($placeholder, '.', $k),
            $keys
        );
    }
}
