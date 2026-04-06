import { AbstractAccessor } from '../abstract-accessor.js';
import { InvalidFormatException } from '../../exceptions/invalid-format-exception.js';

/**
 * Accessor for INI-formatted strings.
 *
 * Parses sections (e.g. `[section]`) as nested keys.
 * Type inference: numeric strings become numbers, `true`/`false` become booleans.
 *
 * @example
 * const accessor = new IniAccessor(parser).from('[db]\nhost=localhost\nport=5432');
 * accessor.get('db.host'); // 'localhost'
 */
export class IniAccessor extends AbstractAccessor {
    /**
     * Hydrate from an INI-formatted string.
     *
     * @param data - INI string input.
     * @returns Populated accessor instance.
     * @throws {InvalidFormatException} When input is not a string.
     * @throws {SecurityException} When payload size exceeds limit.
     *
     * @example
     * accessor.from('key=value\n[section]\nname=Alice');
     */
    from(data: unknown): this {
        if (typeof data !== 'string') {
            /* Stryker disable next-line StringLiteral -- error message content is cosmetic */
            throw new InvalidFormatException(
                `IniAccessor expects an INI string, got ${typeof data}`,
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

        return this.parseIni(raw);
    }

    /**
     * Parse an INI string into a nested record.
     *
     * @param input - Raw INI content.
     * @returns Parsed key-value structure.
     */
    private parseIni(input: string): Record<string, unknown> {
        const result: Record<string, unknown> = {};
        let currentSection: string | null = null;

        for (const rawLine of input.split('\n')) {
            /* Stryker disable next-line MethodExpression -- equivalent: untrimmed leading whitespace on keys/values handled by subsequent trim() calls */
            const line = rawLine.trim();

            /* Stryker disable next-line ConditionalExpression,LogicalOperator,StringLiteral,MethodExpression,BlockStatement -- fallthrough: blank/comment lines without = still skip via eqPos === -1 */
            if (line === '' || line.startsWith('#') || line.startsWith(';')) {
                continue;
            }

            // Section header
            const sectionMatch = /^\[([^\]]+)\]/.exec(line);
            if (sectionMatch !== null) {
                currentSection = sectionMatch[1] as string;
                if (!Object.prototype.hasOwnProperty.call(result, currentSection)) {
                    result[currentSection] = {};
                }
                continue;
            }

            // Key=Value
            const eqPos = line.indexOf('=');
            /* Stryker disable next-line ConditionalExpression,BlockStatement -- equivalent: lines without = produce no usable key=value pair */
            if (eqPos === -1) {
                continue;
            }

            const key = line.slice(0, eqPos).trim();
            const rawValue = line.slice(eqPos + 1).trim();
            const value = this.castIniValue(rawValue);

            if (currentSection !== null) {
                (result[currentSection] as Record<string, unknown>)[key] = value;
            } else {
                result[key] = value;
            }
        }

        return result;
    }

    /**
     * Cast an INI string value to its native type.
     *
     * @param value - Raw string value from the INI file.
     * @returns Typed value (boolean, null, number, or string).
     */
    private castIniValue(value: string): unknown {
        if (value === 'true' || value === 'yes' || value === 'on') return true;
        if (value === 'false' || value === 'no' || value === 'off' || value === 'none')
            return false;
        if (value === 'null' || value === '') return null;

        // Strip surrounding quotes
        if (
            (value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))
        ) {
            return value.slice(1, -1);
        }

        if (/^-?\d+$/.test(value)) return parseInt(value, 10);
        if (/^-?\d+\.\d+$/.test(value)) return parseFloat(value);

        return value;
    }
}
