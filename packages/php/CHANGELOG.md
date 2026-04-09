# Changelog

All notable changes to the `safeaccess/inline` PHP package are documented in this file.

## [0.1.2](https://github.com/felipesauer/safeaccess-inline/compare/php-v0.1.1...php-v0.1.2) (2026-04-08)

### Bug Fixes

- **php:** fix logo image URL and add fromAny format section in README ([8bc377f](https://github.com/felipesauer/safeaccess-inline/commit/8bc377f9344882ad31e9c22366c06d306997a0cf))

### Internal Changes

- **php:** enforce `abstract from()` on `AbstractAccessor` — all concrete accessors now required to implement `from(mixed $data): static` (extending AbstractAccessor without `from()` is a compile-time error)
- **php:** `SecurityGuard::sanitize()` delegates to new private `sanitizeRecursive()` to support integer-keyed sub-arrays inside string-keyed payloads (e.g. `{"items": [{...}]}`) without PHPStan errors

## [0.1.1](https://github.com/felipesauer/safeaccess-inline/compare/php-v0.1.0...php-v0.1.1) (2026-04-07)

### Miscellaneous Chores

- rebrand from safe-access to safeaccess ([#20](https://github.com/felipesauer/safeaccess-inline/issues/20)) ([fa14257](https://github.com/felipesauer/safeaccess-inline/commit/fa14257fb3099802695c7fc93385d35095a085db))

## 0.1.0 (2026-04-07)

### Features

- **php:** bootstrap initial release tracking ([8990f1e](https://github.com/felipesauer/safeaccess-inline/commit/8990f1ef30efc2fba2f178721a6b20818ce5b9d5))

## [0.1.0] - 2026-04-06

### Features

- Initial release.
- `Inline` facade: static factory methods `fromArray`, `fromObject`, `fromJson`, `fromXml`, `fromYaml`, `fromIni`, `fromEnv`, `fromNdjson`, `fromAny`, `from`, `make`.
- Builder pattern: `withSecurityGuard`, `withSecurityParser`, `withPathCache`, `withParserIntegration`, `withStrictMode`.
- Dot-notation read API: `get`, `getOrFail`, `getAt`, `has`, `hasAt`, `getMany`, `all`, `count`, `keys`, `getRaw`.
- Dot-notation write API: `set`, `setAt`, `remove`, `removeAt`, `merge`, `mergeAll`; honours `readonly()` mode.
- `TypeFormat` enum with 9 cases: `Array`, `Object`, `Json`, `Xml`, `Yaml`, `Ini`, `Env`, `Ndjson`, `Any`.
- `SecurityGuard` with configurable depth limit, forbidden-key list (magic methods, superglobals, stream wrappers, prototype-pollution vectors), and `sanitize()` helper.
- `SecurityParser` with configurable payload-size, key-count, structural-depth, and resolve-depth limits.
- Custom-parser extension point via `ParseIntegrationInterface` (`fromAny`, `AnyAccessor`).
- Path-result caching via `PathCacheInterface`.
- 8 typed exception classes: `AccessorException`, `InvalidFormatException`, `ParserException`, `PathNotFoundException`, `ReadonlyViolationException`, `SecurityException`, `UnsupportedTypeException`, `YamlParseException`.
