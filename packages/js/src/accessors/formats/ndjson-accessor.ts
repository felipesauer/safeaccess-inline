import { AbstractAccessor } from '../abstract-accessor.js';
import { InvalidFormatException } from '../../exceptions/invalid-format-exception.js';

/**
 * Accessor for Newline-Delimited JSON (NDJSON) strings.
 *
 * Parses each non-empty line as a standalone JSON object,
 * producing an indexed record of parsed entries.
 *
 * @example
 * const ndjson = '{"id":1}\n{"id":2}';
 * const accessor = new NdjsonAccessor(parser).from(ndjson);
 * accessor.get('0.id'); // 1
 */
export class NdjsonAccessor extends AbstractAccessor {
    /**
     * Hydrate from an NDJSON string.
     *
     * @param data - NDJSON string input.
     * @returns Populated accessor instance.
     * @throws {InvalidFormatException} When input is not a string or any line is malformed.
     * @throws {SecurityException} When payload size exceeds limit.
     *
     * @example
     * accessor.from('{"name":"Alice"}\n{"name":"Bob"}');
     */
    from(data: unknown): this {
        if (typeof data !== 'string') {
            /* Stryker disable StringLiteral -- error message content is cosmetic */
            throw new InvalidFormatException(
                `NdjsonAccessor expects an NDJSON string, got ${typeof data}`,
            );
            /* Stryker restore StringLiteral */
        }

        return this.ingest(data);
    }

    /** {@inheritDoc} */
    protected parse(raw: unknown): Record<string, unknown> {
        /* Stryker disable next-line ConditionalExpression,BlockStatement,StringLiteral -- unreachable: from() always validates string before ingest() */
        /* c8 ignore start */
        if (typeof raw !== 'string') {
            return {};
        }
        /* c8 ignore stop */

        const result: Record<string, unknown> = {};
        const allLines = raw.split('\n');
        const nonEmptyLines: Array<{ line: string; originalLine: number }> = [];

        /* Stryker disable next-line EqualityOperator -- equivalent: extra undefined allLines[length] entry is safely handled by ?? '' */
        for (let idx = 0; idx < allLines.length; idx++) {
            /* Stryker disable next-line StringLiteral -- NoCoverage: allLines[idx] is always defined within valid loop bounds */
            /* c8 ignore next */
            const trimmed = (allLines[idx] ?? '').trim();
            if (trimmed !== '') {
                nonEmptyLines.push({ line: trimmed, originalLine: idx + 1 });
            }
        }

        /* Stryker disable next-line ConditionalExpression,BlockStatement -- equivalent: empty nonEmptyLines causes loop to run 0 iterations and returns {} naturally */
        if (nonEmptyLines.length === 0) {
            return {};
        }

        for (let i = 0; i < nonEmptyLines.length; i++) {
            const entry = nonEmptyLines[i]!;
            let decoded: unknown;
            try {
                decoded = JSON.parse(entry.line);
            } catch {
                throw new InvalidFormatException(
                    `NdjsonAccessor failed to parse line ${entry.originalLine}: ${entry.line}`,
                );
            }
            result[String(i)] = decoded;
        }

        return result;
    }
}
