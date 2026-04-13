# Changelog

All notable changes to the `@safeaccess/inline` JavaScript/TypeScript package are documented in this file.

## [0.1.5](https://github.com/felipesauer/safeaccess-inline/compare/js-v0.1.4...js-v0.1.5) (2026-04-13)


### Bug Fixes

* reject hyphenated YAML anchors and aliases ([#38](https://github.com/felipesauer/safeaccess-inline/issues/38)) ([9c77879](https://github.com/felipesauer/safeaccess-inline/commit/9c778790cf95742a57dae82721dd791ff623d75d))

## [0.1.4](https://github.com/felipesauer/safeaccess-inline/compare/js-v0.1.3...js-v0.1.4) (2026-04-12)


### Bug Fixes

* **docs:** update README files for TypeScript and PHP packages ([15b5451](https://github.com/felipesauer/safeaccess-inline/commit/15b5451ec9f23ea27aa8d5c59d9ad76e0c584f3e))

## [0.1.3](https://github.com/felipesauer/safeaccess-inline/compare/js-v0.1.2...js-v0.1.3) (2026-04-09)


### Bug Fixes

* **js:** expose readonly extraForbiddenKeys on SecurityGuard for PHP parity ([2b428f6](https://github.com/felipesauer/safeaccess-inline/commit/2b428f6a1fef3607cb968ff18b52d8281158cc92))
* **php:** correct array&lt;string,mixed&gt; type annotations and NdjsonAccessor integer key coercion ([7849f89](https://github.com/felipesauer/safeaccess-inline/commit/7849f89365bd5970738105ed3be9d2b58a15cd93))

## [0.1.2](https://github.com/felipesauer/safeaccess-inline/compare/js-v0.1.1...js-v0.1.2) (2026-04-08)

### Bug Fixes

- **js:** fix logo image URL in README ([16f4fc5](https://github.com/felipesauer/safeaccess-inline/commit/16f4fc5d69fa7ce86e3017bbbfc9f393925a5c37))

### Internal Changes

- **js:** expose `readonly extraForbiddenKeys` on `SecurityGuard` for parity with PHP (`public readonly array $extraForbiddenKeys`)
- **js:** extract `ValidatableParserInterface` from `DotNotationParser` — `AbstractAccessor` now types its parser dependency against this contract instead of the concrete class
- **js:** `SecurityGuard.sanitize()` handles nested arrays via a dedicated `sanitizeArray()` private method, matching the PHP `sanitizeRecursive` pattern

## [0.1.1](https://github.com/felipesauer/safeaccess-inline/compare/js-v0.1.0...js-v0.1.1) (2026-04-07)

### Features

- **js:** bootstrap release tracking for rebranded package ([5fc07d7](https://github.com/felipesauer/safeaccess-inline/commit/5fc07d7126870d72145bbfc80609370c9d1509c7))

### Bug Fixes

- **js:** add repository field for npm provenance validation ([b34cdef](https://github.com/felipesauer/safeaccess-inline/commit/b34cdeff01e7e7566921f04b11f33fbd391aa8d2))

## 0.1.0 (2026-04-07)

### Bug Fixes

- **ci:** achieve 100% branch coverage on Vitest 4.x and fix docs-ci workflow ([#14](https://github.com/felipesauer/safeaccess-inline/issues/14)) ([11daf5a](https://github.com/felipesauer/safeaccess-inline/commit/11daf5aaa1ff1b901c8297921533485f1584a330))

## [0.1.0] - 2026-04-06

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
