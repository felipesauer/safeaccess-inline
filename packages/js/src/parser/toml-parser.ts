import { TomlParseException } from '../exceptions/toml-parse-exception.js';

/**
 * Minimal TOML parser supporting a safe, practical subset of TOML 1.0.
 *
 * Parses key/value pairs, tables (`[a.b]`), arrays of tables (`[[a.b]]`),
 * dotted keys, inline arrays and inline tables, and the scalar types
 * (string, integer, float, boolean). Datetimes are preserved as strings for
 * cross-language parity. Duplicate keys and redefined tables are rejected.
 *
 * Does not depend on external TOML libraries, making the package portable.
 * Behaviour is mirrored in the PHP implementation for parity.
 *
 * @internal
 */
export class TomlParser {
    private readonly maxDepth: number;

    /**
     * @param maxDepth - Maximum allowed nesting depth during parsing.
     *   Defaults to 512 to match SecurityParser.maxDepth.
     */
    constructor(maxDepth: number = 512) {
        this.maxDepth = maxDepth;
    }

    /**
     * Parse a TOML string into a plain object.
     *
     * @param toml - Raw TOML content.
     * @returns Parsed data structure.
     * @throws {TomlParseException} When syntax errors, duplicate keys, redefined
     *   tables, or nesting depth exceeded.
     *
     * @example
     * new TomlParser().parse('key = "value"'); // { key: 'value' }
     */
    parse(toml: string): Record<string, unknown> {
        const logical = this.joinLogicalLines(toml.replace(/\r\n/g, '\n').split('\n'));

        const root: Record<string, unknown> = {};
        // Tracks table paths already defined via [table] to reject redefinition.
        const definedTables = new Set<string>();
        // Tracks arrays created via [[array-of-tables]] to allow re-entry.
        const arrayTables = new Set<string>();

        // The map that subsequent bare `key = value` lines write into.
        let current = root;
        let currentPath = '';

        for (const { text, line } of logical) {
            const trimmed = this.stripComment(text).trim();
            if (trimmed === '') {
                continue;
            }

            // Array of tables: [[a.b.c]]
            if (trimmed.startsWith('[[') && trimmed.endsWith(']]')) {
                const path = trimmed.slice(2, -2).trim();
                const keys = this.parseKeyPath(path, line);
                current = this.enterArrayTable(root, keys, arrayTables, definedTables, line);
                currentPath = path;
                continue;
            }

            // Standard table: [a.b.c]
            if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
                const path = trimmed.slice(1, -1).trim();
                const keys = this.parseKeyPath(path, line);
                const joined = JSON.stringify(keys);
                if (definedTables.has(joined) || arrayTables.has(joined)) {
                    throw new TomlParseException(`Redefinition of table "${path}" (line ${line}).`);
                }
                definedTables.add(joined);
                current = this.enterTable(root, keys, line);
                currentPath = path;
                continue;
            }

            // key = value (bare, dotted, or quoted key)
            const eq = this.findAssignment(trimmed);
            if (eq < 0) {
                throw new TomlParseException(
                    `Invalid TOML syntax, expected '=' (line ${line}): ${trimmed}`,
                );
            }

            const keyPart = trimmed.slice(0, eq).trim();
            const valuePart = trimmed.slice(eq + 1).trim();
            const keys = this.parseKeyPath(keyPart, line);
            const value = this.parseValue(valuePart, line, 0);
            this.assign(current, keys, value, currentPath, line);
        }

        return root;
    }

    /**
     * Join lines that belong to a single multi-line value (inline arrays,
     * multi-line strings) into logical lines carrying their source line number.
     *
     * @param lines - Physical lines of the document.
     * @returns Logical lines with 1-based source line numbers.
     * @throws {TomlParseException} When a multi-line construct is never closed.
     */
    private joinLogicalLines(lines: string[]): Array<{ text: string; line: number }> {
        const out: Array<{ text: string; line: number }> = [];
        let i = 0;

        while (i < lines.length) {
            const startLine = i + 1;
            let buffer = lines[i] as string;

            // Multi-line string delimiters (""" or ''') must be balanced.
            while (this.hasOpenMultilineString(buffer) && i + 1 < lines.length) {
                i++;
                buffer += '\n' + (lines[i] as string);
            }

            // Unbalanced inline array/table brackets continue onto next lines.
            while (this.hasOpenBracket(buffer) && i + 1 < lines.length) {
                i++;
                buffer += '\n' + (lines[i] as string);
            }

            if (this.hasOpenMultilineString(buffer)) {
                throw new TomlParseException(`Unterminated multi-line string (line ${startLine}).`);
            }
            if (this.hasOpenBracket(buffer)) {
                throw new TomlParseException(`Unterminated array or table (line ${startLine}).`);
            }

            out.push({ text: buffer, line: startLine });
            i++;
        }

        return out;
    }

    /**
     * Report whether a buffer has an odd number of `"""` or `'''` delimiters.
     *
     * @param buffer - Accumulated logical-line text.
     * @returns True when a multi-line string is still open.
     */
    private hasOpenMultilineString(buffer: string): boolean {
        const basic = (buffer.match(/"""/g) ?? []).length;
        const literal = (buffer.match(/'''/g) ?? []).length;
        return basic % 2 !== 0 || literal % 2 !== 0;
    }

    /**
     * Report whether inline `[`/`{` brackets are unbalanced outside strings.
     *
     * @param buffer - Accumulated logical-line text.
     * @returns True when a bracket or brace remains open.
     */
    private hasOpenBracket(buffer: string): boolean {
        let depth = 0;
        let inStr = false;
        let quote = '';
        for (let k = 0; k < buffer.length; k++) {
            const ch = buffer[k] as string;
            if (inStr) {
                if (ch === quote) {
                    inStr = false;
                }
                continue;
            }
            if (ch === '"' || ch === "'") {
                inStr = true;
                quote = ch;
                continue;
            }
            if (ch === '#') {
                break;
            }
            if (ch === '[' || ch === '{') {
                depth++;
            } else if (ch === ']' || ch === '}') {
                depth--;
            }
        }
        return depth > 0;
    }

    /**
     * Find the index of the top-level `=` that separates key from value.
     *
     * @param line - Trimmed assignment line.
     * @returns Index of the separating `=`, or -1 when none is found.
     */
    private findAssignment(line: string): number {
        let inStr = false;
        let quote = '';
        for (let i = 0; i < line.length; i++) {
            const ch = line[i] as string;
            if (inStr) {
                if (ch === quote) {
                    inStr = false;
                }
                continue;
            }
            if (ch === '"' || ch === "'") {
                inStr = true;
                quote = ch;
                continue;
            }
            if (ch === '[' || ch === ']') {
                // A bare `[...]` at the start is a table header, not an assignment.
                return -1;
            }
            if (ch === '=') {
                return i;
            }
        }
        return -1;
    }

    /**
     * Split a (possibly dotted, possibly quoted) key path into segments.
     *
     * @param raw - Raw key text, e.g. `a.b.c` or `"a.b".c`.
     * @param line - Source line for error messages.
     * @returns Ordered key segments.
     * @throws {TomlParseException} When the path is empty or a segment is blank.
     */
    private parseKeyPath(raw: string, line: number): string[] {
        const segments: string[] = [];
        let current = '';
        let inStr = false;
        let quote = '';

        for (let i = 0; i < raw.length; i++) {
            const ch = raw[i] as string;
            if (inStr) {
                if (ch === quote) {
                    inStr = false;
                }
                current += ch;
                continue;
            }
            if (ch === '"' || ch === "'") {
                inStr = true;
                quote = ch;
                current += ch;
                continue;
            }
            if (ch === '.') {
                segments.push(current.trim());
                current = '';
                continue;
            }
            current += ch;
        }
        segments.push(current.trim());

        const cleaned = segments.map((s) => this.unquoteKey(s));
        if (cleaned.length === 0 || cleaned.some((s) => s === '')) {
            throw new TomlParseException(`Invalid or empty key "${raw}" (line ${line}).`);
        }
        return cleaned;
    }

    /**
     * Strip a single matching pair of quotes from a key segment.
     *
     * @param key - Raw key segment, possibly quoted.
     * @returns Unquoted key segment.
     */
    private unquoteKey(key: string): string {
        if (key.length >= 2) {
            if (key.startsWith('"') && key.endsWith('"')) {
                return this.unescapeBasic(key.slice(1, -1));
            }
            if (key.startsWith("'") && key.endsWith("'")) {
                return key.slice(1, -1);
            }
        }
        return key;
    }

    /**
     * Descend/create the nested map addressed by a standard `[table]` header.
     *
     * @param root - Document root map.
     * @param keys - Table path segments.
     * @param line - Source line for error messages.
     * @returns The map that subsequent key/value lines write into.
     * @throws {TomlParseException} When a path segment collides with a scalar.
     */
    private enterTable(
        root: Record<string, unknown>,
        keys: string[],
        line: number,
    ): Record<string, unknown> {
        let node: Record<string, unknown> = root;
        for (const [idx, key] of keys.entries()) {
            const existing = node[key];
            if (existing === undefined) {
                const created: Record<string, unknown> = {};
                node[key] = created;
                node = created;
            } else if (Array.isArray(existing)) {
                // Descend into the most recent element of an array-of-tables.
                const last = existing[existing.length - 1];
                /* Stryker disable next-line ConditionalExpression,BlockStatement -- defensive: enterArrayTable only ever pushes plain maps, so `last` is always an object */
                /* c8 ignore start */
                if (typeof last !== 'object' || last === null || Array.isArray(last)) {
                    throw new TomlParseException(
                        `Cannot redefine "${keys.slice(0, idx + 1).join('.')}" as a table (line ${line}).`,
                    );
                }
                /* c8 ignore stop */
                node = last as Record<string, unknown>;
            } else if (typeof existing === 'object') {
                node = existing as Record<string, unknown>;
            } else {
                throw new TomlParseException(
                    `Cannot redefine "${keys.slice(0, idx + 1).join('.')}" as a table (line ${line}).`,
                );
            }
        }
        return node;
    }

    /**
     * Descend/create the array addressed by a `[[array-of-tables]]` header and
     * push a fresh element for the current block.
     *
     * @param root - Document root map.
     * @param keys - Array-of-tables path segments.
     * @param arrayTables - Set of known array-of-tables paths (updated).
     * @param definedTables - Set of standard table paths (for collision checks).
     * @param line - Source line for error messages.
     * @returns The newly pushed element map.
     * @throws {TomlParseException} When the path collides with a non-array value.
     */
    private enterArrayTable(
        root: Record<string, unknown>,
        keys: string[],
        arrayTables: Set<string>,
        definedTables: Set<string>,
        line: number,
    ): Record<string, unknown> {
        const parentKeys = keys.slice(0, -1);
        const leaf = keys[keys.length - 1] as string;
        const parent = this.enterTable(root, parentKeys, line);
        const joined = JSON.stringify(keys);

        if (definedTables.has(joined)) {
            throw new TomlParseException(
                `Cannot redefine table "${keys.join('.')}" as an array of tables (line ${line}).`,
            );
        }

        let arr = parent[leaf];
        if (arr === undefined) {
            arr = [];
            parent[leaf] = arr;
            arrayTables.add(joined);
        } else if (!Array.isArray(arr)) {
            throw new TomlParseException(
                `Cannot redefine "${keys.join('.')}" as an array of tables (line ${line}).`,
            );
        }

        const element: Record<string, unknown> = {};
        (arr as unknown[]).push(element);
        return element;
    }

    /**
     * Assign a value into the current table, honouring dotted keys and
     * rejecting duplicates.
     *
     * @param current - Table the assignment belongs to.
     * @param keys - Key path segments (dotted keys yield >1 segment).
     * @param value - Parsed value.
     * @param currentPath - NUL-joined path of the current table (for messages).
     * @param line - Source line for error messages.
     * @throws {TomlParseException} When the key already exists.
     */
    private assign(
        current: Record<string, unknown>,
        keys: string[],
        value: unknown,
        currentPath: string,
        line: number,
    ): void {
        let node = current;
        for (let i = 0; i < keys.length - 1; i++) {
            const key = keys[i] as string;
            const existing = node[key];
            if (existing === undefined) {
                const created: Record<string, unknown> = {};
                node[key] = created;
                node = created;
            } else if (
                typeof existing === 'object' &&
                existing !== null &&
                !Array.isArray(existing)
            ) {
                node = existing as Record<string, unknown>;
            } else {
                throw new TomlParseException(
                    `Cannot extend "${keys.slice(0, i + 1).join('.')}" with a dotted key (line ${line}).`,
                );
            }
        }

        const leaf = keys[keys.length - 1] as string;
        if (Object.prototype.hasOwnProperty.call(node, leaf)) {
            const scope = currentPath === '' ? '' : ` in table "${currentPath}"`;
            throw new TomlParseException(`Duplicate key "${leaf}"${scope} (line ${line}).`);
        }
        node[leaf] = value;
    }

    /**
     * Parse a value string into its typed representation.
     *
     * @param raw - Trimmed value text.
     * @param line - Source line for error messages.
     * @param depth - Current nesting depth.
     * @returns Typed value (string, number, boolean, array, or object).
     * @throws {TomlParseException} When nesting exceeds the configured maximum.
     */
    private parseValue(raw: string, line: number, depth: number): unknown {
        if (depth > this.maxDepth) {
            throw new TomlParseException(
                `TOML nesting depth ${depth} exceeds maximum of ${this.maxDepth}.`,
            );
        }

        const value = raw.trim();

        // Multi-line basic string
        if (value.startsWith('"""') && value.endsWith('"""') && value.length >= 6) {
            return this.parseMultilineString(value.slice(3, -3), true);
        }
        // Multi-line literal string
        if (value.startsWith("'''") && value.endsWith("'''") && value.length >= 6) {
            return this.parseMultilineString(value.slice(3, -3), false);
        }
        // Basic string
        if (value.startsWith('"') && value.endsWith('"') && value.length >= 2) {
            return this.unescapeBasic(value.slice(1, -1));
        }
        // Literal string
        if (value.startsWith("'") && value.endsWith("'") && value.length >= 2) {
            return value.slice(1, -1);
        }
        // Inline array
        if (value.startsWith('[') && value.endsWith(']')) {
            return this.parseArray(value.slice(1, -1), line, depth + 1);
        }
        // Inline table
        if (value.startsWith('{') && value.endsWith('}')) {
            return this.parseInlineTable(value.slice(1, -1), line, depth + 1);
        }

        return this.castScalar(value, line);
    }

    /**
     * Parse the interior of an inline array (already stripped of brackets).
     *
     * @param inner - Text between the outer brackets.
     * @param line - Source line for error messages.
     * @param depth - Current nesting depth.
     * @returns Parsed array values.
     */
    private parseArray(inner: string, line: number, depth: number): unknown[] {
        const trimmed = inner.trim();
        if (trimmed === '') {
            return [];
        }
        return this.splitTopLevel(trimmed, ',').map((item) =>
            this.parseValue(item.trim(), line, depth),
        );
    }

    /**
     * Parse the interior of an inline table (already stripped of braces).
     *
     * @param inner - Text between the outer braces.
     * @param line - Source line for error messages.
     * @param depth - Current nesting depth.
     * @returns Parsed key-value pairs.
     * @throws {TomlParseException} When an entry lacks `=` or a key repeats.
     */
    private parseInlineTable(inner: string, line: number, depth: number): Record<string, unknown> {
        const result: Record<string, unknown> = {};
        const trimmed = inner.trim();
        if (trimmed === '') {
            return result;
        }
        for (const entry of this.splitTopLevel(trimmed, ',')) {
            const item = entry.trim();
            /* Stryker disable next-line ConditionalExpression,BlockStatement -- defensive: splitTopLevel already drops empty items */
            /* c8 ignore start */
            if (item === '') {
                continue;
            }
            /* c8 ignore stop */
            const eq = this.findAssignment(item);
            if (eq < 0) {
                throw new TomlParseException(
                    `Invalid inline table entry "${item}" (line ${line}).`,
                );
            }
            const keys = this.parseKeyPath(item.slice(0, eq).trim(), line);
            const value = this.parseValue(item.slice(eq + 1).trim(), line, depth);
            this.assign(result, keys, value, '', line);
        }
        return result;
    }

    /**
     * Split a string on a separator at bracket/brace depth zero and outside
     * of quoted regions.
     *
     * @param input - Text to split (array or inline-table interior).
     * @param sep - Single-character separator (`,`).
     * @returns Individual item strings (empty items dropped).
     */
    private splitTopLevel(input: string, sep: string): string[] {
        const items: string[] = [];
        let depth = 0;
        let current = '';
        let inStr = false;
        let quote = '';
        let triple = false;

        for (let i = 0; i < input.length; i++) {
            const ch = input[i] as string;

            if (inStr) {
                current += ch;
                if (triple) {
                    if (ch === quote && input.slice(i, i + 3) === quote.repeat(3)) {
                        current += input.slice(i + 1, i + 3);
                        i += 2;
                        inStr = false;
                        triple = false;
                    }
                } else if (ch === quote) {
                    inStr = false;
                }
                continue;
            }

            if (ch === '"' || ch === "'") {
                inStr = true;
                quote = ch;
                triple = input.slice(i, i + 3) === ch.repeat(3);
                if (triple) {
                    current += input.slice(i, i + 3);
                    i += 2;
                    continue;
                }
                current += ch;
                continue;
            }

            if (ch === '[' || ch === '{') {
                depth++;
            } else if (ch === ']' || ch === '}') {
                depth--;
            }

            if (ch === sep && depth === 0) {
                if (current.trim() !== '') {
                    items.push(current);
                }
                current = '';
                continue;
            }
            current += ch;
        }

        if (current.trim() !== '') {
            items.push(current);
        }
        return items;
    }

    /**
     * Parse a multi-line string body (delimiters already stripped).
     *
     * @param body - Text between the triple delimiters.
     * @param basic - True for `"""` (escapes applied), false for `'''` (literal).
     * @returns The assembled string.
     */
    private parseMultilineString(body: string, basic: boolean): string {
        // A newline immediately following the opening delimiter is trimmed.
        let text = body.startsWith('\n') ? body.slice(1) : body;
        if (!basic) {
            return text;
        }
        // Line-ending backslash trims the newline and leading whitespace.
        text = text.replace(/\\\n\s*/g, '');
        return this.unescapeBasic(text);
    }

    /**
     * Cast a bare (unquoted) scalar to its native type.
     *
     * @param value - Trimmed scalar text.
     * @param line - Source line for error messages.
     * @returns Typed value (boolean, number, or string).
     */
    private castScalar(value: string, line: number): unknown {
        if (value === '') {
            throw new TomlParseException(`Missing value (line ${line}).`);
        }

        // Boolean (TOML is strict: lowercase only).
        if (value === 'true') return true;
        if (value === 'false') return false;

        // Float special values.
        if (value === 'inf' || value === '+inf') return Infinity;
        if (value === '-inf') return -Infinity;
        if (value === 'nan' || value === '+nan' || value === '-nan') return NaN;

        // Integer with base prefixes.
        if (/^0x[0-9a-fA-F](?:[0-9a-fA-F_]*[0-9a-fA-F])?$/.test(value)) {
            return parseInt(value.slice(2).replace(/_/g, ''), 16);
        }
        if (/^0o[0-7](?:[0-7_]*[0-7])?$/.test(value)) {
            return parseInt(value.slice(2).replace(/_/g, ''), 8);
        }
        if (/^0b[01](?:[01_]*[01])?$/.test(value)) {
            return parseInt(value.slice(2).replace(/_/g, ''), 2);
        }

        // Decimal integer (optional sign, `_` between digits).
        if (/^[+-]?(?:0|[1-9](?:_?\d)*)$/.test(value)) {
            return parseInt(value.replace(/_/g, ''), 10);
        }

        // Float (fraction and/or exponent required to distinguish from int).
        if (
            /^[+-]?(?:0|[1-9](?:_?\d)*)(?:\.\d(?:_?\d)*)?(?:[eE][+-]?\d(?:_?\d)*)?$/.test(value) &&
            /[.eE]/.test(value)
        ) {
            return parseFloat(value.replace(/_/g, ''));
        }

        // Datetimes and everything else are preserved as their raw string,
        // matching the PHP implementation for parity.
        return value;
    }

    /**
     * Unescape TOML basic-string escape sequences, including `\uXXXX`.
     *
     * @param value - String content without surrounding quotes.
     * @returns Unescaped string.
     */
    private unescapeBasic(value: string): string {
        return value
            .replace(/\\u([0-9a-fA-F]{4})/g, (_m, hex: string) =>
                String.fromCharCode(parseInt(hex, 16)),
            )
            .replace(/\\U([0-9a-fA-F]{8})/g, (_m, hex: string) =>
                String.fromCodePoint(parseInt(hex, 16)),
            )
            .replace(/\\n/g, '\n')
            .replace(/\\t/g, '\t')
            .replace(/\\r/g, '\r')
            .replace(/\\"/g, '"')
            .replace(/\\b/g, '\b')
            .replace(/\\f/g, '\f')
            .replace(/\\\\/g, '\\');
    }

    /**
     * Strip a trailing `#` comment from a line, respecting quoted regions.
     *
     * @param line - Raw physical/logical line.
     * @returns Line with any inline comment removed.
     */
    private stripComment(line: string): string {
        let inStr = false;
        let quote = '';
        for (let i = 0; i < line.length; i++) {
            const ch = line[i];
            if (inStr) {
                if (ch === quote) {
                    inStr = false;
                }
                continue;
            }
            if (ch === '"' || ch === "'") {
                inStr = true;
                quote = ch as string;
                continue;
            }
            if (ch === '#') {
                return line.slice(0, i);
            }
        }
        return line;
    }
}
