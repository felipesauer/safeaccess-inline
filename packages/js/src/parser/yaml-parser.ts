import { YamlParseException } from '../exceptions/yaml-parse-exception.js';

/**
 * Minimal YAML parser supporting a safe subset of YAML 1.2.
 *
 * Parses scalars, maps, sequences, and inline values. Blocks unsafe constructs:
 * tags (!! and !), anchors (&), aliases (*), and merge keys (<<).
 *
 * Does not depend on external YAML libraries, making the package portable.
 */
export class YamlParser {
    /**
     * Parse a YAML string into a plain object.
     *
     * @param yaml - Raw YAML content.
     * @returns Parsed data structure.
     * @throws {YamlParseException} When unsafe constructs or syntax errors are found.
     *
     * @example
     * new YamlParser().parse('key: value'); // { key: 'value' }
     */
    parse(yaml: string): Record<string, unknown> {
        const lines = yaml.replace(/\r\n/g, '\n').split('\n');
        this.assertNoUnsafeConstructs(lines);
        const result = this.parseLines(lines, 0, 0, lines.length);
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

            if (/(?:^|\s)&\w+/.test(trimmed)) {
                throw new YamlParseException(`YAML anchors are not supported (line ${i + 1}).`);
            }

            if (/(?:^|\s)\*\w+/.test(trimmed)) {
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
     * @returns Parsed value.
     */
    private parseLines(lines: string[], baseIndent: number, start: number, end: number): unknown {
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
                    );
                    this.mergeChildLines(lines, i + 1, childEnd, childIndent, subMap);
                    arrResult.push(subMap);
                    i = childEnd;
                } else if (itemContent === '') {
                    const childIndent = currentIndent + 2;
                    const childEnd = this.findBlockEnd(lines, childIndent, i + 1, end);
                    if (childEnd > i + 1) {
                        arrResult.push(this.parseLines(lines, childIndent, i + 1, childEnd));
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
                mapResult[key] = this.resolveValue(rawValue, lines, i, childIndent, childEnd);
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
     */
    private mergeChildLines(
        lines: string[],
        start: number,
        end: number,
        childIndent: number,
        map: Record<string, unknown>,
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
     * @returns Resolved typed value.
     */
    private resolveValue(
        rawValue: string,
        lines: string[],
        lineIndex: number,
        childIndent: number,
        childEnd: number,
    ): unknown {
        const trimmed = rawValue.trim();

        // Block scalar literal (|) or folded (>)
        if (trimmed === '|' || trimmed === '>') {
            return this.parseBlockScalar(
                lines,
                lineIndex + 1,
                childEnd,
                childIndent,
                trimmed === '>',
            );
        }

        // Inline flow (array or map) starting with [ or {
        if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
            return this.parseInlineFlow(trimmed);
        }

        // Nested block
        if (trimmed === '' && childEnd > lineIndex + 1) {
            return this.parseLines(lines, childIndent, lineIndex + 1, childEnd);
        }

        return this.castScalar(trimmed);
    }

    /**
     * Parse a YAML block scalar (literal | or folded >).
     *
     * @param lines - All lines of the YAML document.
     * @param start - First line of the scalar block (inclusive).
     * @param end - Last line of the scalar block (exclusive).
     * @param indent - Minimum indentation for scalar lines.
     * @param folded - Whether to fold lines (> style) or keep literal (| style).
     * @returns The assembled string.
     */
    private parseBlockScalar(
        lines: string[],
        start: number,
        end: number,
        indent: number,
        folded: boolean,
    ): string {
        const parts: string[] = [];
        for (let i = start; i < end; i++) {
            const line = lines[i] as string;
            const trimmed = line.trimStart();
            const lineIndent = line.length - trimmed.length;
            if (lineIndent >= indent || trimmed === '') {
                parts.push(trimmed);
            }
        }

        if (folded) {
            return parts.join(' ').trim();
        }

        return parts.join('\n').trimEnd();
    }

    /**
     * Parse an inline flow collection (JSON-like array or object).
     *
     * @param raw - Raw inline flow string.
     * @returns Parsed value or the raw string if parsing fails.
     */
    private parseInlineFlow(raw: string): unknown {
        try {
            // Convert YAML flow to JSON by single-quoting to double-quoting
            const jsonLike = raw.replace(/'/g, '"').replace(/(\w+)\s*:/g, '"$1":');
            return JSON.parse(jsonLike);
        } catch {
            // Fallback: return raw string
            return raw;
        }
    }

    /**
     * Cast a scalar string to its native type.
     *
     * @param value - Raw scalar string.
     * @returns Typed value (null, boolean, number, or string).
     */
    private castScalar(value: string): unknown {
        if (value === '' || value === 'null' || value === '~') return null;
        if (value === 'true') return true;
        if (value === 'false') return false;

        // Quoted string
        if (
            (value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))
        ) {
            return value.slice(1, -1);
        }

        // Integer
        if (/^-?\d+$/.test(value)) return parseInt(value, 10);

        // Float
        if (/^-?\d+\.\d+$/.test(value)) return parseFloat(value);

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
