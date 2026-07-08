# Changelog

All notable changes to the `@safeaccess/inline` JavaScript/TypeScript package are documented in this file.

## [0.2.0](https://github.com/felipesauer/safeaccess-inline/compare/js-v0.1.6...js-v0.2.0) (2026-07-08)


### Features

* add CSV and TSV format support to both packages ([be4f2ff](https://github.com/felipesauer/safeaccess-inline/commit/be4f2ff8a7eb935749fa2c3dbcd656fcc4550c18))
* add optional schema validation to both packages ([216babc](https://github.com/felipesauer/safeaccess-inline/commit/216babc9c59e9aad8a7acb346f4510a7bb63d831))
* add TOML format support to both packages ([9d30c4d](https://github.com/felipesauer/safeaccess-inline/commit/9d30c4ddb83f165d40da89aca4c5e5d39700152c))
* extend schema validation with constraints ([69a0eba](https://github.com/felipesauer/safeaccess-inline/commit/69a0ebaa967c260770ac22b8ecf1ca268c3e9dff))
* group schema failures by path with errorsByPath ([35a2d02](https://github.com/felipesauer/safeaccess-inline/commit/35a2d02112c2b718385df747d4d9f1bff020e21b))
* support wildcard paths in schema validation ([bf633f0](https://github.com/felipesauer/safeaccess-inline/commit/bf633f0489b71afc07c50dcd7e0c846f4ee5a15e))
* validate array items with the each constraint ([f205c6e](https://github.com/felipesauer/safeaccess-inline/commit/f205c6ef83ea7d7a523e886895c58c86ad524718))

## [0.1.6](https://github.com/felipesauer/safeaccess-inline/compare/js-v0.1.5...js-v0.1.6) (2026-06-08)


### Bug Fixes

* align filter coercion and YAML flow-map parsing across PHP and JS ([#69](https://github.com/felipesauer/safeaccess-inline/issues/69)) ([9aebe64](https://github.com/felipesauer/safeaccess-inline/commit/9aebe645bd5e61adad3852d103def2406ec5365c))

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
