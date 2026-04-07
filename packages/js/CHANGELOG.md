# Changelog

All notable changes to the `@safe-access/inline` JavaScript/TypeScript package are documented in this file.

## [0.1.0] — 2026-04-06

### Features

* Initial release.
* `Inline` class: static and instance factory methods `fromArray`, `fromObject`, `fromJson`, `fromXml`, `fromYaml`, `fromIni`, `fromEnv`, `fromNdjson`, `fromAny`, `from`, `make`.
* Builder pattern: `withSecurityGuard`, `withSecurityParser`, `withPathCache`, `withParserIntegration`, `withStrictMode`.
* Dot-notation read API: `get`, `getOrFail`, `getAt`, `has`, `hasAt`, `getMany`, `all`, `count`, `keys`, `getRaw`.
* Dot-notation write API: `set`, `setAt`, `remove`, `removeAt`, `merge`, `mergeAll`; honours `readonly()` mode.
* `TypeFormat` enum with 9 cases: `Array`, `Object`, `Json`, `Xml`, `Yaml`, `Ini`, `Env`, `Ndjson`, `Any`.
* `SecurityGuard` with configurable depth limit, forbidden-key list (magic methods, prototype-pollution, Node.js-specific vectors), and `sanitize()` helper. All limits are `readonly`.
* `SecurityParser` with configurable payload-size, key-count, structural-depth, and resolve-depth limits. All limits are `readonly`.
* Custom-parser extension point via `ParseIntegrationInterface`.
* Path-result caching via `PathCacheInterface`.
* 8 typed exception classes extending `AccessorException`: `InvalidFormatException`, `ParserException`, `PathNotFoundException`, `ReadonlyViolationException`, `SecurityException`, `UnsupportedTypeException`, `YamlParseException`.
* Strict TypeScript types throughout; no `any`; full ESM output.
