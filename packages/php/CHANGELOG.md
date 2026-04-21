# Changelog

All notable changes to the `safeaccess/inline` PHP package are documented in this file.

## [0.1.6](https://github.com/felipesauer/safeaccess-inline/compare/php-v0.1.5...php-v0.1.6) (2026-04-21)


### Miscellaneous Chores

* **php:** bump phpstan/phpstan from 2.1.47 to 2.1.50 in /packages/php in the dev-dependencies group ([#43](https://github.com/felipesauer/safeaccess-inline/issues/43)) ([a9ac53d](https://github.com/felipesauer/safeaccess-inline/commit/a9ac53dbe33709a7cf6395b3d5fc7dc0d01da7fb))

## [0.1.5](https://github.com/felipesauer/safeaccess-inline/compare/php-v0.1.4...php-v0.1.5) (2026-04-13)


### Bug Fixes

* reject hyphenated YAML anchors and aliases ([#38](https://github.com/felipesauer/safeaccess-inline/issues/38)) ([9c77879](https://github.com/felipesauer/safeaccess-inline/commit/9c778790cf95742a57dae82721dd791ff623d75d))


### Miscellaneous Chores

* **php:** bump the dev-dependencies group in /packages/php with 2 updates ([#35](https://github.com/felipesauer/safeaccess-inline/issues/35)) ([996939b](https://github.com/felipesauer/safeaccess-inline/commit/996939b49d29f14a99e0188a6872537c079becbf))

## [0.1.4](https://github.com/felipesauer/safeaccess-inline/compare/php-v0.1.3...php-v0.1.4) (2026-04-12)


### Bug Fixes

* **docs:** update README files for TypeScript and PHP packages ([15b5451](https://github.com/felipesauer/safeaccess-inline/commit/15b5451ec9f23ea27aa8d5c59d9ad76e0c584f3e))

## [0.1.3](https://github.com/felipesauer/safeaccess-inline/compare/php-v0.1.2...php-v0.1.3) (2026-04-09)


### Bug Fixes

* **js:** expose readonly extraForbiddenKeys on SecurityGuard for PHP parity ([2b428f6](https://github.com/felipesauer/safeaccess-inline/commit/2b428f6a1fef3607cb968ff18b52d8281158cc92))
* **php:** correct array&lt;string,mixed&gt; type annotations and NdjsonAccessor integer key coercion ([7849f89](https://github.com/felipesauer/safeaccess-inline/commit/7849f89365bd5970738105ed3be9d2b58a15cd93))

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
