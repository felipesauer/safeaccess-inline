# Changelog

All notable changes to the `@safeaccess/inline` JavaScript/TypeScript package are documented in this file.

## [0.1.1](https://github.com/felipesauer/safeaccess-inline/compare/js-v0.1.0...js-v0.1.1) (2026-04-07)


### Features

* **js:** bootstrap release tracking for rebranded package ([5fc07d7](https://github.com/felipesauer/safeaccess-inline/commit/5fc07d7126870d72145bbfc80609370c9d1509c7))


### Bug Fixes

* **js:** add repository field for npm provenance validation ([b34cdef](https://github.com/felipesauer/safeaccess-inline/commit/b34cdeff01e7e7566921f04b11f33fbd391aa8d2))

## 0.1.0 (2026-04-07)

### Bug Fixes

- **ci:** achieve 100% branch coverage on Vitest 4.x and fix docs-ci workflow ([#14](https://github.com/felipesauer/safeaccess-inline/issues/14)) ([11daf5a](https://github.com/felipesauer/safeaccess-inline/commit/11daf5aaa1ff1b901c8297921533485f1584a330))

## [0.1.0] — 2026-04-06

### Features

- Initial release.
- `Inline` class: static and instance factory methods `fromArray`, `fromObject`, `fromJson`, `fromXml`, `fromYaml`, `fromIni`, `fromEnv`, `fromNdjson`, `fromAny`, `from`, `make`.
- Builder pattern: `withSecurityGuard`, `withSecurityParser`, `withPathCache`, `withParserIntegration`, `withStrictMode`.
- Dot-notation read API: `get`, `getOrFail`, `getAt`, `has`, `hasAt`, `getMany`, `all`, `count`, `keys`, `getRaw`.
- Dot-notation write API: `set`, `setAt`, `remove`, `removeAt`, `merge`, `mergeAll`; honours `readonly()` mode.
- `TypeFormat` enum with 9 cases: `Array`, `Object`, `Json`, `Xml`, `Yaml`, `Ini`, `Env`, `Ndjson`, `Any`.
- `SecurityGuard` with configurable depth limit, forbidden-key list (magic methods, prototype-pollution, Node.js-specific vectors), and `sanitize()` helper. All limits are `readonly`.
- `SecurityParser` with configurable payload-size, key-count, structural-depth, and resolve-depth limits. All limits are `readonly`.
- Custom-parser extension point via `ParseIntegrationInterface`.
- Path-result caching via `PathCacheInterface`.
- 8 typed exception classes extending `AccessorException`: `InvalidFormatException`, `ParserException`, `PathNotFoundException`, `ReadonlyViolationException`, `SecurityException`, `UnsupportedTypeException`, `YamlParseException`.
- Strict TypeScript types throughout; no `any`; full ESM output.
