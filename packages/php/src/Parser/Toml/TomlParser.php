<?php

declare(strict_types=1);

namespace SafeAccess\Inline\Parser\Toml;

use SafeAccess\Inline\Exceptions\TomlParseException;

/**
 * Minimal TOML parser supporting a safe, practical subset of TOML 1.0.
 *
 * Parses key/value pairs, tables (`[a.b]`), arrays of tables (`[[a.b]]`),
 * dotted keys, inline arrays and inline tables, and the scalar types
 * (string, integer, float, boolean). Datetimes are preserved as strings for
 * cross-language parity. Duplicate keys and redefined tables are rejected.
 *
 * Does not depend on an external TOML library, making the library portable.
 * Behaviour is mirrored in the JS implementation for parity.
 *
 * @internal
 *
 * @see TomlAccessor       Accessor consuming this parser.
 * @see TomlParseException Thrown on parse errors.
 */
final class TomlParser
{
    /** @var int Maximum allowed nesting depth during parsing. */
    private readonly int $maxDepth;

    /**
     * @param int $maxDepth Maximum allowed nesting depth during parsing.
     */
    public function __construct(int $maxDepth = 512)
    {
        $this->maxDepth = $maxDepth;
    }

    /**
     * Parse a TOML string into a PHP array.
     *
     * @param string $toml Raw TOML content.
     *
     * @return array<mixed> Parsed data structure.
     *
     * @throws \SafeAccess\Inline\Exceptions\TomlParseException When syntax errors, duplicate keys, redefined tables, or nesting depth exceeded.
     */
    public function parse(string $toml): array
    {
        $logical = $this->joinLogicalLines(explode("\n", str_replace("\r\n", "\n", $toml)));

        /** @var array<string, mixed> $root */
        $root = [];
        // Tracks table paths already defined via [table] to reject redefinition.
        $definedTables = [];
        // Tracks arrays created via [[array-of-tables]] to allow re-entry.
        $arrayTables = [];

        // Index path (string keys and int list-indices) from $root to the map
        // that subsequent bare `key = value` lines write into.
        $currentBase = [];
        $currentPath = '';

        foreach ($logical as [$text, $line]) {
            $trimmed = trim($this->stripComment($text));
            if ($trimmed === '') {
                continue;
            }

            // Array of tables: [[a.b.c]]
            if (str_starts_with($trimmed, '[[') && str_ends_with($trimmed, ']]')) {
                $path = trim(substr($trimmed, 2, -2));
                $keys = $this->parseKeyPath($path, $line);
                $currentBase = $this->enterArrayTable($root, $keys, $arrayTables, $definedTables, $line);
                $currentPath = $path;
                continue;
            }

            // Standard table: [a.b.c]
            if (str_starts_with($trimmed, '[') && str_ends_with($trimmed, ']')) {
                $path = trim(substr($trimmed, 1, -1));
                $keys = $this->parseKeyPath($path, $line);
                $joined = implode("\x00", $keys);
                if (isset($definedTables[$joined]) || isset($arrayTables[$joined])) {
                    throw new TomlParseException("Redefinition of table \"{$path}\" (line {$line}).");
                }
                $definedTables[$joined] = true;
                $currentBase = $this->enterTable($root, $keys, $line);
                $currentPath = $path;
                continue;
            }

            // key = value (bare, dotted, or quoted key)
            $eq = $this->findAssignment($trimmed);
            if ($eq < 0) {
                throw new TomlParseException(
                    "Invalid TOML syntax, expected '=' (line {$line}): {$trimmed}"
                );
            }

            $keyPart = trim(substr($trimmed, 0, $eq));
            $valuePart = trim(substr($trimmed, $eq + 1));
            $keys = $this->parseKeyPath($keyPart, $line);
            $value = $this->parseValue($valuePart, $line, 0);
            $this->assign($root, $currentBase, $keys, $value, $currentPath, $line);
        }

        return $root;
    }

    /**
     * Join lines that belong to a single multi-line value into logical lines.
     *
     * @param array<int, string> $lines Physical lines of the document.
     *
     * @return array<int, array{0: string, 1: int}> Logical lines as [text, 1-based line number].
     *
     * @throws \SafeAccess\Inline\Exceptions\TomlParseException When a multi-line construct is never closed.
     */
    private function joinLogicalLines(array $lines): array
    {
        $out = [];
        $count = count($lines);
        $i = 0;

        while ($i < $count) {
            $startLine = $i + 1;
            $buffer = $lines[$i];

            while ($this->hasOpenMultilineString($buffer) && $i + 1 < $count) {
                $i++;
                $buffer .= "\n" . $lines[$i];
            }

            while ($this->hasOpenBracket($buffer) && $i + 1 < $count) {
                $i++;
                $buffer .= "\n" . $lines[$i];
            }

            if ($this->hasOpenMultilineString($buffer)) {
                throw new TomlParseException("Unterminated multi-line string (line {$startLine}).");
            }
            if ($this->hasOpenBracket($buffer)) {
                throw new TomlParseException("Unterminated array or table (line {$startLine}).");
            }

            $out[] = [$buffer, $startLine];
            $i++;
        }

        return $out;
    }

    /**
     * Report whether a buffer has an odd number of `"""` or `'''` delimiters.
     *
     * @param string $buffer Accumulated logical-line text.
     */
    private function hasOpenMultilineString(string $buffer): bool
    {
        $basic = substr_count($buffer, '"""');
        $literal = substr_count($buffer, "'''");

        return $basic % 2 !== 0 || $literal % 2 !== 0;
    }

    /**
     * Report whether inline `[`/`{` brackets are unbalanced outside strings.
     *
     * @param string $buffer Accumulated logical-line text.
     */
    private function hasOpenBracket(string $buffer): bool
    {
        $depth = 0;
        $inStr = false;
        $quote = '';
        $len = strlen($buffer);
        for ($k = 0; $k < $len; $k++) {
            $ch = $buffer[$k];
            if ($inStr) {
                if ($ch === $quote) {
                    $inStr = false;
                }
                continue;
            }
            if ($ch === '"' || $ch === "'") {
                $inStr = true;
                $quote = $ch;
                continue;
            }
            if ($ch === '#') {
                break;
            }
            if ($ch === '[' || $ch === '{') {
                $depth++;
            } elseif ($ch === ']' || $ch === '}') {
                $depth--;
            }
        }

        return $depth > 0;
    }

    /**
     * Find the index of the top-level `=` that separates key from value.
     *
     * @param string $line Trimmed assignment line.
     *
     * @return int Index of the separating `=`, or -1 when none is found.
     */
    private function findAssignment(string $line): int
    {
        $inStr = false;
        $quote = '';
        $len = strlen($line);
        for ($i = 0; $i < $len; $i++) {
            $ch = $line[$i];
            if ($inStr) {
                if ($ch === $quote) {
                    $inStr = false;
                }
                continue;
            }
            if ($ch === '"' || $ch === "'") {
                $inStr = true;
                $quote = $ch;
                continue;
            }
            if ($ch === '[' || $ch === ']') {
                // A bare `[...]` at the start is a table header, not an assignment.
                return -1;
            }
            if ($ch === '=') {
                return $i;
            }
        }

        return -1;
    }

    /**
     * Split a (possibly dotted, possibly quoted) key path into segments.
     *
     * @param string $raw  Raw key text, e.g. `a.b.c` or `"a.b".c`.
     * @param int    $line Source line for error messages.
     *
     * @return array<int, string> Ordered key segments.
     *
     * @throws \SafeAccess\Inline\Exceptions\TomlParseException When the path is empty or a segment is blank.
     */
    private function parseKeyPath(string $raw, int $line): array
    {
        $segments = [];
        $current = '';
        $inStr = false;
        $quote = '';
        $len = strlen($raw);

        for ($i = 0; $i < $len; $i++) {
            $ch = $raw[$i];
            if ($inStr) {
                if ($ch === $quote) {
                    $inStr = false;
                }
                $current .= $ch;
                continue;
            }
            if ($ch === '"' || $ch === "'") {
                $inStr = true;
                $quote = $ch;
                $current .= $ch;
                continue;
            }
            if ($ch === '.') {
                $segments[] = trim($current);
                $current = '';
                continue;
            }
            $current .= $ch;
        }
        $segments[] = trim($current);

        $cleaned = array_map(fn (string $s): string => $this->unquoteKey($s), $segments);
        foreach ($cleaned as $segment) {
            if ($segment === '') {
                throw new TomlParseException("Invalid or empty key \"{$raw}\" (line {$line}).");
            }
        }

        return $cleaned;
    }

    /**
     * Strip a single matching pair of quotes from a key segment.
     *
     * @param string $key Raw key segment, possibly quoted.
     *
     * @return string Unquoted key segment.
     */
    private function unquoteKey(string $key): string
    {
        if (strlen($key) >= 2) {
            if (str_starts_with($key, '"') && str_ends_with($key, '"')) {
                return $this->unescapeBasic(substr($key, 1, -1));
            }
            if (str_starts_with($key, "'") && str_ends_with($key, "'")) {
                return substr($key, 1, -1);
            }
        }

        return $key;
    }

    /**
     * Resolve a reference to the nested slot addressed by an index path.
     *
     * The path holds already-validated string keys and integer list-indices,
     * so every step is guaranteed to land on an existing array slot.
     *
     * @param array<string, mixed>    $root      Document root map (by reference).
     * @param array<int, int|string>  $indexPath Sequence of keys/indices from the root.
     *
     * @return array<mixed> Reference to the addressed array slot.
     */
    private function &resolveRef(array &$root, array $indexPath): array
    {
        $node = &$root;
        foreach ($indexPath as $step) {
            $child = &$node[$step];
            unset($node);
            if (!is_array($child)) {
                // Unreachable: index paths only ever address array slots.
                $child = []; // @codeCoverageIgnore
            }
            $node = &$child;
            unset($child);
        }

        return $node;
    }

    /**
     * Descend/create the nested map addressed by a standard `[table]` header.
     *
     * @param array<string, mixed> $root Document root map (by reference).
     * @param array<int, string>   $keys Table path segments.
     * @param int                  $line Source line for error messages.
     *
     * @return array<int, int|string> Index path from the root to the target map.
     *
     * @throws \SafeAccess\Inline\Exceptions\TomlParseException When a path segment collides with a scalar.
     */
    private function enterTable(array &$root, array $keys, int $line): array
    {
        $indexPath = [];
        // Plain (non-reference) cursor: inspection is fully typed. Writes to
        // create missing intermediate tables go through resolveRef().
        $cursor = $root;
        foreach ($keys as $idx => $key) {
            if (!array_key_exists($key, $cursor)) {
                $slot = &$this->resolveRef($root, $indexPath);
                $slot[$key] = [];
                unset($slot);
                $indexPath[] = $key;
                $cursor = [];
                continue;
            }

            $existing = $cursor[$key];
            if (is_array($existing) && array_is_list($existing) && $existing !== []) {
                // Descend into the most recent element of an array-of-tables.
                $lastIndex = count($existing) - 1;
                $last = $existing[$lastIndex];
                // Unreachable: enterArrayTable only ever pushes maps, so $last is a map.
                // @codeCoverageIgnoreStart
                if (!is_array($last) || array_is_list($last)) {
                    $path = implode('.', array_slice($keys, 0, $idx + 1));
                    throw new TomlParseException("Cannot redefine \"{$path}\" as a table (line {$line}).");
                }
                // @codeCoverageIgnoreEnd
                $indexPath[] = $key;
                $indexPath[] = $lastIndex;
                $cursor = $last;
            } elseif (is_array($existing)) {
                $indexPath[] = $key;
                $cursor = $existing;
            } else {
                $path = implode('.', array_slice($keys, 0, $idx + 1));
                throw new TomlParseException("Cannot redefine \"{$path}\" as a table (line {$line}).");
            }
        }

        return $indexPath;
    }

    /**
     * Descend/create the array addressed by a `[[array-of-tables]]` header and
     * push a fresh element for the current block.
     *
     * @param array<string, mixed> $root          Document root map (by reference).
     * @param array<int, string>   $keys          Array-of-tables path segments.
     * @param array<string, bool>  $arrayTables   Known array-of-tables paths (by reference).
     * @param array<string, bool>  $definedTables Standard table paths (for collision checks).
     * @param int                  $line          Source line for error messages.
     *
     * @return array<int, int|string> Index path from the root to the new element map.
     *
     * @throws \SafeAccess\Inline\Exceptions\TomlParseException When the path collides with a non-array value.
     */
    private function enterArrayTable(array &$root, array $keys, array &$arrayTables, array $definedTables, int $line): array
    {
        $parentKeys = array_slice($keys, 0, -1);
        $leaf = $keys[count($keys) - 1];
        $parentPath = $this->enterTable($root, $parentKeys, $line);
        $parent = &$this->resolveRef($root, $parentPath);
        $joined = implode("\x00", $keys);

        if (isset($definedTables[$joined])) {
            $name = implode('.', $keys);
            throw new TomlParseException("Cannot redefine table \"{$name}\" as an array of tables (line {$line}).");
        }

        if (!array_key_exists($leaf, $parent)) {
            $parent[$leaf] = [];
            $arrayTables[$joined] = true;
        } else {
            $existing = $parent[$leaf];
            if (!is_array($existing) || !array_is_list($existing)) {
                $name = implode('.', $keys);
                throw new TomlParseException("Cannot redefine \"{$name}\" as an array of tables (line {$line}).");
            }
        }

        // Push a fresh element onto the (guaranteed) list slot.
        $list = &$this->resolveRef($parent, [$leaf]);
        $lastIndex = count($list);
        $list[$lastIndex] = [];
        unset($list);

        return [...$parentPath, $leaf, $lastIndex];
    }

    /**
     * Assign a value into the current table, honouring dotted keys and
     * rejecting duplicates.
     *
     * @param array<string, mixed>   $root        Document root map (by reference).
     * @param array<int, int|string> $base        Index path to the table the assignment belongs to.
     * @param array<int, string>     $keys        Key path segments.
     * @param mixed                  $value       Parsed value.
     * @param string                 $currentPath Human-readable path of the current table.
     * @param int                    $line        Source line for error messages.
     *
     * @throws \SafeAccess\Inline\Exceptions\TomlParseException When the key already exists.
     */
    private function assign(array &$root, array $base, array $keys, mixed $value, string $currentPath, int $line): void
    {
        $node = &$this->resolveRef($root, $base);
        $limit = count($keys) - 1;
        for ($i = 0; $i < $limit; $i++) {
            $key = $keys[$i];
            if (!array_key_exists($key, $node)) {
                $node[$key] = [];
                $node = &$node[$key];
            } elseif (is_array($node[$key]) && !array_is_list($node[$key])) {
                $node = &$node[$key];
            } else {
                $path = implode('.', array_slice($keys, 0, $i + 1));
                throw new TomlParseException("Cannot extend \"{$path}\" with a dotted key (line {$line}).");
            }
        }

        $leaf = $keys[count($keys) - 1];
        if (array_key_exists($leaf, $node)) {
            $scope = $currentPath === '' ? '' : " in table \"{$currentPath}\"";
            throw new TomlParseException("Duplicate key \"{$leaf}\"{$scope} (line {$line}).");
        }
        $node[$leaf] = $value;
    }

    /**
     * Parse a value string into its typed representation.
     *
     * @param string $raw   Trimmed value text.
     * @param int    $line  Source line for error messages.
     * @param int    $depth Current nesting depth.
     *
     * @return mixed Typed value (string, int, float, bool, list, or map).
     *
     * @throws \SafeAccess\Inline\Exceptions\TomlParseException When nesting exceeds the configured maximum.
     */
    private function parseValue(string $raw, int $line, int $depth): mixed
    {
        if ($depth > $this->maxDepth) {
            throw new TomlParseException(
                "TOML nesting depth {$depth} exceeds maximum of {$this->maxDepth}."
            );
        }

        $value = trim($raw);

        // Multi-line basic string
        if (strlen($value) >= 6 && str_starts_with($value, '"""') && str_ends_with($value, '"""')) {
            return $this->parseMultilineString(substr($value, 3, -3), true);
        }
        // Multi-line literal string
        if (strlen($value) >= 6 && str_starts_with($value, "'''") && str_ends_with($value, "'''")) {
            return $this->parseMultilineString(substr($value, 3, -3), false);
        }
        // Basic string
        if (strlen($value) >= 2 && str_starts_with($value, '"') && str_ends_with($value, '"')) {
            return $this->unescapeBasic(substr($value, 1, -1));
        }
        // Literal string
        if (strlen($value) >= 2 && str_starts_with($value, "'") && str_ends_with($value, "'")) {
            return substr($value, 1, -1);
        }
        // Inline array
        if (str_starts_with($value, '[') && str_ends_with($value, ']')) {
            return $this->parseArray(substr($value, 1, -1), $line, $depth + 1);
        }
        // Inline table
        if (str_starts_with($value, '{') && str_ends_with($value, '}')) {
            return $this->parseInlineTable(substr($value, 1, -1), $line, $depth + 1);
        }

        return $this->castScalar($value, $line);
    }

    /**
     * Parse the interior of an inline array (already stripped of brackets).
     *
     * @param string $inner Text between the outer brackets.
     * @param int    $line  Source line for error messages.
     * @param int    $depth Current nesting depth.
     *
     * @return array<int, mixed> Parsed array values.
     */
    private function parseArray(string $inner, int $line, int $depth): array
    {
        $trimmed = trim($inner);
        if ($trimmed === '') {
            return [];
        }

        return array_map(
            fn (string $item): mixed => $this->parseValue(trim($item), $line, $depth),
            $this->splitTopLevel($trimmed)
        );
    }

    /**
     * Parse the interior of an inline table (already stripped of braces).
     *
     * @param string $inner Text between the outer braces.
     * @param int    $line  Source line for error messages.
     * @param int    $depth Current nesting depth.
     *
     * @return array<string, mixed> Parsed key-value pairs.
     *
     * @throws \SafeAccess\Inline\Exceptions\TomlParseException When an entry lacks `=` or a key repeats.
     */
    private function parseInlineTable(string $inner, int $line, int $depth): array
    {
        /** @var array<string, mixed> $result */
        $result = [];
        $trimmed = trim($inner);
        if ($trimmed === '') {
            return $result;
        }
        foreach ($this->splitTopLevel($trimmed) as $entry) {
            $item = trim($entry);
            if ($item === '') {
                // Unreachable: splitTopLevel already drops empty items.
                continue; // @codeCoverageIgnore
            }
            $eq = $this->findAssignment($item);
            if ($eq < 0) {
                throw new TomlParseException("Invalid inline table entry \"{$item}\" (line {$line}).");
            }
            $keys = $this->parseKeyPath(trim(substr($item, 0, $eq)), $line);
            $value = $this->parseValue(trim(substr($item, $eq + 1)), $line, $depth);
            $this->assign($result, [], $keys, $value, '', $line);
        }

        return $result;
    }

    /**
     * Split a string on commas at bracket/brace depth zero and outside quotes.
     *
     * @param string $input Text to split (array or inline-table interior).
     *
     * @return array<int, string> Individual item strings (empty items dropped).
     */
    private function splitTopLevel(string $input): array
    {
        $items = [];
        $depth = 0;
        $current = '';
        $inStr = false;
        $quote = '';
        $triple = false;
        $len = strlen($input);

        for ($i = 0; $i < $len; $i++) {
            $ch = $input[$i];

            if ($inStr) {
                $current .= $ch;
                if ($triple) {
                    if ($ch === $quote && substr($input, $i, 3) === str_repeat($quote, 3)) {
                        $current .= substr($input, $i + 1, 2);
                        $i += 2;
                        $inStr = false;
                        $triple = false;
                    }
                } elseif ($ch === $quote) {
                    $inStr = false;
                }
                continue;
            }

            if ($ch === '"' || $ch === "'") {
                $inStr = true;
                $quote = $ch;
                $triple = substr($input, $i, 3) === str_repeat($ch, 3);
                if ($triple) {
                    $current .= substr($input, $i, 3);
                    $i += 2;
                    continue;
                }
                $current .= $ch;
                continue;
            }

            if ($ch === '[' || $ch === '{') {
                $depth++;
            } elseif ($ch === ']' || $ch === '}') {
                $depth--;
            }

            if ($ch === ',' && $depth === 0) {
                if (trim($current) !== '') {
                    $items[] = $current;
                }
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

    /**
     * Parse a multi-line string body (delimiters already stripped).
     *
     * @param string $body  Text between the triple delimiters.
     * @param bool   $basic True for `"""` (escapes applied), false for `'''` (literal).
     *
     * @return string The assembled string.
     */
    private function parseMultilineString(string $body, bool $basic): string
    {
        // A newline immediately following the opening delimiter is trimmed.
        $text = str_starts_with($body, "\n") ? substr($body, 1) : $body;
        if (!$basic) {
            return $text;
        }
        // Line-ending backslash trims the newline and leading whitespace.
        $text = preg_replace('/\\\\\n\s*/', '', $text) ?? $text;

        return $this->unescapeBasic($text);
    }

    /**
     * Cast a bare (unquoted) scalar to its native type.
     *
     * @param string $value Trimmed scalar text.
     * @param int    $line  Source line for error messages.
     *
     * @return mixed Typed value (bool, int, float, or string).
     *
     * @throws \SafeAccess\Inline\Exceptions\TomlParseException When the value is empty.
     */
    private function castScalar(string $value, int $line): mixed
    {
        if ($value === '') {
            throw new TomlParseException("Missing value (line {$line}).");
        }

        // Boolean (TOML is strict: lowercase only).
        if ($value === 'true') {
            return true;
        }
        if ($value === 'false') {
            return false;
        }

        // Float special values.
        if ($value === 'inf' || $value === '+inf') {
            return INF;
        }
        if ($value === '-inf') {
            return -INF;
        }
        if ($value === 'nan' || $value === '+nan' || $value === '-nan') {
            return NAN;
        }

        // Integer with base prefixes.
        if (preg_match('/^0x[0-9a-fA-F](?:[0-9a-fA-F_]*[0-9a-fA-F])?$/', $value)) {
            return (int) hexdec(str_replace('_', '', substr($value, 2)));
        }
        if (preg_match('/^0o[0-7](?:[0-7_]*[0-7])?$/', $value)) {
            return (int) octdec(str_replace('_', '', substr($value, 2)));
        }
        if (preg_match('/^0b[01](?:[01_]*[01])?$/', $value)) {
            return (int) bindec(str_replace('_', '', substr($value, 2)));
        }

        // Decimal integer (optional sign, `_` between digits).
        if (preg_match('/^[+-]?(?:0|[1-9](?:_?\d)*)$/', $value)) {
            return (int) str_replace('_', '', $value);
        }

        // Float (fraction and/or exponent required to distinguish from int).
        if (
            preg_match('/^[+-]?(?:0|[1-9](?:_?\d)*)(?:\.\d(?:_?\d)*)?(?:[eE][+-]?\d(?:_?\d)*)?$/', $value)
            && preg_match('/[.eE]/', $value)
        ) {
            return (float) str_replace('_', '', $value);
        }

        // Datetimes and everything else are preserved as their raw string,
        // matching the JS implementation for parity.
        return $value;
    }

    /**
     * Unescape TOML basic-string escape sequences, including `\uXXXX`.
     *
     * @param string $value String content without surrounding quotes.
     *
     * @return string Unescaped string.
     */
    private function unescapeBasic(string $value): string
    {
        $value = preg_replace_callback(
            '/\\\\u([0-9a-fA-F]{4})/',
            fn (array $m): string => $this->codePointToUtf8((int) hexdec($m[1])),
            $value
        ) ?? $value;
        $value = preg_replace_callback(
            '/\\\\U([0-9a-fA-F]{8})/',
            fn (array $m): string => $this->codePointToUtf8((int) hexdec($m[1])),
            $value
        ) ?? $value;

        return strtr($value, [
            '\\n' => "\n",
            '\\t' => "\t",
            '\\r' => "\r",
            '\\"' => '"',
            '\\b' => "\x08",
            '\\f' => "\x0C",
            '\\\\' => '\\',
        ]);
    }

    /**
     * Convert a Unicode code point to its UTF-8 byte sequence.
     *
     * @param int $codePoint Unicode code point.
     *
     * @return string UTF-8 encoded character.
     */
    private function codePointToUtf8(int $codePoint): string
    {
        return mb_chr($codePoint, 'UTF-8');
    }

    /**
     * Strip a trailing `#` comment from a line, respecting quoted regions.
     *
     * @param string $line Raw physical/logical line.
     *
     * @return string Line with any inline comment removed.
     */
    private function stripComment(string $line): string
    {
        $inStr = false;
        $quote = '';
        $len = strlen($line);
        for ($i = 0; $i < $len; $i++) {
            $ch = $line[$i];
            if ($inStr) {
                if ($ch === $quote) {
                    $inStr = false;
                }
                continue;
            }
            if ($ch === '"' || $ch === "'") {
                $inStr = true;
                $quote = $ch;
                continue;
            }
            if ($ch === '#') {
                return substr($line, 0, $i);
            }
        }

        return $line;
    }
}
