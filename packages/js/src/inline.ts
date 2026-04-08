import { TypeFormat } from './type-format.js';
import type { SecurityGuardInterface } from './contracts/security-guard-interface.js';
import type { SecurityParserInterface } from './contracts/security-parser-interface.js';
import type { AccessorsInterface } from './contracts/accessors-interface.js';
import type { ParseIntegrationInterface } from './contracts/parse-integration-interface.js';
import type { PathCacheInterface } from './contracts/path-cache-interface.js';
import type { ValidatableParserInterface } from './contracts/validatable-parser-interface.js';
import { AbstractAccessor } from './accessors/abstract-accessor.js';
import { ArrayAccessor } from './accessors/formats/array-accessor.js';
import { ObjectAccessor } from './accessors/formats/object-accessor.js';
import { JsonAccessor } from './accessors/formats/json-accessor.js';
import { XmlAccessor } from './accessors/formats/xml-accessor.js';
import { YamlAccessor } from './accessors/formats/yaml-accessor.js';
import { IniAccessor } from './accessors/formats/ini-accessor.js';
import { EnvAccessor } from './accessors/formats/env-accessor.js';
import { NdjsonAccessor } from './accessors/formats/ndjson-accessor.js';
import { AnyAccessor } from './accessors/formats/any-accessor.js';
import { UnsupportedTypeException } from './exceptions/unsupported-type-exception.js';
import { InlineBuilderAccessor } from './core/inline-builder-accessor.js';

/**
 * Facade for creating typed data accessors fluently.
 *
 * All static factory methods return a strongly-typed accessor instance.
 * Use the builder methods (`withSecurityGuard`, `withSecurityParser`) to
 * customize the security configuration before creating an accessor.
 *
 * @api
 *
 * @example
 * const accessor = Inline.fromJson('{"name":"Alice"}');
 * accessor.get('name'); // 'Alice'
 *
 * @example
 * const accessor = Inline.from(TypeFormat.Yaml, 'name: Alice');
 * accessor.get('name'); // 'Alice'
 */
export class Inline extends InlineBuilderAccessor {
    private static defaultInstance(): Inline {
        return new Inline();
    }

    // ── Instance factory methods ──────────────────────────────────────

    /**
     * Return a new Inline instance with a custom SecurityGuard.
     *
     * @param guard - Custom security guard implementation.
     * @returns New Inline builder instance.
     *
     * @example
     * Inline.withSecurityGuard(new SecurityGuard(10, ['extraKey'])).fromJson('{}');
     */
    static withSecurityGuard(guard: SecurityGuardInterface): Inline {
        return new Inline(guard);
    }

    /**
     * Return a new Inline instance with a custom SecurityParser.
     *
     * @param parser - Custom security parser implementation.
     * @returns New Inline builder instance.
     *
     * @example
     * Inline.withSecurityParser(new SecurityParser({ maxDepth: 10 })).fromJson('{}');
     */
    static withSecurityParser(parser: SecurityParserInterface): Inline {
        return new Inline(undefined, parser);
    }

    /**
     * Return a new Inline instance with a custom path cache.
     *
     * @param cache - Custom path cache implementation.
     * @returns New Inline builder instance.
     *
     * @example
     * const cache: PathCacheInterface = { get: () => null, set: () => {}, has: () => false, clear: () => {} };
     * Inline.withPathCache(cache).fromJson('{"key":"value"}');
     */
    static withPathCache(cache: PathCacheInterface): Inline {
        return new Inline(undefined, undefined, cache);
    }

    /**
     * Return a new Inline instance with a custom parser integration for `fromAny()`.
     *
     * @param integration - Custom format integration implementation.
     * @returns New Inline builder instance.
     *
     * @example
     * Inline.withParserIntegration(new MyCsvIntegration()).fromAny(csvString);
     */
    static withParserIntegration(integration: ParseIntegrationInterface): Inline {
        return new Inline(undefined, undefined, null, integration);
    }

    /**
     * Return a new Inline instance with the given strict mode.
     *
     * @param strict - Whether to enable strict security validation.
     * @returns New Inline builder instance.
     *
     * @security Passing `false` disables all SecurityGuard and SecurityParser
     * validation. Only use with fully trusted, application-controlled input.
     *
     * @example
     * Inline.withStrictMode(false).fromJson(hugePayload).get('key');
     */
    static withStrictMode(strict: boolean): Inline {
        return new Inline(undefined, undefined, null, null, strict);
    }

    /**
     * Create an ArrayAccessor from a plain object or array.
     *
     * @param data - Plain object or array input.
     * @returns Populated ArrayAccessor instance.
     * @throws {SecurityException} When security constraints are violated.
     *
     * @example
     * inline.fromArray({ name: 'Alice' }).get('name'); // 'Alice'
     */
    fromArray(data: Record<string, unknown> | unknown[]): ArrayAccessor {
        return this.builder().array(data);
    }

    /**
     * Create an ObjectAccessor from a JavaScript object.
     *
     * @param data - Object input (plain object, class instance, etc.).
     * @returns Populated ObjectAccessor instance.
     * @throws {SecurityException} When security constraints are violated.
     *
     * @example
     * inline.fromObject({ user: { name: 'Alice' } }).get('user.name');
     */
    fromObject(data: object): ObjectAccessor {
        return this.builder().object(data);
    }

    /**
     * Create a JsonAccessor from a JSON string.
     *
     * @param data - Raw JSON string.
     * @returns Populated JsonAccessor instance.
     * @throws {InvalidFormatException} When the JSON is malformed.
     * @throws {SecurityException} When security constraints are violated.
     *
     * @example
     * inline.fromJson('{"key":"value"}').get('key'); // 'value'
     */
    fromJson(data: string): JsonAccessor {
        return this.builder().json(data);
    }

    /**
     * Create an XmlAccessor from an XML string.
     *
     * Note: The PHP equivalent also accepts `\SimpleXMLElement`; JS only
     * accepts raw XML strings (no pre-parsed equivalent exists in JS).
     *
     * @param data - Raw XML string.
     * @returns Populated XmlAccessor instance.
     * @throws {InvalidFormatException} When the XML is malformed.
     * @throws {SecurityException} When DOCTYPE is detected.
     *
     * @example
     * inline.fromXml('<root><key>value</key></root>').get('key');
     */
    fromXml(data: string): XmlAccessor {
        return this.builder().xml(data);
    }

    /**
     * Create a YamlAccessor from a YAML string.
     *
     * @param data - Raw YAML string.
     * @returns Populated YamlAccessor instance.
     * @throws {YamlParseException} When the YAML is malformed or contains unsafe constructs.
     * @throws {SecurityException} When security constraints are violated.
     *
     * @example
     * inline.fromYaml('name: Alice').get('name'); // 'Alice'
     */
    fromYaml(data: string): YamlAccessor {
        return this.builder().yaml(data);
    }

    /**
     * Create an IniAccessor from an INI string.
     *
     * @param data - Raw INI string.
     * @returns Populated IniAccessor instance.
     * @throws {InvalidFormatException} When the input is not a string.
     * @throws {SecurityException} When security constraints are violated.
     *
     * @example
     * inline.fromIni('[section]\nkey=value').get('section.key'); // 'value'
     */
    fromIni(data: string): IniAccessor {
        return this.builder().ini(data);
    }

    /**
     * Create an EnvAccessor from a dotenv-formatted string.
     *
     * @param data - Raw dotenv string.
     * @returns Populated EnvAccessor instance.
     * @throws {SecurityException} When security constraints are violated.
     *
     * @example
     * inline.fromEnv('APP_NAME=MyApp').get('APP_NAME'); // 'MyApp'
     */
    fromEnv(data: string): EnvAccessor {
        return this.builder().env(data);
    }

    /**
     * Create an NdjsonAccessor from a newline-delimited JSON string.
     *
     * @param data - Raw NDJSON string.
     * @returns Populated NdjsonAccessor instance.
     * @throws {InvalidFormatException} When any JSON line is malformed.
     * @throws {SecurityException} When security constraints are violated.
     *
     * @example
     * inline.fromNdjson('{"id":1}\n{"id":2}').get('0.id'); // 1
     */
    fromNdjson(data: string): NdjsonAccessor {
        return this.builder().ndjson(data);
    }

    /**
     * Create an AnyAccessor from raw data using a custom integration.
     *
     * Uses the integration provided via `withParserIntegration()` by default,
     * or the one passed as the second argument for a one-off override.
     *
     * @param data - Raw input data in any format supported by the integration.
     * @param integration - Override integration for this call (optional).
     * @returns Populated AnyAccessor instance.
     * @throws {InvalidFormatException} When no integration is available or it rejects the format.
     * @throws {SecurityException} When security constraints are violated.
     *
     * @example
     * Inline.withParserIntegration(new CsvIntegration()).fromAny(csvString);
     */
    fromAny(data: unknown, integration?: ParseIntegrationInterface): AnyAccessor {
        return this.builder().any(data, integration);
    }

    /**
     * Create a typed accessor by its constructor.
     *
     * Note: The PHP equivalent accepts a class-string (FQCN) instead of a
     * constructor reference, e.g. `Inline::make(JsonAccessor::class, $data)`.
     *
     * @param AccessorConstructor - The accessor class to instantiate.
     * @param data                - Raw data to hydrate the accessor with.
     * @returns Populated accessor instance.
     *
     * @example
     * Inline.make(JsonAccessor, '{"key":"value"}').get('key'); // 'value'
     */
    make<T extends AccessorsInterface>(
        AccessorConstructor: new (parser: ValidatableParserInterface) => T,
        data: unknown,
    ): T {
        const factory = this.builder();
        const accessor = new AccessorConstructor(factory.getParser());
        if (this._strictMode !== null && accessor instanceof AbstractAccessor) {
            return (accessor.strict(this._strictMode) as T).from(data);
        }
        return accessor.from(data);
    }

    /**
     * Create an accessor for the given TypeFormat and raw data.
     *
     * @param typeFormat - The format to parse as.
     * @param data - Raw input data.
     * @returns Populated accessor instance.
     * @throws {InvalidFormatException} When the data is malformed for the target format.
     * @throws {SecurityException} When security constraints are violated.
     * @throws {UnsupportedTypeException} When the TypeFormat is not supported.
     *
     * @example
     * Inline.from(TypeFormat.Json, '{"key":"value"}').get('key'); // 'value'
     */
    from(typeFormat: TypeFormat, data: unknown): AccessorsInterface {
        switch (typeFormat) {
            case TypeFormat.Array:
                return this.fromArray(data as Record<string, unknown> | unknown[]);
            case TypeFormat.Object:
                return this.fromObject(data as object);
            case TypeFormat.Json:
                return this.fromJson(data as string);
            case TypeFormat.Xml:
                return this.fromXml(data as string);
            case TypeFormat.Yaml:
                return this.fromYaml(data as string);
            case TypeFormat.Ini:
                return this.fromIni(data as string);
            case TypeFormat.Env:
                return this.fromEnv(data as string);
            case TypeFormat.Ndjson:
                return this.fromNdjson(data as string);
            case TypeFormat.Any:
                return this.fromAny(data);
            default: {
                const exhaustive: never = typeFormat;
                throw new UnsupportedTypeException(
                    `TypeFormat '${String(exhaustive)}' is not supported.`,
                );
            }
        }
    }

    /**
     * Create an ArrayAccessor from a plain object or array.
     *
     * @param data - Plain object or array input.
     * @returns Populated ArrayAccessor instance.
     * @throws {SecurityException} When security constraints are violated.
     *
     * @example
     * Inline.fromArray({ name: 'Alice' }).get('name'); // 'Alice'
     */
    static fromArray(data: Record<string, unknown> | unknown[]): ArrayAccessor {
        return Inline.defaultInstance().fromArray(data);
    }

    /**
     * Create an ObjectAccessor from a JavaScript object.
     *
     * @param data - Object input (plain object, class instance, etc.).
     * @returns Populated ObjectAccessor instance.
     * @throws {SecurityException} When security constraints are violated.
     *
     * @example
     * Inline.fromObject({ user: { name: 'Alice' } }).get('user.name');
     */
    static fromObject(data: object): ObjectAccessor {
        return Inline.defaultInstance().fromObject(data);
    }

    /**
     * Create a JsonAccessor from a JSON string.
     *
     * @param data - Raw JSON string.
     * @returns Populated JsonAccessor instance.
     * @throws {InvalidFormatException} When the JSON is malformed.
     * @throws {SecurityException} When security constraints are violated.
     *
     * @example
     * Inline.fromJson('{"key":"value"}').get('key'); // 'value'
     */
    static fromJson(data: string): JsonAccessor {
        return Inline.defaultInstance().fromJson(data);
    }

    /**
     * Create an XmlAccessor from an XML string.
     *
     * Note: The PHP equivalent also accepts `\SimpleXMLElement`; JS only
     * accepts raw XML strings (no pre-parsed equivalent exists in JS).
     *
     * @param data - Raw XML string.
     * @returns Populated XmlAccessor instance.
     * @throws {InvalidFormatException} When the XML is malformed.
     * @throws {SecurityException} When DOCTYPE is detected.
     *
     * @example
     * Inline.fromXml('<root><key>value</key></root>').get('key');
     */
    static fromXml(data: string): XmlAccessor {
        return Inline.defaultInstance().fromXml(data);
    }

    /**
     * Create a YamlAccessor from a YAML string.
     *
     * @param data - Raw YAML string.
     * @returns Populated YamlAccessor instance.
     * @throws {YamlParseException} When the YAML is malformed or contains unsafe constructs.
     * @throws {SecurityException} When security constraints are violated.
     *
     * @example
     * Inline.fromYaml('name: Alice\nage: 30').get('name'); // 'Alice'
     */
    static fromYaml(data: string): YamlAccessor {
        return Inline.defaultInstance().fromYaml(data);
    }

    /**
     * Create an IniAccessor from an INI string.
     *
     * @param data - Raw INI string.
     * @returns Populated IniAccessor instance.
     * @throws {InvalidFormatException} When the input is not a string.
     * @throws {SecurityException} When security constraints are violated.
     *
     * @example
     * Inline.fromIni('[section]\nkey=value').get('section.key'); // 'value'
     */
    static fromIni(data: string): IniAccessor {
        return Inline.defaultInstance().fromIni(data);
    }

    /**
     * Create an EnvAccessor from a dotenv-formatted string.
     *
     * @param data - Raw dotenv string.
     * @returns Populated EnvAccessor instance.
     * @throws {SecurityException} When security constraints are violated.
     *
     * @example
     * Inline.fromEnv('APP_NAME=MyApp\nDEBUG=true').get('APP_NAME'); // 'MyApp'
     */
    static fromEnv(data: string): EnvAccessor {
        return Inline.defaultInstance().fromEnv(data);
    }

    /**
     * Create an NdjsonAccessor from a newline-delimited JSON string.
     *
     * @param data - Raw NDJSON string.
     * @returns Populated NdjsonAccessor instance.
     * @throws {InvalidFormatException} When any JSON line is malformed.
     * @throws {SecurityException} When security constraints are violated.
     *
     * @example
     * Inline.fromNdjson('{"id":1}\n{"id":2}').get('0.id'); // 1
     */
    static fromNdjson(data: string): NdjsonAccessor {
        return Inline.defaultInstance().fromNdjson(data);
    }

    /**
     * Create an accessor for the given TypeFormat and raw data.
     *
     * @param typeFormat - The format to parse as.
     * @param data - Raw input data.
     * @returns Populated accessor instance.
     * @throws {InvalidFormatException} When the data is malformed for the target format.
     * @throws {SecurityException} When security constraints are violated.
     * @throws {UnsupportedTypeException} When the TypeFormat is not supported.
     *
     * @example
     * Inline.from(TypeFormat.Json, '{"key":"value"}').get('key'); // 'value'
     */
    static from(typeFormat: TypeFormat, data: unknown): AccessorsInterface {
        return Inline.defaultInstance().from(typeFormat, data);
    }

    /**
     * Create an AnyAccessor from raw data using a custom integration.
     *
     * @param data - Raw input data.
     * @param integration - Integration that detects and parses the format (optional if set via `withParserIntegration`).
     * @returns Populated AnyAccessor instance.
     * @throws {InvalidFormatException} When no integration is available or it rejects the format.
     * @throws {SecurityException} When security constraints are violated.
     *
     * @example
     * Inline.fromAny(csvString, new CsvIntegration()).get('0.name');
     */
    static fromAny(data: unknown, integration?: ParseIntegrationInterface): AnyAccessor {
        return Inline.defaultInstance().fromAny(data, integration);
    }

    /**
     * Create a typed accessor by its constructor.
     *
     * Note: The PHP equivalent accepts a class-string (FQCN) instead of a
     * constructor reference, e.g. `Inline::make(JsonAccessor::class, $data)`.
     *
     * @param AccessorConstructor - The accessor class to instantiate.
     * @param data                - Raw data to hydrate the accessor with.
     * @returns Populated accessor instance.
     *
     * @example
     * Inline.make(JsonAccessor, '{"key":"value"}').get('key'); // 'value'
     */
    static make<T extends AccessorsInterface>(
        AccessorConstructor: new (parser: ValidatableParserInterface) => T,
        data: unknown,
    ): T {
        return Inline.defaultInstance().make(AccessorConstructor, data);
    }
}
