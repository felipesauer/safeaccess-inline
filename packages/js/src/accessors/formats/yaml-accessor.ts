import { AbstractAccessor } from '../abstract-accessor.js';
import { InvalidFormatException } from '../../exceptions/invalid-format-exception.js';
import { YamlParser } from '../../parser/yaml-parser.js';

/**
 * Accessor for YAML-encoded strings.
 *
 * Uses the internal YamlParser for safe YAML parsing without
 * depending on external YAML libraries. Tags, anchors, aliases, and
 * merge keys are blocked as unsafe constructs.
 *
 * @example
 * const accessor = new YamlAccessor(parser).from('key: value\nnested:\n  a: 1');
 * accessor.get('nested.a'); // 1
 */
export class YamlAccessor extends AbstractAccessor {
    /**
     * Hydrate from a YAML string.
     *
     * @param data - YAML string input.
     * @returns Populated accessor instance.
     * @throws {InvalidFormatException} When input is not a string or YAML is malformed.
     * @throws {YamlParseException} When unsafe YAML constructs are present.
     * @throws {SecurityException} When payload size exceeds limit.
     *
     * @example
     * accessor.from('name: Alice\nage: 30');
     */
    from(data: unknown): this {
        if (typeof data !== 'string') {
            /* Stryker disable StringLiteral -- error message content is cosmetic */
            throw new InvalidFormatException(
                `YamlAccessor expects a YAML string, got ${typeof data}`,
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

        return new YamlParser().parse(raw);
    }
}
