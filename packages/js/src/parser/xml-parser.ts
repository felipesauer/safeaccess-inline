import { InvalidFormatException } from '../exceptions/invalid-format-exception.js';
import { SecurityException } from '../exceptions/security-exception.js';

/**
 * Internal XML-to-object parser for XmlAccessor.
 *
 * Provides both a browser path (DOMParser) and a minimal manual parser
 * for Node.js environments. Does not depend on external XML libraries.
 *
 * @internal
 */
export class XmlParser {
    private readonly maxDepth: number;

    /**
     * @param maxDepth - Maximum structural depth allowed.
     */
    constructor(maxDepth: number) {
        this.maxDepth = maxDepth;
    }

    /**
     * Parse an XML body into a plain object using the best available parser.
     *
     * @param xml - Raw XML content (must not contain DOCTYPE).
     * @returns Parsed data structure.
     * @throws {InvalidFormatException} When XML is malformed.
     * @throws {SecurityException} When structural depth exceeds limit.
     *
     * @example
     * new XmlParser(10).parse('<root><key>value</key></root>'); // { key: 'value' }
     */
    parse(xml: string): Record<string, unknown> {
        if (typeof DOMParser !== 'undefined') {
            return this.parseBrowserXml(xml);
        }

        return this.parseXmlManual(xml);
    }

    private parseBrowserXml(xml: string): Record<string, unknown> {
        const parser = new DOMParser();
        const doc = parser.parseFromString(xml, 'application/xml');

        const parserError = doc.querySelector('parsererror');
        if (parserError !== null) {
            throw new InvalidFormatException(
                `XmlAccessor failed to parse XML: ${parserError.textContent ?? 'Unknown error'}`,
            );
        }

        const root = doc.documentElement;
        if (root === null) {
            return {};
        }

        return this.elementToRecord(root, 0);
    }

    private elementToRecord(element: Element, depth: number): Record<string, unknown> {
        if (depth > this.maxDepth) {
            throw new SecurityException(
                `XML structural depth ${depth} exceeds maximum of ${this.maxDepth}.`,
            );
        }

        const result: Record<string, unknown> = {};

        for (const attr of Array.from(element.attributes)) {
            if (attr !== undefined) {
                result[`@${attr.name}`] = attr.value;
            }
        }

        for (const child of Array.from(element.childNodes)) {
            if (child === undefined) continue;

            if (child.nodeType === 3) {
                const text = child.textContent?.trim() ?? '';
                if (text !== '') {
                    result['#text'] = text;
                }
            } else if (child.nodeType === 1) {
                const childEl = child as Element;
                const name = childEl.nodeName;
                const childData = this.elementToRecord(childEl, depth + 1);

                if (Object.prototype.hasOwnProperty.call(result, name)) {
                    const existing = result[name];
                    if (Array.isArray(existing)) {
                        existing.push(childData);
                    } else {
                        result[name] = [existing, childData];
                    }
                } else {
                    result[name] = childData;
                }
            }
        }

        return result;
    }

    private parseXmlManual(xml: string): Record<string, unknown> {
        const stripped = xml.replace(/<\?xml[^?]*\?>/i, '').trim();

        const rootMatch = stripped.match(/^<([a-zA-Z_][\w.-]*)[^>]*>([\s\S]*)<\/\1\s*>$/s);
        if (rootMatch === null) {
            const selfClose = stripped.match(/^<[a-zA-Z_][\w.-]*[^>]*\/\s*>$/);
            if (selfClose !== null) {
                return {};
            }
            throw new InvalidFormatException('XmlAccessor failed to parse XML string.');
        }

        return this.parseXmlChildren(rootMatch[2] as string, 0);
    }

    private parseXmlChildren(content: string, depth: number): Record<string, unknown> {
        if (depth > this.maxDepth) {
            throw new SecurityException(
                `XML structural depth ${depth} exceeds maximum of ${this.maxDepth}.`,
            );
        }

        const result: Record<string, unknown> = {};
        const elementRe =
            /<([a-zA-Z_][\w.-]*)([^>]*)>([\s\S]*?)<\/\1\s*>|<([a-zA-Z_][\w.-]*)[^>]*\/>/g;
        let match: RegExpExecArray | null;

        let hasElements = false;

        while ((match = elementRe.exec(content)) !== null) {
            hasElements = true;
            const tagName = (match[1] ?? match[4]) as string;
            const inner = match[3] ?? '';
            const trimmedInner = inner.trim();
            let childResult: Record<string, unknown> = { '#text': trimmedInner };
            if (trimmedInner !== '' && /<[a-zA-Z]/.test(trimmedInner)) {
                childResult = this.parseXmlChildren(trimmedInner, depth + 1);
            }

            const value =
                Object.keys(childResult).length === 1 && '#text' in childResult
                    ? childResult['#text']
                    : childResult;

            if (Object.prototype.hasOwnProperty.call(result, tagName)) {
                const existing = result[tagName];
                if (Array.isArray(existing)) {
                    existing.push(value);
                } else {
                    result[tagName] = [existing, value];
                }
            } else {
                result[tagName] = value;
            }
        }

        if (!hasElements) {
            const text = content.trim();
            if (text !== '') {
                result['#text'] = text;
            }
        }

        return result;
    }
}
