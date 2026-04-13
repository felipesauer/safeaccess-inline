import { YamlParseException } from '../exceptions/yaml-parse-exception.js';

/**
 * Minimal YAML parser supporting a safe subset of YAML 1.2.
 *
 * Parses scalars, maps, sequences, and inline values. Blocks unsafe constructs:
 * tags (!! and !), anchors (&), aliases (*), and merge keys (<<).
 *
 * Does not depend on external YAML libraries, making the package portable.
 *
 * @internal
 */
export class YamlParser {
    private readonly maxDepth: number;

    /**
     * @param maxDepth - Maximum allowed nesting depth during parsing.
     *   Defaults to 512 to match SecurityParser.maxDepth.
     */
    constructor(maxDepth: number = 512) {
        this.maxDepth = maxDepth;
    }

    /**
     * Parse a YAML string into a plain object.
     *
     * @param yaml - Raw YAML content.
     * @returns Parsed data structure.
     * @throws {YamlParseException} When unsafe constructs, syntax errors, or nesting depth exceeded.
     *
     * @example
     * new YamlParser().parse('key: value'); // { key: 'value' }
     */
    parse(yaml: string): Record<string, unknown> {
        const lines = yaml.replace(/\r\n/g, '\n').split('\n');
        this.assertNoUnsafeConstructs(lines);
        const result = this.parseLines(lines, 0, 0, lines.length, 0);
        if (Array.isArray(result)) {
            return {};
        }
        return result as Record<string, unknown>;
    }

    /**
     * Reject YAML constructs that are unsafe or unsupported.
     *
     * @param lines - Raw YAML lines to scan.
     * @throws {YamlParseException} When tags, anchors, aliases, or merge keys are found.
     */
    private assertNoUnsafeConstructs(lines: string[]): void {
        for (const [i, rawLine] of lines.entries()) {
            const trimmed = rawLine.trimStart();

            if (trimmed === '' || trimmed.startsWith('#')) {
                continue;
            }

            // Block !! and ! tags (but not inside quotes)
            if (/(?<!['"!])!{1,2}[\w</]/.test(trimmed)) {
                throw new YamlParseException(
                    `Unsupported YAML tag at line ${i + 1}: tags (! and !! syntax) are not supported.`,
                );
            }

            if (/(?:^|\s)&[\w-]+/.test(trimmed)) {
                throw new YamlParseException(`YAML anchors are not supported (line ${i + 1}).`);
            }

            if (/(?:^|\s)\*[\w-]+/.test(trimmed)) {
                throw new YamlParseException(`YAML aliases are not supported (line ${i + 1}).`);
            }

            if (/^(\s*)<<\s*:/.test(rawLine)) {
                throw new YamlParseException(
                    `YAML merge keys (<<) are not supported (line ${i + 1}).`,
                );
            }
        }
    }

    /**
     * Parse a range of lines into a YAML value (map, sequence, or scalar).
     *
     * @param lines - All lines of the YAML document.
     * @param baseIndent - Indentation level for this block.
     * @param start - First line index (inclusive).
     * @param end - Last line index (exclusive).
     * @param depth - Current nesting depth.
     * @returns Parsed value.
     *
     * @throws {YamlParseException} When nesting depth exceeds the configured maximum.
     */
    private parseLines(
        lines: string[],
        baseIndent: number,
        start: number,
        end: number,
        depth: number = 0,
    ): unknown {
        if (depth > this.maxDepth) {
            throw new YamlParseException(
                `YAML nesting depth ${depth} exceeds maximum of ${this.maxDepth}.`,
            );
        }
        const mapResult: Record<string, unknown> = {};
        const arrResult: unknown[] = [];
        let isSequence = false;
        let i = start;

        while (i < end) {
            const line = lines[i] as string;
            const trimmed = line.trimStart();

            if (trimmed === '' || trimmed.startsWith('#')) {
                i++;
                continue;
            }

            const currentIndent = line.length - trimmed.length;

            /* c8 ignore start */
            if (currentIndent < baseIndent) {
                break;
            }
            /* c8 ignore stop */

            if (currentIndent > baseIndent) {
                i++;
                continue;
            }

            // Sequence item
            if (trimmed.startsWith('- ') || trimmed === '-') {
                isSequence = true;
                const itemContent = trimmed === '-' ? '' : trimmed.slice(2).trim();

                const match =
                    itemContent !== '' ? /^([^\s:][^:]*?)\s*:\s*(.*)$/.exec(itemContent) : null;
                if (match !== null) {
                    const childIndent = currentIndent + 2;
                    const childEnd = this.findBlockEnd(lines, childIndent, i + 1, end);
                    const subMap: Record<string, unknown> = {};
                    subMap[match[1] as string] = this.resolveValue(
                        match[2] as string,
                        lines,
                        i,
                        childIndent,
                        childEnd,
                        depth,
                    );
                    this.mergeChildLines(lines, i + 1, childEnd, childIndent, subMap, depth);
                    arrResult.push(subMap);
                    i = childEnd;
                } else if (itemContent === '') {
                    const childIndent = currentIndent + 2;
                    const childEnd = this.findBlockEnd(lines, childIndent, i + 1, end);
                    if (childEnd > i + 1) {
                        arrResult.push(
                            this.parseLines(lines, childIndent, i + 1, childEnd, depth + 1),
                        );
                        i = childEnd;
                    } else {
                        arrResult.push(null);
                        i++;
                    }
                } else {
                    arrResult.push(this.castScalar(itemContent));
                    i++;
                }
                continue;
            }

            // Map key: value
            const mapMatch = /^([^\s:][^:]*?)\s*:\s*(.*)$/.exec(trimmed);
            if (mapMatch !== null) {
                const key = mapMatch[1] as string;
                const rawValue = mapMatch[2] as string;
                const childIndent = currentIndent + 2;
                const childEnd = this.findBlockEnd(lines, childIndent, i + 1, end);
                mapResult[key] = this.resolveValue(
                    rawValue,
                    lines,
                    i,
                    childIndent,
                    childEnd,
                    depth,
                );
                i = childEnd;
                continue;
            }

            i++;
        }

        if (isSequence) {
            return arrResult;
        }

        return mapResult;
    }

    /**
     * Merge child key-value lines into an existing map.
     *
     * @param lines - All lines of the YAML document.
     * @param start - First child line index (inclusive).
     * @param end - Last child line index (exclusive).
     * @param childIndent - Expected indentation for child lines.
     * @param map - Map to merge values into.
     * @param depth - Current nesting depth.
     * @throws {YamlParseException} When resolved values exceed the configured nesting depth.
     */
    private mergeChildLines(
        lines: string[],
        start: number,
        end: number,
        childIndent: number,
        map: Record<string, unknown>,
        depth: number,
    ): void {
        let ci = start;
        while (ci < end) {
            const childLine = lines[ci] as string;
            const childTrimmed = childLine.trimStart();

            if (childTrimmed === '' || childTrimmed.startsWith('#')) {
                ci++;
                continue;
            }

            const childCurrentIndent = childLine.length - childTrimmed.length;

            if (childCurrentIndent === childIndent) {
                const cm = /^([^\s:][^:]*?)\s*:\s*(.*)$/.exec(childTrimmed);
                if (cm !== null) {
                    const nextChildEnd = this.findBlockEnd(
                        lines,
                        childCurrentIndent + 2,
                        ci + 1,
                        end,
                    );
                    map[cm[1] as string] = this.resolveValue(
                        cm[2] as string,
                        lines,
                        ci,
                        childCurrentIndent + 2,
                        nextChildEnd,
                        depth,
                    );
                    ci = nextChildEnd;
                    continue;
                }
            }

            ci++;
        }
    }

    /**
     * Resolve a raw value string into a typed value.
     *
     * @param rawValue - The value portion after the colon.
     * @param lines - All lines of the YAML document.
     * @param lineIndex - Line where the value was found.
     * @param childIndent - Expected indentation for child block.
     * @param childEnd - End index of the child block.
     * @param depth - Current nesting depth.
     * @returns Resolved typed value.
     * @throws {YamlParseException} When child block nesting exceeds the configured maximum.
     */
    private resolveValue(
        rawValue: string,
        lines: string[],
        lineIndex: number,
        childIndent: number,
        childEnd: number,
        depth: number = 0,
    ): unknown {
        const trimmed = this.stripInlineComment(rawValue.trim());

        // Block scalar literal (|, |-,  |+) or folded (>, >-, >+)
        if (/^\|[+-]?$/.test(trimmed) || /^>[+-]?$/.test(trimmed)) {
            return this.parseBlockScalar(
                lines,
                lineIndex + 1,
                childEnd,
                childIndent,
                trimmed.startsWith('>'),
                trimmed,
            );
        }

        // Inline flow sequence [a, b, c]
        if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
            return this.parseFlowSequence(trimmed);
        }

        // Inline flow map {a: b, c: d}
        if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
            return this.parseFlowMap(trimmed);
        }

        // Nested block
        if (trimmed === '' && childEnd > lineIndex + 1) {
            return this.parseLines(lines, childIndent, lineIndex + 1, childEnd, depth + 1);
        }

        return this.castScalar(trimmed);
    }

    /**
     * Parse a YAML block scalar (literal | or folded >) with chomping modifiers.
     *
     * @param lines - All lines of the YAML document.
     * @param start - First line of the scalar block (inclusive).
     * @param end - Last line of the scalar block (exclusive).
     * @param indent - Expected minimum indentation for scalar lines.
     * @param folded - Whether to fold lines (> style) or keep literal (| style).
     * @param chomping - Chomping indicator (|, |-, |+, >, >-, >+).
     * @returns The assembled string.
     */
    private parseBlockScalar(
        lines: string[],
        start: number,
        end: number,
        indent: number,
        folded: boolean,
        chomping: string = '|',
    ): string {
        const blockLines: string[] = [];
        let actualIndent: number | null = null;

        for (let i = start; i < end; i++) {
            const line = lines[i] as string;

            if (line.trim() === '') {
                blockLines.push('');
                continue;
            }

            const lineIndent = line.length - line.trimStart().length;
            if (actualIndent === null) {
                actualIndent = lineIndent;
            }

            if (lineIndent < actualIndent) {
                break;
            }

            blockLines.push(line.substring(actualIndent));
        }

        // Remove trailing empty lines for clip (default) and strip (-) modes.
        // Keep (+) mode preserves all trailing blank lines.
        if (!chomping.endsWith('+')) {
            while (blockLines.length > 0 && blockLines[blockLines.length - 1] === '') {
                blockLines.pop();
            }
        }

        let result: string;
        if (folded) {
            result = '';
            let prevEmpty = false;
            for (const bl of blockLines) {
                if (bl === '') {
                    result += '\n';
                    prevEmpty = true;
                } else {
                    if (result !== '' && !prevEmpty && !result.endsWith('\n')) {
                        result += ' ';
                    }
                    result += bl;
                    prevEmpty = false;
                }
            }
        } else {
            result = blockLines.join('\n');
        }

        // Default YAML chomping: add trailing newline unless strip (-)
        if (!chomping.endsWith('-') && !result.endsWith('\n')) {
            result += '\n';
        }

        return result;
    }

    /**
     * Parse a YAML flow sequence ([a, b, c]) into an array.
     *
     * @param value - Raw flow sequence string including brackets.
     * @returns Parsed sequence values.
     */
    private parseFlowSequence(value: string): unknown[] {
        const inner = value.slice(1, -1).trim();
        if (inner === '') {
            return [];
        }

        const items = this.splitFlowItems(inner);
        return items.map((item) => this.castScalar(item.trim()));
    }

    /**
     * Parse a YAML flow map ({a: b, c: d}) into a record.
     *
     * @param value - Raw flow map string including braces.
     * @returns Parsed key-value pairs.
     */
    private parseFlowMap(value: string): Record<string, unknown> {
        const inner = value.slice(1, -1).trim();
        if (inner === '') {
            return {};
        }

        const result: Record<string, unknown> = {};
        const items = this.splitFlowItems(inner);
        for (const item of items) {
            const trimmedItem = item.trim();
            const colonPos = trimmedItem.indexOf(':');
            if (colonPos === -1) {
                continue;
            }
            const key = trimmedItem.substring(0, colonPos).trim();
            const val = trimmedItem.substring(colonPos + 1).trim();
            result[key] = this.castScalar(val);
        }

        return result;
    }

    /**
     * Split flow-syntax items by comma, respecting nested brackets and quotes.
     *
     * @param inner - Content between outer brackets/braces.
     * @returns Individual item strings.
     */
    private splitFlowItems(inner: string): string[] {
        const items: string[] = [];
        let depth = 0;
        let current = '';
        let inQuote = false;
        let quoteChar = '';

        for (let i = 0; i < inner.length; i++) {
            const ch = inner[i] as string;

            if (inQuote) {
                current += ch;
                if (ch === quoteChar) {
                    inQuote = false;
                }
                continue;
            }

            if (ch === '"' || ch === "'") {
                inQuote = true;
                quoteChar = ch;
                current += ch;
                continue;
            }

            if (ch === '[' || ch === '{') {
                depth++;
                current += ch;
                continue;
            }

            if (ch === ']' || ch === '}') {
                depth--;
                current += ch;
                continue;
            }

            if (ch === ',' && depth === 0) {
                items.push(current);
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
     * Cast a scalar string to its native type.
     *
     * Handles quoted strings, null, boolean, integer (decimal/octal/hex),
     * float, infinity, and NaN values.
     *
     * @param value - Raw scalar string.
     * @returns Typed value (null, boolean, number, or string).
     */
    private castScalar(value: string): unknown {
        value = value.trim();

        // Quoted strings
        if (value.length >= 2) {
            if (value.startsWith('"') && value.endsWith('"')) {
                return this.unescapeDoubleQuoted(value.slice(1, -1));
            }
            if (value.startsWith("'") && value.endsWith("'")) {
                return value.slice(1, -1).replace(/''/g, "'");
            }
        }

        // Null
        if (
            value === '' ||
            value === '~' ||
            value === 'null' ||
            value === 'Null' ||
            value === 'NULL'
        ) {
            return null;
        }

        // Boolean
        const lower = value.toLowerCase();
        if (lower === 'true' || lower === 'yes' || lower === 'on') return true;
        if (lower === 'false' || lower === 'no' || lower === 'off') return false;

        // Integer patterns
        if (/^-?(?:0|[1-9]\d*)$/.test(value)) return parseInt(value, 10);
        if (/^0o[0-7]+$/i.test(value)) return parseInt(value.slice(2), 8);
        if (/^0x[0-9a-fA-F]+$/.test(value)) return parseInt(value, 16);

        // Float patterns
        if (/^-?(?:0|[1-9]\d*)?(?:\.\d+)?(?:[eE][+-]?\d+)?$/.test(value) && value.includes('.')) {
            return parseFloat(value);
        }
        if (lower === '.inf' || lower === '+.inf') return Infinity;
        if (lower === '-.inf') return -Infinity;
        if (lower === '.nan') return NaN;

        return value;
    }

    /**
     * Unescape YAML double-quoted string escape sequences.
     *
     * @param value - String content between double quotes.
     * @returns Unescaped string.
     */
    private unescapeDoubleQuoted(value: string): string {
        return value
            .replace(/\\n/g, '\n')
            .replace(/\\t/g, '\t')
            .replace(/\\r/g, '\r')
            .replace(/\\\\/g, '\\')
            .replace(/\\"/g, '"')
            .replace(/\\0/g, '\0')
            .replace(/\\a/g, '\x07')
            .replace(/\\b/g, '\x08')
            .replace(/\\f/g, '\x0C')
            .replace(/\\v/g, '\x0B');
    }

    /**
     * Strip inline comments from a value string, respecting quoted regions.
     *
     * @param value - Raw value potentially containing inline comments.
     * @returns Value with inline comments removed.
     */
    private stripInlineComment(value: string): string {
        value = value.trim();
        if (value === '') {
            return '';
        }

        // Don't strip from quoted strings
        if (value[0] === '"' || value[0] === "'") {
            const closePos = value.indexOf(value[0], 1);
            if (closePos !== -1) {
                const afterQuote = value.substring(closePos + 1).trim();
                if (afterQuote === '' || afterQuote[0] === '#') {
                    return value.substring(0, closePos + 1);
                }
            }
        }

        // Strip # comments (but not inside strings)
        let inSingle = false;
        let inDouble = false;
        for (let i = 0; i < value.length; i++) {
            const ch = value[i];
            if (ch === "'" && !inDouble) {
                inSingle = !inSingle;
            } else if (ch === '"' && !inSingle) {
                inDouble = !inDouble;
            } else if (ch === '#' && !inSingle && !inDouble && i > 0 && value[i - 1] === ' ') {
                return value.substring(0, i).trim();
            }
        }

        return value;
    }

    /**
     * Find where a child block ends based on indentation.
     *
     * @param lines - All lines of the YAML document.
     * @param minIndent - Minimum indentation to remain in the block.
     * @param start - First line to check (inclusive).
     * @param end - Hard end boundary (exclusive).
     * @returns Index of the first line outside the block.
     */
    private findBlockEnd(lines: string[], minIndent: number, start: number, end: number): number {
        for (let i = start; i < end; i++) {
            const line = lines[i] as string;
            const trimmed = line.trimStart();

            if (trimmed === '' || trimmed.startsWith('#')) {
                continue;
            }

            const lineIndent = line.length - trimmed.length;

            if (lineIndent < minIndent) {
                return i;
            }
        }

        return end;
    }
}
