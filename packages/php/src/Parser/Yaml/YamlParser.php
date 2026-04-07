<?php

declare(strict_types=1);

namespace SafeAccess\Inline\Parser\Yaml;

use SafeAccess\Inline\Exceptions\YamlParseException;

/**
 * Minimal YAML parser supporting a safe subset of YAML 1.2.
 *
 * Parses scalars, maps, sequences, block scalars (literal/folded),
 * and flow syntax (inline arrays/maps). Blocks unsafe constructs:
 * tags (!!), anchors (&), aliases (*), and merge keys (<<).
 *
 * Does not depend on ext-yaml, making the library portable across
 * environments without optional extensions.
 *
 * @internal
 *
 * @see YamlAccessor       Accessor consuming this parser.
 * @see YamlParseException Thrown on parse errors.
 */
final class YamlParser
{
    /**
     * Parse a YAML string into a PHP array.
     *
     * @param string $yaml Raw YAML content.
     *
     * @return array<mixed> Parsed data structure.
     *
     * @throws \SafeAccess\Inline\Exceptions\YamlParseException When unsafe constructs or syntax errors are found.
     */
    public function parse(string $yaml): array
    {
        $lines = explode("\n", str_replace("\r\n", "\n", $yaml));
        $this->assertNoUnsafeConstructs($lines);
        $result = $this->parseLines($lines, 0, 0, count($lines));

        return is_array($result) ? $result : [];
    }

    /**
     * Scan lines for unsafe YAML constructs before parsing.
     *
     * @param array<int, string> $lines Lines to validate.
     *
     * @throws \SafeAccess\Inline\Exceptions\YamlParseException When tags, anchors, aliases, or merge keys are detected.
     */
    private function assertNoUnsafeConstructs(array $lines): void
    {
        foreach ($lines as $lineNum => $line) {
            $trimmed = ltrim($line);

            if ($trimmed === '' || $trimmed[0] === '#') {
                continue;
            }

            // Block both !! (type) tags and ! (custom) tags.
            // The negative lookbehind (?<!['"!]) prevents false positives on
            // quoted strings (e.g. value: '!important') and on the second `!`
            // in a `!!` sequence (which would otherwise double-match).
            if (preg_match('/(?<![\'\"!])!{1,2}[\w<\/]/', $trimmed)) {
                throw new YamlParseException(
                    "Unsupported YAML tag at line " . ($lineNum + 1) . ": tags (! and !! syntax) are not supported."
                );
            }

            if (preg_match('/(?:^|\s)&\w+/', $trimmed)) {
                throw new YamlParseException(
                    "YAML anchors are not supported (line " . ($lineNum + 1) . ")."
                );
            }

            if (preg_match('/(?:^|\s)\*\w+/', $trimmed)) {
                throw new YamlParseException(
                    "YAML aliases are not supported (line " . ($lineNum + 1) . ")."
                );
            }

            if (preg_match('/^(\s*)<<\s*:/', $line)) {
                throw new YamlParseException(
                    "YAML merge keys (<<) are not supported (line " . ($lineNum + 1) . ")."
                );
            }
        }
    }

    /**
     * Recursively parse indentation-based YAML lines into a PHP value.
     *
     * @param array<int, string> $lines      All document lines.
     * @param int                $baseIndent Expected indentation level.
     * @param int                $start      Start line index (inclusive).
     * @param int                $end        End line index (exclusive).
     *
     * @return mixed Parsed value (array, scalar, or null).
     */
    private function parseLines(array $lines, int $baseIndent, int $start, int $end): mixed
    {
        $result = [];
        $isSequence = false;
        $isMap = false;
        $i = $start;

        while ($i < $end) {
            $line = $lines[$i];
            $trimmed = ltrim($line);

            if ($trimmed === '' || $trimmed[0] === '#') {
                $i++;
                continue;
            }

            $currentIndent = strlen($line) - strlen($trimmed);

            if ($currentIndent < $baseIndent) {
                // Defensive guard: findBlockEnd ensures this range excludes
                // lines below baseIndent, but this prevents runaway parsing
                // if that invariant is ever violated.
                break; // @codeCoverageIgnore
            }

            if ($currentIndent > $baseIndent) {
                $i++;
                continue;
            }

            // Sequence item
            if (str_starts_with($trimmed, '- ') || $trimmed === '-') {
                $isSequence = true;
                $itemContent = $trimmed === '-' ? '' : substr($trimmed, 2);
                $itemContent = trim($itemContent);

                // Check if the sequence item contains a map key
                if ($itemContent !== '' && preg_match('/^([^\s:][^:]*?)\s*:\s*(.*)$/', $itemContent, $m)) {
                    // Sequence item is an inline map
                    $childIndent = $currentIndent + 2;
                    $childEnd = $this->findBlockEnd($lines, $childIndent, $i + 1, $end);
                    $subMap = [];
                    $subMap[$m[1]] = $this->resolveValue($m[2], $lines, $i, $childIndent, $childEnd);

                    // Parse remaining child lines as part of this map
                    $ci = $i + 1;
                    while ($ci < $childEnd) {
                        $childLine = $lines[$ci];
                        $childTrimmed = ltrim($childLine);
                        if ($childTrimmed === '' || $childTrimmed[0] === '#') {
                            $ci++;
                            continue;
                        }
                        $childCurrentIndent = strlen($childLine) - strlen($childTrimmed);
                        if ($childCurrentIndent < $childIndent) {
                            // Defensive guard: childEnd from findBlockEnd should
                            // already exclude these lines, but guards against
                            // any future change breaking that invariant.
                            break; // @codeCoverageIgnore
                        }
                        if ($childCurrentIndent === $childIndent && preg_match('/^([^\s:][^:]*?)\s*:\s*(.*)$/', $childTrimmed, $cm)) {
                            $nextChildEnd = $this->findBlockEnd($lines, $childCurrentIndent + 2, $ci + 1, $childEnd);
                            $subMap[$cm[1]] = $this->resolveValue($cm[2], $lines, $ci, $childCurrentIndent + 2, $nextChildEnd);
                            $ci = $nextChildEnd;
                        } else {
                            $ci++;
                        }
                    }
                    $result[] = $subMap;
                    $i = $childEnd;
                } elseif ($itemContent === '') {
                    // Nested content under `-`
                    $childIndent = $currentIndent + 2;
                    $childEnd = $this->findBlockEnd($lines, $childIndent, $i + 1, $end);
                    if ($childEnd > $i + 1) {
                        $result[] = $this->parseLines($lines, $childIndent, $i + 1, $childEnd);
                        $i = $childEnd;
                    } else {
                        $result[] = null;
                        $i++;
                    }
                } else {
                    $result[] = $this->castScalar($itemContent);
                    $i++;
                }
                continue;
            }

            // Map key: value
            if (preg_match('/^([^\s:][^:]*?)\s*:\s*(.*)$/', $trimmed, $match)) {
                $isMap = true;
                $key = $match[1];
                $rawValue = $match[2];

                $childIndent = $currentIndent + 2;
                $childEnd = $this->findBlockEnd($lines, $childIndent, $i + 1, $end);

                $result[$key] = $this->resolveValue($rawValue, $lines, $i, $childIndent, $childEnd);
                $i = $childEnd;
                continue;
            }

            $i++;
        }

        if (!$isSequence && !$isMap && $result === []) {
            // Attempt to parse as a single scalar document
            $content = trim(implode("\n", array_slice($lines, $start, $end - $start)));
            if ($content !== '') {
                return $this->castScalar($content);
            }
        }

        return $result;
    }

    /**
     * Resolve a raw value string, handling block scalars, flow syntax, and child blocks.
     *
     * @param string             $rawValue    Raw value after the colon.
     * @param array<int, string> $lines       All document lines.
     * @param int                $currentLine Current line index.
     * @param int                $childIndent Expected child indentation.
     * @param int                $childEnd    End boundary for child lines.
     *
     * @return mixed Resolved PHP value.
     */
    private function resolveValue(string $rawValue, array $lines, int $currentLine, int $childIndent, int $childEnd): mixed
    {
        $rawValue = $this->stripInlineComment($rawValue);

        // Block scalars
        if ($rawValue === '|' || $rawValue === '|-' || $rawValue === '|+') {
            return $this->parseBlockScalar($lines, $currentLine + 1, $childIndent, $childEnd, 'literal', $rawValue);
        }
        if ($rawValue === '>' || $rawValue === '>-' || $rawValue === '>+') {
            return $this->parseBlockScalar($lines, $currentLine + 1, $childIndent, $childEnd, 'folded', $rawValue);
        }

        // If rawValue is empty, parse child block
        if ($rawValue === '') {
            if ($childEnd > $currentLine + 1) {
                return $this->parseLines($lines, $childIndent, $currentLine + 1, $childEnd);
            }
            return null;
        }

        // Inline flow sequence [a, b, c]
        if (str_starts_with($rawValue, '[') && str_ends_with($rawValue, ']')) {
            return $this->parseFlowSequence($rawValue);
        }

        // Inline flow map {a: b, c: d}
        if (str_starts_with($rawValue, '{') && str_ends_with($rawValue, '}')) {
            return $this->parseFlowMap($rawValue);
        }

        return $this->castScalar($rawValue);
    }

    /**
     * Parse a block scalar (literal | or folded >) with chomping modifiers.
     *
     * @param array<int, string> $lines    All document lines.
     * @param int                $start    Start line index for block content.
     * @param int                $indent   Expected minimum indentation.
     * @param int                $end      End boundary.
     * @param string             $style    Either 'literal' or 'folded'.
     * @param string             $chomping Chomping indicator (|, |-, |+, >, >-, >+).
     *
     * @return string Assembled block scalar string.
     */
    private function parseBlockScalar(array $lines, int $start, int $indent, int $end, string $style, string $chomping): string
    {
        $blockLines = [];
        $actualIndent = null;

        for ($i = $start; $i < $end; $i++) {
            $line = $lines[$i];

            if (trim($line) === '') {
                $blockLines[] = '';
                continue;
            }

            $lineIndent = strlen($line) - strlen(ltrim($line));
            if ($actualIndent === null) {
                $actualIndent = $lineIndent;
            }

            if ($lineIndent < $actualIndent) {
                break;
            }

            $blockLines[] = substr($line, $actualIndent);
        }

        // Remove trailing empty lines for strip mode
        if (str_ends_with($chomping, '-')) {
            while ($blockLines !== [] && end($blockLines) === '') {
                array_pop($blockLines);
            }
        }

        if ($style === 'literal') {
            $result = implode("\n", $blockLines);
        } else {
            // Folded: join consecutive non-empty lines with spaces, keep blank lines as \n
            $result = '';
            $prevEmpty = false;
            foreach ($blockLines as $bl) {
                if ($bl === '') {
                    $result .= "\n";
                    $prevEmpty = true;
                } else {
                    if ($result !== '' && !$prevEmpty && !str_ends_with($result, "\n")) {
                        $result .= ' ';
                    }
                    $result .= $bl;
                    $prevEmpty = false;
                }
            }
        }

        // Default YAML chomping: add trailing newline unless `-`
        if (!str_ends_with($chomping, '-') && !str_ends_with($result, "\n")) {
            $result .= "\n";
        }

        return $result;
    }

    /**
     * Find the end boundary of a child block based on indentation.
     *
     * @param array<int, string> $lines     All document lines.
     * @param int                $minIndent Minimum indentation for child lines.
     * @param int                $start     Start line index.
     * @param int                $max       Maximum boundary.
     *
     * @return int End line index (exclusive).
     */
    private function findBlockEnd(array $lines, int $minIndent, int $start, int $max): int
    {
        $lastNonEmpty = $start;
        for ($i = $start; $i < $max; $i++) {
            $line = $lines[$i];
            $trimmed = ltrim($line);
            if ($trimmed === '' || $trimmed[0] === '#') {
                continue;
            }
            $indent = strlen($line) - strlen($trimmed);
            if ($indent < $minIndent) {
                return $i;
            }
            $lastNonEmpty = $i + 1;
        }
        return $lastNonEmpty > $start ? max($lastNonEmpty, $max) : $max;
    }

    /**
     * Strip inline comments from a value string, respecting quoted regions.
     *
     * @param string $value Raw value potentially containing inline comments.
     *
     * @return string Value with inline comments removed.
     */
    private function stripInlineComment(string $value): string
    {
        $value = trim($value);
        if ($value === '') {
            return '';
        }

        // Don't strip from quoted strings
        if (($value[0] === '"' || $value[0] === "'") && substr_count($value, $value[0]) >= 2) {
            $closePos = strpos($value, $value[0], 1);
            if ($closePos !== false) {
                $afterQuote = trim(substr($value, $closePos + 1));
                if ($afterQuote === '' || $afterQuote[0] === '#') {
                    return substr($value, 0, $closePos + 1);
                }
            }
        }

        // Strip # comments (but not inside strings)
        $inSingle = false;
        $inDouble = false;
        $len = strlen($value);
        for ($i = 0; $i < $len; $i++) {
            $ch = $value[$i];
            if ($ch === "'" && !$inDouble) {
                $inSingle = !$inSingle;
            } elseif ($ch === '"' && !$inSingle) {
                $inDouble = !$inDouble;
            } elseif ($ch === '#' && !$inSingle && !$inDouble && $i > 0 && $value[$i - 1] === ' ') {
                return trim(substr($value, 0, $i));
            }
        }

        return $value;
    }

    /**
     * Cast a raw YAML scalar string to its PHP native type.
     *
     * Handles quoted strings, null, boolean, integer (decimal/octal/hex),
     * float, infinity, and NaN values.
     *
     * @param string $value Trimmed scalar string.
     *
     * @return mixed PHP native value.
     */
    private function castScalar(string $value): mixed
    {
        $value = trim($value);

        // Quoted strings
        if (strlen($value) >= 2) {
            if ($value[0] === '"' && $value[strlen($value) - 1] === '"') {
                return $this->unescapeDoubleQuoted(substr($value, 1, -1));
            }
            if ($value[0] === "'" && $value[strlen($value) - 1] === "'") {
                return str_replace("''", "'", substr($value, 1, -1));
            }
        }

        // Null
        if (in_array($value, ['~', 'null', 'Null', 'NULL', ''], true)) {
            return null;
        }

        // Boolean
        $lower = strtolower($value);
        if (in_array($lower, ['true', 'yes', 'on'], true)) {
            return true;
        }
        if (in_array($lower, ['false', 'no', 'off'], true)) {
            return false;
        }

        // Integer patterns
        if (preg_match('/^-?(?:0|[1-9]\d*)$/', $value)) {
            return (int) $value;
        }
        if (preg_match('/^0o[0-7]+$/i', $value)) {
            return intval(substr($value, 2), 8);
        }
        if (preg_match('/^0x[0-9a-fA-F]+$/', $value)) {
            return intval($value, 16);
        }

        // Float patterns
        if (preg_match('/^-?(?:0|[1-9]\d*)?(?:\.\d+)?(?:[eE][+-]?\d+)?$/', $value) && str_contains($value, '.')) {
            return (float) $value;
        }
        if ($lower === '.inf' || $lower === '+.inf') {
            return INF;
        }
        if ($lower === '-.inf') {
            return -INF;
        }
        if ($lower === '.nan') {
            return NAN;
        }

        return $value;
    }

    /**
     * Unescape YAML double-quoted string escape sequences.
     *
     * @param string $value String content between double quotes.
     *
     * @return string Unescaped string.
     */
    private function unescapeDoubleQuoted(string $value): string
    {
        return strtr($value, [
            '\\n'  => "\n",
            '\\t'  => "\t",
            '\\r'  => "\r",
            '\\\\'  => "\\",
            '\\"'  => '"',
            '\\0'  => "\0",
            '\\a'  => "\x07",
            '\\b'  => "\x08",
            '\\f'  => "\x0C",
            '\\v'  => "\x0B",
        ]);
    }

    /**
     * Parse a YAML flow sequence ([a, b, c]) into a PHP array.
     *
     * @param string $value Raw flow sequence string including brackets.
     *
     * @return array<int, mixed> Parsed sequence values.
     */
    private function parseFlowSequence(string $value): array
    {
        $inner = trim(substr($value, 1, -1));
        if ($inner === '') {
            return [];
        }

        $items = $this->splitFlowItems($inner);
        return array_map(fn (string $item) => $this->castScalar(trim($item)), $items);
    }

    /**
     * Parse a YAML flow map ({a: b, c: d}) into a PHP associative array.
     *
     * @param string $value Raw flow map string including braces.
     *
     * @return array<string, mixed> Parsed key-value pairs.
     */
    private function parseFlowMap(string $value): array
    {
        $inner = trim(substr($value, 1, -1));
        if ($inner === '') {
            return [];
        }

        $result = [];
        $items = $this->splitFlowItems($inner);
        foreach ($items as $item) {
            $item = trim($item);
            $colonPos = strpos($item, ':');
            if ($colonPos === false) {
                continue;
            }
            $key = trim(substr($item, 0, $colonPos));
            $val = trim(substr($item, $colonPos + 1));
            $result[$key] = $this->castScalar($val);
        }

        return $result;
    }

    /**
     * Split flow-syntax items by comma, respecting nested brackets and quotes.
     *
     * @param string $inner Content between outer brackets/braces.
     *
     * @return array<int, string> Individual item strings.
     */
    private function splitFlowItems(string $inner): array
    {
        $items = [];
        $depth = 0;
        $current = '';
        $inQuote = false;
        $quoteChar = '';
        $len = strlen($inner);

        for ($i = 0; $i < $len; $i++) {
            $ch = $inner[$i];

            if ($inQuote) {
                $current .= $ch;
                if ($ch === $quoteChar) {
                    $inQuote = false;
                }
                continue;
            }

            if ($ch === '"' || $ch === "'") {
                $inQuote = true;
                $quoteChar = $ch;
                $current .= $ch;
                continue;
            }

            if ($ch === '[' || $ch === '{') {
                $depth++;
                $current .= $ch;
                continue;
            }

            if ($ch === ']' || $ch === '}') {
                $depth--;
                $current .= $ch;
                continue;
            }

            if ($ch === ',' && $depth === 0) {
                $items[] = $current;
                $current = '';
                continue;
            }

            $current .= $ch;
        }

        if (trim($current) !== '') {
            $items[] = $current;
        }

        return $items;
    }
}
