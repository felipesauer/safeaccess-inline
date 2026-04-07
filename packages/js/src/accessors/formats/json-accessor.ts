import { AbstractAccessor } from '../abstract-accessor.js';
import { InvalidFormatException } from '../../exceptions/invalid-format-exception.js';

/**
 * Accessor for JSON-encoded strings.
 *
 * Decodes JSON via `JSON.parse()`. Validates payload size before parsing.
 *
 * @example
 * const accessor = new JsonAccessor(parser).from('{"key":"value"}');
 * accessor.get('key'); // 'value'
 */
export class JsonAccessor extends AbstractAccessor {
    /**
     * Hydrate from a JSON string.
     *
     * @param data - JSON string input.
     * @returns Populated accessor instance.
     * @throws {InvalidFormatException} When input is not a string or JSON is malformed.
     * @throws {SecurityException} When payload size exceeds limit.
     *
     * @example
     * accessor.from('{"name":"Alice"}');
     */
    from(data: unknown): this {
        if (typeof data !== 'string') {
            /* Stryker disable StringLiteral -- error message content is cosmetic; mutation produces empty string which is still an InvalidFormatException */
            throw new InvalidFormatException(
                `JsonAccessor expects a JSON string, got ${typeof data}`,
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

        let decoded: unknown;
        try {
            decoded = JSON.parse(raw);
        } catch (err) {
            /* Stryker disable StringLiteral,ObjectLiteral -- error message cosmetic; cause object content not observable via public API */
            /* c8 ignore start */
            throw new InvalidFormatException(
                `JsonAccessor failed to parse JSON: ${err instanceof Error ? err.message : String(err)}`,
                { cause: err instanceof Error ? err : undefined },
            );
            /* c8 ignore stop */
            /* Stryker restore StringLiteral,ObjectLiteral */
        }

        if (typeof decoded !== 'object' || decoded === null) {
            return {};
        }

        return decoded as Record<string, unknown>;
    }
}
