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
    private readonly maxElements: number;

    /**
     * @param maxDepth - Maximum structural depth allowed.
     * @param maxElements - Maximum number of opening-tag occurrences allowed in the
     *   Node.js manual-parser path before parsing is aborted. Acts as a complexity
     *   bound and defence-in-depth against document-bombing. Defaults to 10 000
     *   (matches `SecurityParser.maxKeys`). Non-positive, non-finite, or `NaN` values
     *   are clamped to 10 000 to prevent accidental guard disablement.
     */
    constructor(maxDepth: number, maxElements: number = 10_000) {
        this.maxDepth = maxDepth;
        this.maxElements = Number.isFinite(maxElements) && maxElements >= 1
            ? maxElements
            : 10_000;
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

        // Bound parser complexity before the linear inner-content scan: count opening
        // tags as a document-complexity proxy. This is a defence-in-depth limit —
        // the linear scanner below is already O(n), but bounding element count also
        // caps the total number of recursive parseXmlChildren calls.
        // Browser environments (DOMParser) are unaffected.
        const elementCount = (stripped.match(/<[a-zA-Z_]/g) ?? []).length;
        if (elementCount > this.maxElements) {
            throw new SecurityException(
                `XML element count ${elementCount} exceeds maximum of ${this.maxElements}.`,
            );
        }

        return this.extractRootContent(stripped);
    }

    /**
     * Extract root element inner content using an indexOf-based O(n) scan.
     *
     * Replaces the previous backreference regex to guarantee O(n) time regardless
     * of document structure. The closing-tag match is verified by scanning
     * backwards from the final `>` character of the trimmed document.
     */
    private extractRootContent(doc: string): Record<string, unknown> {
        if (doc.length < 2 || doc[0] !== '<' || !/[a-zA-Z_]/.test(doc[1] as string)) {
            throw new InvalidFormatException('XmlAccessor failed to parse XML string.');
        }

        // Scan root tag name: [a-zA-Z_][\w.-]*
        let nameEnd = 2;
        while (nameEnd < doc.length && /[\w.-]/.test(doc[nameEnd] as string)) {
            nameEnd++;
        }
        const tagName = doc.slice(1, nameEnd);

        // Locate the '>' that closes the root opening tag (attributes may not contain '>').
        const openGt = doc.indexOf('>', nameEnd);
        if (openGt === -1) {
            throw new InvalidFormatException('XmlAccessor failed to parse XML string.');
        }

        // Self-closing element: opening tag body ends with '/'.
        if (doc.slice(nameEnd, openGt).trimEnd().endsWith('/')) {
            // Self-closing tag must occupy the whole document.
            if (openGt !== doc.length - 1) {
                throw new InvalidFormatException('XmlAccessor failed to parse XML string.');
            }
            return {};
        }

        // The trimmed document must end with '>'.
        if (doc[doc.length - 1] !== '>') {
            throw new InvalidFormatException('XmlAccessor failed to parse XML string.');
        }

        // Walk backward from the final '>' to locate the closing tag for this root element.
        // This is O(tagNameLen) — the tag name is typically short and always bounded.
        let pos = doc.length - 2;
        while (pos >= 0 && (doc[pos] === ' ' || doc[pos] === '\t' || doc[pos] === '\n' || doc[pos] === '\r')) {
            pos--;
        }

        // pos must point to the last char of the root tag name.
        const nameStart = pos - tagName.length + 1;
        if (nameStart < 2 || doc.slice(nameStart, pos + 1) !== tagName) {
            throw new InvalidFormatException('XmlAccessor failed to parse XML string.');
        }

        // The two chars before the tag name must be '</'.
        if (doc[nameStart - 1] !== '/' || doc[nameStart - 2] !== '<') {
            throw new InvalidFormatException('XmlAccessor failed to parse XML string.');
        }

        const closeTagStart = nameStart - 2;
        if (closeTagStart <= openGt) {
            throw new InvalidFormatException('XmlAccessor failed to parse XML string.');
        }

        const innerContent = doc.slice(openGt + 1, closeTagStart);
        return this.parseXmlChildren(innerContent, 0);
    }

    private parseXmlChildren(content: string, depth: number): Record<string, unknown> {
        if (depth > this.maxDepth) {
            throw new SecurityException(
                `XML structural depth ${depth} exceeds maximum of ${this.maxDepth}.`,
            );
        }

        const result: Record<string, unknown> = {};
        let i = 0;
        let hasElements = false;

        while (i < content.length) {
            const lt = content.indexOf('<', i);
            if (lt === -1) break;

            const nextChar = content[lt + 1];
            if (nextChar === undefined) break;

            // Skip closing tags, comments, and processing instructions
            if (nextChar === '/' || nextChar === '!' || nextChar === '?') {
                const gt = content.indexOf('>', lt);
                i = gt === -1 ? content.length : gt + 1;
                continue;
            }

            // Tag name must start with a valid XML name-start character
            if (!/[a-zA-Z_]/.test(nextChar)) {
                i = lt + 1;
                continue;
            }

            // Extract tag name: [a-zA-Z_][\w.-]*
            let nameEnd = lt + 2;
            while (nameEnd < content.length && /[\w.-]/.test(content[nameEnd] as string)) {
                nameEnd++;
            }
            const tagName = content.slice(lt + 1, nameEnd);

            const gt = content.indexOf('>', nameEnd);
            if (gt === -1) break;

            // Self-closing tag e.g. <tag/> or <tag attr="v"/>
            if (content.slice(nameEnd, gt).trimEnd().endsWith('/')) {
                hasElements = true;
                this.addChild(result, tagName, '');
                i = gt + 1;
                continue;
            }

            // Locate the matching closing </tagName> using a nesting counter.
            // This avoids regex backreferences and runs in O(n) time.
            const closeTag = `</${tagName}`;
            const openPrefix = `<${tagName}`;
            let nestDepth = 1;
            let pos = gt + 1;
            let innerEnd = -1;
            let afterClose = content.length;

            while (pos < content.length && nestDepth > 0) {
                const nextLt = content.indexOf('<', pos);
                if (nextLt === -1) break;

                if (content.startsWith(closeTag, nextLt)) {
                    const c = content[nextLt + closeTag.length];
                    if (c === '>' || c === ' ' || c === '\t' || c === '\n' || c === '\r' || c === undefined) {
                        nestDepth--;
                        if (nestDepth === 0) {
                            innerEnd = nextLt;
                            const cgt = content.indexOf('>', nextLt + closeTag.length);
                            afterClose = cgt === -1 ? content.length : cgt + 1;
                            break;
                        }
                        pos = nextLt + closeTag.length;
                        continue;
                    }
                }

                if (content.startsWith(openPrefix, nextLt)) {
                    const c = content[nextLt + openPrefix.length];
                    if (c === '>' || c === ' ' || c === '\t' || c === '\n' || c === '\r' || c === '/') {
                        const ogt = content.indexOf('>', nextLt + openPrefix.length);
                        if (ogt !== -1 && !content.slice(nextLt + openPrefix.length, ogt).trimEnd().endsWith('/')) {
                            nestDepth++;
                        }
                    }
                }

                pos = nextLt + 1;
            }

            if (innerEnd === -1) {
                // Unclosed or malformed tag — skip past the opening tag
                i = gt + 1;
                continue;
            }

            const inner = content.slice(gt + 1, innerEnd);
            const trimmedInner = inner.trim();
            let value: unknown;

            if (trimmedInner !== '' && /<[a-zA-Z]/.test(trimmedInner)) {
                const childResult = this.parseXmlChildren(trimmedInner, depth + 1);
                value =
                    Object.keys(childResult).length === 1 && '#text' in childResult
                        ? childResult['#text']
                        : childResult;
            } else {
                value = trimmedInner;
            }

            hasElements = true;
            this.addChild(result, tagName, value);
            i = afterClose;
        }

        if (!hasElements) {
            const text = content.trim();
            if (text !== '') {
                result['#text'] = text;
            }
        }

        return result;
    }

    private addChild(result: Record<string, unknown>, tagName: string, value: unknown): void {
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
}
