import { TypeFormat } from './type-format.js';
import { DotNotationParser } from './core/dot-notation-parser.js';
import { SecurityGuard } from './security/security-guard.js';
import { SecurityParser } from './security/security-parser.js';
import type { SecurityGuardInterface } from './contracts/security-guard-interface.js';
import type { SecurityParserInterface } from './contracts/security-parser-interface.js';
import type { AccessorsInterface } from './contracts/accessors-interface.js';
import type { ParseIntegrationInterface } from './contracts/parse-integration-interface.js';
import type { PathCacheInterface } from './contracts/path-cache-interface.js';
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
import { InvalidFormatException } from './exceptions/invalid-format-exception.js';

/**
 * Facade for creating typed data accessors fluently.
 *
 * All static factory methods return a strongly-typed accessor instance.
 * Use the builder methods (`withSecurityGuard`, `withSecurityParser`) to
 * customize the security configuration before creating an accessor.
 *
 * @example
 * const accessor = Inline.fromJson('{"name":"Alice"}');
 * accessor.get('name'); // 'Alice'
 *
 * @example
 * const accessor = Inline.from(TypeFormat.Yaml, 'name: Alice');
 * accessor.get('name'); // 'Alice'
 */
export class Inline {
    private readonly guard: SecurityGuardInterface;
    private readonly secParser: SecurityParserInterface;
    private readonly pathCache: PathCacheInterface | null;
    private readonly integration: ParseIntegrationInterface | null;
    private readonly strictMode: boolean | null;

    private constructor(
        guard: SecurityGuardInterface,
        secParser: SecurityParserInterface,
        pathCache: PathCacheInterface | null = null,
        integration: ParseIntegrationInterface | null = null,
        strictMode: boolean | null = null,
    ) {
        this.guard = guard;
        this.secParser = secParser;
        this.pathCache = pathCache;
        this.integration = integration;
        this.strictMode = strictMode;
    }

    private static defaultInstance(): Inline {
        return new Inline(new SecurityGuard(), new SecurityParser());
    }

    private makeParser(): DotNotationParser {
        return new DotNotationParser(this.guard, this.secParser, this.pathCache ?? undefined);
    }

    /**
     * Apply configured strict mode to a new accessor before hydration.
     *
     * @param accessor - Unhydrated accessor instance.
     * @returns Same accessor with strict mode applied if configured.
     */
    private prepare<T extends AbstractAccessor>(accessor: T): T {
        if (this.strictMode !== null) {
            return accessor.strict(this.strictMode) as T;
        }
        return accessor;
    }

    /**
     * Return a new Inline instance with a custom SecurityGuard, preserving other settings.
     *
     * @param guard - Custom security guard implementation.
     * @returns New Inline builder instance.
     */
    withSecurityGuard(guard: SecurityGuardInterface): Inline {
        return new Inline(guard, this.secParser, this.pathCache, this.integration, this.strictMode);
    }

    /**
     * Return a new Inline instance with a custom SecurityParser, preserving other settings.
     *
     * @param parser - Custom security parser implementation.
     * @returns New Inline builder instance.
     */
    withSecurityParser(parser: SecurityParserInterface): Inline {
        return new Inline(this.guard, parser, this.pathCache, this.integration, this.strictMode);
    }

    /**
     * Return a new Inline instance with a custom path cache, preserving other settings.
     *
     * @param cache - Custom path cache implementation.
     * @returns New Inline builder instance.
     */
    withPathCache(cache: PathCacheInterface): Inline {
        return new Inline(this.guard, this.secParser, cache, this.integration, this.strictMode);
    }

    /**
     * Return a new Inline instance with a custom parser integration, preserving other settings.
     *
     * @param integration - Custom format integration implementation.
     * @returns New Inline builder instance.
     */
    withParserIntegration(integration: ParseIntegrationInterface): Inline {
        return new Inline(this.guard, this.secParser, this.pathCache, integration, this.strictMode);
    }

    /**
     * Return a new Inline instance with the given strict mode, preserving other settings.
     *
     * @param strict - Whether to enable strict security validation.
     * @returns New Inline builder instance.
     *
     * @security Passing `false` disables all SecurityGuard and SecurityParser
     * validation. Only use with fully trusted, application-controlled input.
     */
    withStrictMode(strict: boolean): Inline {
        return new Inline(this.guard, this.secParser, this.pathCache, this.integration, strict);
    }

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
        return new Inline(guard, new SecurityParser());
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
        return new Inline(new SecurityGuard(), parser);
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
        return new Inline(new SecurityGuard(), new SecurityParser(), cache);
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
        return new Inline(new SecurityGuard(), new SecurityParser(), null, integration);
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
        return new Inline(new SecurityGuard(), new SecurityParser(), null, null, strict);
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
        return this.prepare(new ArrayAccessor(this.makeParser())).from(data);
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
        return this.prepare(new ObjectAccessor(this.makeParser())).from(data);
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
        return this.prepare(new JsonAccessor(this.makeParser())).from(data);
    }

    /**
     * Create an XmlAccessor from an XML string.
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
        return this.prepare(new XmlAccessor(this.makeParser())).from(data);
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
        return this.prepare(new YamlAccessor(this.makeParser())).from(data);
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
        return this.prepare(new IniAccessor(this.makeParser())).from(data);
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
        return this.prepare(new EnvAccessor(this.makeParser())).from(data);
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
        return this.prepare(new NdjsonAccessor(this.makeParser())).from(data);
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
        const resolved = integration ?? this.integration;
        if (resolved === null) {
            throw new InvalidFormatException(
                'AnyAccessor requires a ParseIntegrationInterface — use Inline.withParserIntegration(integration).fromAny(data).',
            );
        }
        return this.prepare(new AnyAccessor(this.makeParser(), resolved)).from(data);
    }

    /**
     * Create a typed accessor by its constructor.
     *
     * @param AccessorConstructor - The accessor class to instantiate.
     * @param data                - Raw data to hydrate the accessor with.
     * @returns Populated accessor instance.
     *
     * @example
     * Inline.make(JsonAccessor, '{"key":"value"}').get('key'); // 'value'
     */
    make<T extends AccessorsInterface>(
        AccessorConstructor: new (parser: DotNotationParser) => T,
        data: unknown,
    ): T {
        const accessor = new AccessorConstructor(this.makeParser());
        if (this.strictMode !== null && accessor instanceof AbstractAccessor) {
            return (accessor.strict(this.strictMode) as T).from(data);
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
     * @param AccessorConstructor - The accessor class to instantiate.
     * @param data                - Raw data to hydrate the accessor with.
     * @returns Populated accessor instance.
     *
     * @example
     * Inline.make(JsonAccessor, '{"key":"value"}').get('key'); // 'value'
     */
    static make<T extends AccessorsInterface>(
        AccessorConstructor: new (parser: DotNotationParser) => T,
        data: unknown,
    ): T {
        return Inline.defaultInstance().make(AccessorConstructor, data);
    }
}
