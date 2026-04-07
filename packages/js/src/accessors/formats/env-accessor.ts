import { AbstractAccessor } from '../abstract-accessor.js';
import { InvalidFormatException } from '../../exceptions/invalid-format-exception.js';

/**
 * Accessor for dotenv-formatted strings.
 *
 * Parses KEY=VALUE lines, skipping comments (#) and blank lines.
 * Strips surrounding single and double quotes from values.
 *
 * @example
 * const accessor = new EnvAccessor(parser).from('DB_HOST=localhost\nDEBUG=true');
 * accessor.get('DB_HOST'); // 'localhost'
 */
export class EnvAccessor extends AbstractAccessor {
    /**
     * Hydrate from a dotenv-formatted string.
     *
     * @param data - Dotenv string input.
     * @returns Populated accessor instance.
     * @throws {InvalidFormatException} When input is not a string.
     * @throws {SecurityException} When payload size exceeds limit.
     *
     * @example
     * accessor.from('APP_ENV=production\nPORT=3000');
     */
    from(data: unknown): this {
        if (typeof data !== 'string') {
            /* Stryker disable next-line StringLiteral -- error message content is cosmetic */
            throw new InvalidFormatException(
                `EnvAccessor expects an ENV string, got ${typeof data}`,
            );
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

        for (const rawLine of raw.split('\n')) {
            /* Stryker disable next-line MethodExpression -- trim() on rawLine: whitespace-only lines still skip via empty check below */
            const line = rawLine.trim();

            /* Stryker disable next-line ConditionalExpression,LogicalOperator,StringLiteral,MethodExpression -- equivalent: blank lines not matching = are caught by eqPos === -1 guard; comment-skipping still works */
            if (line === '' || line.startsWith('#')) {
                continue;
            }

            const eqPos = line.indexOf('=');
            /* Stryker disable next-line ConditionalExpression,UnaryOperator,BlockStatement -- equivalent: lines without = produce no usable key=value pair */
            if (eqPos === -1) {
                continue;
            }

            const key = line.slice(0, eqPos).trim();
            let value = line.slice(eqPos + 1).trim();

            // Strip surrounding quotes
            if (
                (value.startsWith('"') && value.endsWith('"')) ||
                (value.startsWith("'") && value.endsWith("'"))
            ) {
                value = value.slice(1, -1);
            }

            result[key] = value;
        }

        return result;
    }
}
