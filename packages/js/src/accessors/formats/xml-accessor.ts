import { AbstractAccessor } from '../abstract-accessor.js';
import { InvalidFormatException } from '../../exceptions/invalid-format-exception.js';
import { SecurityException } from '../../exceptions/security-exception.js';
import { XmlParser } from '../../parser/xml-parser.js';

/**
 * Accessor for XML strings.
 *
 * Parses XML using the DOM parser available in the current environment.
 * Blocks DOCTYPE declarations to prevent XXE attacks.
 *
 * @example
 * const accessor = new XmlAccessor(parser).from('<root><key>value</key></root>');
 * accessor.get('key'); // 'value'
 */
export class XmlAccessor extends AbstractAccessor {
    /**
     * Hydrate from an XML string.
     *
     * @param data - XML string input.
     * @returns Populated accessor instance.
     * @throws {InvalidFormatException} When input is not a string.
     * @throws {SecurityException} When DOCTYPE declaration is detected.
     *
     * @example
     * accessor.from('<root><name>Alice</name></root>');
     */
    from(data: unknown): this {
        if (typeof data !== 'string') {
            throw new InvalidFormatException(
                /* Stryker disable next-line StringLiteral -- error message content is cosmetic */
                `XmlAccessor expects an XML string, got ${typeof data}`,
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

        // Reject DOCTYPE to prevent XXE
        if (/<!DOCTYPE/i.test(raw)) {
            /* Stryker disable next-line StringLiteral -- error message content is the security message, tested functionally */
            throw new SecurityException('XML DOCTYPE declarations are not allowed.');
        }

        // Pass getMaxKeys() as the element-count cap: each XML opening tag maps to at most
        // one output key, so maxKeys is a sound upper bound for the ReDoS guard.
        return new XmlParser(this.parser.getMaxDepth(), this.parser.getMaxKeys()).parse(raw);
    }
}
