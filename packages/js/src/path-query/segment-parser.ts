import type { FilterEvaluatorInterface } from '../contracts/filter-evaluator-interface.js';
import { InvalidFormatException } from '../exceptions/invalid-format-exception.js';
import { SegmentType } from './segment-type.js';
import type { Segment } from './segment-type.js';

/**
 * Parse dot-notation path strings into typed segment arrays.
 *
 * Converts path expressions (e.g. "users[0].address..city") into ordered
 * segment arrays with {@link SegmentType} metadata for resolution by
 * {@link SegmentPathResolver}. Supports key, index, wildcard, descent,
 * multi-key/index, filter, slice, and projection segment types.
 *
 * @internal
 *
 * @see SegmentType          Enum of all segment types produced.
 * @see SegmentPathResolver  Consumer that resolves segments against data.
 * @see FilterEvaluatorInterface  Delegate for filter expression parsing.
 */
export class SegmentParser {
    /**
     * Create a segment parser with a filter evaluator.
     *
     * @param segmentFilterParser - Delegate for [?filter] parsing.
     */
    constructor(private readonly segmentFilterParser: FilterEvaluatorInterface) {}

    /**
     * Parse a dot-notation path into an ordered array of typed segments.
     *
     * @param path - Dot-notation path expression.
     * @returns Typed segment array.
     *
     * @throws {InvalidFormatException} When slice step is zero.
     */
    parseSegments(path: string): Segment[] {
        const segments: Segment[] = [];
        const len = path.length;
        const pos = { i: 0 };

        if (path[0] === '$') {
            pos.i = 1;
            if (path[pos.i] === '.') {
                pos.i++;
            }
        }

        while (pos.i < len) {
            if (path[pos.i] === '.') {
                if (path[pos.i + 1] === '.') {
                    pos.i += 2;
                    segments.push(this.parseDescent(path, pos, len));
                    continue;
                }
                pos.i++;
                const segment = this.parseProjection(path, pos, len);
                if (segment !== null) {
                    segments.push(segment);
                }
                continue;
            }

            if (path[pos.i] === '[' && path[pos.i + 1] === '?') {
                segments.push(this.parseFilter(path, pos, len));
                continue;
            }

            if (path[pos.i] === '[') {
                segments.push(this.parseBracket(path, pos, len));
                continue;
            }

            if (path[pos.i] === '*') {
                segments.push({ type: SegmentType.Wildcard });
                pos.i++;
                continue;
            }

            segments.push(this.parseKey(path, pos, len));
        }

        return segments;
    }

    /**
     * Parse a recursive descent segment (`..key` or `..[...]`).
     *
     * @param path - Full path string.
     * @param pos - Current position (mutated in place).
     * @param len - Total path length.
     * @returns Parsed descent segment.
     */
    private parseDescent(path: string, pos: { i: number }, len: number): Segment {
        if (path[pos.i] === '[') {
            let j = pos.i + 1;
            while (j < len && path[j] !== ']') {
                j++;
            }

            const inner = path.substring(pos.i + 1, j);
            pos.i = j + 1;

            if (inner.includes(',') && this.allQuoted(inner.split(','))) {
                const parts = inner.split(',').map((p) => p.trim());
                const keys = parts.map((p) => p.substring(1, p.length - 1));
                return { type: SegmentType.DescentMulti, keys };
            }

            const quotedMatch = inner.match(/^(['"])(.*?)\1$/);
            if (quotedMatch) {
                return { type: SegmentType.Descent, key: quotedMatch[2] };
            }

            return { type: SegmentType.Descent, key: inner };
        }

        let key = '';
        while (pos.i < len && path[pos.i] !== '.' && path[pos.i] !== '[') {
            if (path[pos.i] === '\\' && path[pos.i + 1] === '.') {
                key += '.';
                pos.i += 2;
            } else {
                key += path[pos.i];
                pos.i++;
            }
        }

        return { type: SegmentType.Descent, key };
    }

    /**
     * Parse a projection segment (`.{field1, field2}` or `.{alias: field}`).
     *
     * @param path - Full path string.
     * @param pos - Current position (mutated in place).
     * @param len - Total path length.
     * @returns Parsed projection segment, or null if not a projection.
     */
    private parseProjection(path: string, pos: { i: number }, len: number): Segment | null {
        if (path[pos.i] !== '{') {
            return null;
        }

        let j = pos.i + 1;
        while (j < len && path[j] !== '}') {
            j++;
        }
        const inner = path.substring(pos.i + 1, j);
        pos.i = j + 1;

        const fields: Array<{ alias: string; source: string }> = [];
        for (const entry of inner
            .split(',')
            .map((e) => e.trim())
            .filter((e) => e !== '')) {
            const colonIdx = entry.indexOf(':');
            if (colonIdx !== -1) {
                fields.push({
                    alias: entry.substring(0, colonIdx).trim(),
                    source: entry.substring(colonIdx + 1).trim(),
                });
            } else {
                fields.push({ alias: entry, source: entry });
            }
        }

        return { type: SegmentType.Projection, fields };
    }

    /**
     * Parse a filter segment (`[?expression]`).
     *
     * @param path - Full path string.
     * @param pos - Current position (mutated in place).
     * @param len - Total path length.
     * @returns Parsed filter segment.
     */
    private parseFilter(path: string, pos: { i: number }, len: number): Segment {
        let depth = 1;
        let j = pos.i + 1;
        while (j < len && depth > 0) {
            j++;
            if (path[j] === '[') {
                depth++;
            }
            if (path[j] === ']') {
                depth--;
            }
        }
        const filterExpr = path.substring(pos.i + 2, j);
        pos.i = j + 1;

        return { type: SegmentType.Filter, expression: this.segmentFilterParser.parse(filterExpr) };
    }

    /**
     * Parse a bracket segment (`[0]`, `[0,1,2]`, `[0:5]`, `['key']`, `[*]`).
     *
     * @param path - Full path string.
     * @param pos - Current position (mutated in place).
     * @param len - Total path length.
     * @returns Parsed bracket segment.
     *
     * @throws {InvalidFormatException} When slice step is zero.
     */
    private parseBracket(path: string, pos: { i: number }, len: number): Segment {
        let j = pos.i + 1;
        while (j < len && path[j] !== ']') {
            j++;
        }
        const inner = path.substring(pos.i + 1, j);
        pos.i = j + 1;

        if (inner.includes(',')) {
            const parts = inner.split(',').map((p) => p.trim());

            if (this.allQuoted(parts)) {
                const keys = parts.map((p) => p.substring(1, p.length - 1));
                return { type: SegmentType.MultiKey, keys };
            }

            let allNumeric = true;
            for (const p of parts) {
                if (isNaN(Number(p.trim())) || p.trim() === '') {
                    allNumeric = false;
                    break;
                }
            }
            if (allNumeric) {
                return { type: SegmentType.MultiIndex, indices: parts.map((p) => parseInt(p, 10)) };
            }
        }

        const quotedMatch = inner.match(/^(['"])(.*?)\1$/);
        if (quotedMatch) {
            return { type: SegmentType.Key, value: quotedMatch[2] };
        }

        if (inner.includes(':')) {
            const sliceParts = inner.split(':');
            const start = sliceParts[0] !== '' ? parseInt(sliceParts[0], 10) : null;
            const end =
                sliceParts.length > 1 && sliceParts[1] !== '' ? parseInt(sliceParts[1], 10) : null;
            const rawStep =
                sliceParts.length > 2 && sliceParts[2] !== '' ? parseInt(sliceParts[2], 10) : null;
            if (rawStep === 0) {
                throw new InvalidFormatException('Slice step cannot be zero.');
            }
            return { type: SegmentType.Slice, start, end, step: rawStep };
        }

        if (inner === '*') {
            return { type: SegmentType.Wildcard };
        }

        return { type: SegmentType.Key, value: inner };
    }

    /**
     * Parse a regular dot-separated key with escaped-dot support.
     *
     * @param path - Full path string.
     * @param pos - Current position (mutated in place).
     * @param len - Total path length.
     * @returns Parsed key segment.
     */
    private parseKey(path: string, pos: { i: number }, len: number): Segment {
        let key = '';
        while (pos.i < len && path[pos.i] !== '.' && path[pos.i] !== '[') {
            if (path[pos.i] === '\\' && path[pos.i + 1] === '.') {
                key += '.';
                pos.i += 2;
            } else {
                key += path[pos.i];
                pos.i++;
            }
        }

        return { type: SegmentType.Key, value: key };
    }

    /**
     * Check if all parts in a comma-separated list are quoted strings.
     *
     * @param parts - Raw parts from split.
     * @returns True if every part is single- or double-quoted.
     */
    private allQuoted(parts: string[]): boolean {
        for (const raw of parts) {
            const p = raw.trim();
            if (
                !(p.startsWith("'") && p.endsWith("'")) &&
                !(p.startsWith('"') && p.endsWith('"'))
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
     * segments - used for set/remove operations via {@link DotNotationParser}.
     *
     * @param path - Simple dot-notation path.
     * @returns Ordered list of key strings.
     */
    parseKeys(path: string): string[] {
        let normalized = path.replace(/\[([^\]]+)\]/g, '.$1');

        const placeholder = '\x00ESC_DOT\x00';
        normalized = normalized.replace(/\\\./g, placeholder);
        const keys = normalized.split('.');

        return keys.map((k) =>
            k.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), '.'),
        );
    }
}
