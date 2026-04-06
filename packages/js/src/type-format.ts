/**
 * Enumeration of supported data format types.
 *
 * Used by {@link Inline.from} to select the appropriate accessor.
 *
 * @example
 * const accessor = Inline.from(TypeFormat.Json, '{"key":"value"}');
 */
export enum TypeFormat {
    /** Plain array or object data. */
    Array = 'array',
    /** JavaScript object (class instance or plain). */
    Object = 'object',
    /** JSON string. */
    Json = 'json',
    /** XML string. */
    Xml = 'xml',
    /** YAML string. */
    Yaml = 'yaml',
    /** INI configuration string. */
    Ini = 'ini',
    /** Dotenv-formatted string. */
    Env = 'env',
    /** Newline-delimited JSON string. */
    Ndjson = 'ndjson',
    /** Auto-detected format via integration. */
    Any = 'any',
}
