// Main facade
export { Inline } from './inline.js';

// TypeFormat enum
export { TypeFormat } from './type-format.js';

// Accessor base
export { AbstractAccessor } from './accessors/abstract-accessor.js';

// Format accessors
export { ArrayAccessor } from './accessors/formats/array-accessor.js';
export { ObjectAccessor } from './accessors/formats/object-accessor.js';
export { JsonAccessor } from './accessors/formats/json-accessor.js';
export { XmlAccessor } from './accessors/formats/xml-accessor.js';
export { YamlAccessor } from './accessors/formats/yaml-accessor.js';
export { IniAccessor } from './accessors/formats/ini-accessor.js';
export { EnvAccessor } from './accessors/formats/env-accessor.js';
export { NdjsonAccessor } from './accessors/formats/ndjson-accessor.js';
export { AnyAccessor } from './accessors/formats/any-accessor.js';

// Core
// NOTE: DotNotationParser is intentionally not exported — it is an internal component.

// Security
export { SecurityGuard } from './security/security-guard.js';
export { SecurityParser } from './security/security-parser.js';

// Exceptions
export { AccessorException } from './exceptions/accessor-exception.js';
export { InvalidFormatException } from './exceptions/invalid-format-exception.js';
export { YamlParseException } from './exceptions/yaml-parse-exception.js';
export { ParserException } from './exceptions/parser-exception.js';
export { PathNotFoundException } from './exceptions/path-not-found-exception.js';
export { ReadonlyViolationException } from './exceptions/readonly-violation-exception.js';
export { SecurityException } from './exceptions/security-exception.js';
export { UnsupportedTypeException } from './exceptions/unsupported-type-exception.js';

// Contracts
export type { AccessorsInterface } from './contracts/accessors-interface.js';
export type { ReadableAccessorsInterface } from './contracts/readable-accessors-interface.js';
export type { WritableAccessorsInterface } from './contracts/writable-accessors-interface.js';
export type { FactoryAccessorsInterface } from './contracts/factory-accessors-interface.js';
export type { SecurityGuardInterface } from './contracts/security-guard-interface.js';
export type { SecurityParserInterface } from './contracts/security-parser-interface.js';
export type { PathCacheInterface } from './contracts/path-cache-interface.js';
export type { ParseIntegrationInterface } from './contracts/parse-integration-interface.js';
