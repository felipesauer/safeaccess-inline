import type { ValidatableParserInterface } from '../contracts/validatable-parser-interface.js';
import type { ParseIntegrationInterface } from '../contracts/parse-integration-interface.js';
import { AbstractAccessor } from '../accessors/abstract-accessor.js';
import { ArrayAccessor } from '../accessors/formats/array-accessor.js';
import { ObjectAccessor } from '../accessors/formats/object-accessor.js';
import { JsonAccessor } from '../accessors/formats/json-accessor.js';
import { XmlAccessor } from '../accessors/formats/xml-accessor.js';
import { YamlAccessor } from '../accessors/formats/yaml-accessor.js';
import { IniAccessor } from '../accessors/formats/ini-accessor.js';
import { EnvAccessor } from '../accessors/formats/env-accessor.js';
import { NdjsonAccessor } from '../accessors/formats/ndjson-accessor.js';
import { AnyAccessor } from '../accessors/formats/any-accessor.js';
import { InvalidFormatException } from '../exceptions/invalid-format-exception.js';

/**
 * Factory for creating typed format-specific accessors.
 *
 * Encapsulates the wiring between a parser and accessor construction,
 * providing one method per supported format. Used internally by
 * {@link Inline} to create accessors.
 *
 * @internal
 */
export class AccessorFactory {
    /**
     * Initialize the factory with a parser, optional integration, and optional strict mode.
     *
     * @param parser - Parser for dot-notation resolution.
     * @param defaultIntegration - Default integration for AnyAccessor.
     * @param strictMode - Override strict mode for created accessors.
     */
    constructor(
        private readonly parser: ValidatableParserInterface,
        private readonly defaultIntegration: ParseIntegrationInterface | null = null,
        private readonly strictMode: boolean | null = null,
    ) {}

    /**
     * Return the underlying parser used by this factory.
     *
     * @returns The parser instance.
     */
    getParser(): ValidatableParserInterface {
        return this.parser;
    }

    /**
     * Apply configured strict mode to a new accessor before hydration.
     *
     * @param accessor - Unhydrated accessor instance.
     * @returns Same accessor with strict mode applied if configured.
     */
    private applyOptions<T extends AbstractAccessor>(accessor: T): T {
        if (this.strictMode !== null) {
            return accessor.strict(this.strictMode) as T;
        }
        return accessor;
    }

    /**
     * Create an ArrayAccessor from raw array data.
     *
     * @param data - Source array or object.
     * @returns Populated ArrayAccessor.
     * @throws {SecurityException} When security constraints are violated.
     */
    array(data: Record<string, unknown> | unknown[]): ArrayAccessor {
        return this.applyOptions(new ArrayAccessor(this.parser)).from(data);
    }

    /**
     * Create an ObjectAccessor from a source object.
     *
     * @param data - Source object.
     * @returns Populated ObjectAccessor.
     * @throws {SecurityException} When security constraints are violated.
     */
    object(data: object): ObjectAccessor {
        return this.applyOptions(new ObjectAccessor(this.parser)).from(data);
    }

    /**
     * Create a JsonAccessor from a JSON string.
     *
     * @param data - Raw JSON string.
     * @returns Populated JsonAccessor.
     * @throws {InvalidFormatException} When the JSON is malformed.
     * @throws {SecurityException} When security constraints are violated.
     */
    json(data: string): JsonAccessor {
        return this.applyOptions(new JsonAccessor(this.parser)).from(data);
    }

    /**
     * Create an XmlAccessor from an XML string.
     *
     * @param data - Raw XML string.
     * @returns Populated XmlAccessor.
     * @throws {InvalidFormatException} When the XML is malformed.
     * @throws {SecurityException} When DOCTYPE is detected.
     */
    xml(data: string): XmlAccessor {
        return this.applyOptions(new XmlAccessor(this.parser)).from(data);
    }

    /**
     * Create a YamlAccessor from a YAML string.
     *
     * @param data - Raw YAML string.
     * @returns Populated YamlAccessor.
     * @throws {YamlParseException} When the YAML is malformed.
     * @throws {SecurityException} When security constraints are violated.
     */
    yaml(data: string): YamlAccessor {
        return this.applyOptions(new YamlAccessor(this.parser)).from(data);
    }

    /**
     * Create an IniAccessor from an INI string.
     *
     * @param data - Raw INI string.
     * @returns Populated IniAccessor.
     * @throws {InvalidFormatException} When the INI is malformed.
     * @throws {SecurityException} When security constraints are violated.
     */
    ini(data: string): IniAccessor {
        return this.applyOptions(new IniAccessor(this.parser)).from(data);
    }

    /**
     * Create an EnvAccessor from a dotenv-formatted string.
     *
     * @param data - Raw dotenv string.
     * @returns Populated EnvAccessor.
     * @throws {SecurityException} When security constraints are violated.
     */
    env(data: string): EnvAccessor {
        return this.applyOptions(new EnvAccessor(this.parser)).from(data);
    }

    /**
     * Create an NdjsonAccessor from a newline-delimited JSON string.
     *
     * @param data - Raw NDJSON string.
     * @returns Populated NdjsonAccessor.
     * @throws {InvalidFormatException} When any JSON line is malformed.
     * @throws {SecurityException} When security constraints are violated.
     */
    ndjson(data: string): NdjsonAccessor {
        return this.applyOptions(new NdjsonAccessor(this.parser)).from(data);
    }

    /**
     * Create an AnyAccessor with automatic format detection.
     *
     * @param data - Raw data in any supported format.
     * @param integration - Override integration (falls back to default).
     * @returns Populated AnyAccessor.
     * @throws {InvalidFormatException} When no integration is available.
     */
    any(data: unknown, integration?: ParseIntegrationInterface | null): AnyAccessor {
        const resolved = integration ?? this.defaultIntegration;

        if (resolved === null) {
            throw new InvalidFormatException(
                'AnyAccessor requires a ParseIntegrationInterface. ' +
                    'Pass one directly or configure a default via Inline.withParserIntegration(i).fromAny(data).',
            );
        }

        return this.applyOptions(new AnyAccessor(this.parser, resolved)).from(data);
    }
}
