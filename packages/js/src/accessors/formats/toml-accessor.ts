import { AbstractAccessor } from '../abstract-accessor.js';
import { InvalidFormatException } from '../../exceptions/invalid-format-exception.js';
import { TomlParser } from '../../parser/toml-parser.js';

/**
 * Accessor for TOML-encoded strings.
 *
 * Uses the internal TomlParser for safe TOML parsing without depending on
 * external TOML libraries. Duplicate keys, redefined tables, and nesting
 * beyond the configured depth are rejected as unsafe or malformed.
 *
 * @api
 *
 * @example
 * const accessor = new TomlAccessor(parser).from('[server]\nhost = "0.0.0.0"');
 * accessor.get('server.host'); // '0.0.0.0'
 */
export class TomlAccessor extends AbstractAccessor {
    /**
     * Hydrate from a TOML string.
     *
     * @param data - TOML string input.
     * @returns Populated accessor instance.
     * @throws {InvalidFormatException} When input is not a string.
     * @throws {TomlParseException} When TOML is malformed or contains rejected constructs.
     * @throws {SecurityException} When payload size exceeds limit.
     *
     * @example
     * accessor.from('name = "Alice"\nage = 30'); // { name: 'Alice', age: 30 }
     */
    from(data: unknown): this {
        if (typeof data !== 'string') {
            /* Stryker disable StringLiteral -- error message content is cosmetic */
            throw new InvalidFormatException(
                `TomlAccessor expects a TOML string, got ${typeof data}`,
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

        return new TomlParser(this.parser.getMaxDepth()).parse(raw);
    }
}
