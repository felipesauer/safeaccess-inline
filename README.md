<p align="center">
  <img src="https://raw.githubusercontent.com/felipesauer/safeaccess-inline/main/.github/assets/logo.svg" width="80" alt="safeaccess-inline logo">
</p>

<h1 align="center">Safe Access Inline</h1>

<p align="center">
  A dual-language library for <strong>safe nested data access</strong> using dot notation.
</p>

<p align="center">
  <a href="https://codecov.io/gh/felipesauer/safeaccess-inline"><img src="https://img.shields.io/codecov/c/github/felipesauer/safeaccess-inline?label=Coverage" alt="Coverage"></a>
  <a href="https://www.npmjs.com/package/@safeaccess/inline"><img src="https://img.shields.io/npm/v/@safeaccess/inline?label=npm" alt="npm"></a>
  <a href="https://packagist.org/packages/safeaccess/inline"><img src="https://img.shields.io/packagist/v/safeaccess/inline?label=packagist" alt="Packagist"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="License: MIT"></a>
</p>

---

Navigate deeply nested structures in JSON, YAML, XML, INI, ENV, NDJSON, arrays, and objects - with built-in security validation, immutable writes, a fluent builder API, and identical behavior in both PHP and TypeScript.

## Why Safe Access Inline?

Accessing nested data from untrusted sources (API responses, config files, user uploads) is error-prone and risky. Safe Access Inline solves this with:

- **Dot-notation paths** - `user.address.city` instead of chained null checks
- **Multi-format support** - JSON, YAML, XML, INI, ENV, NDJSON, arrays, objects
- **Security by default** - blocks prototype pollution, PHP magic methods, superglobals, stream wrapper injection, XML external entities, and oversized payloads
- **Immutable writes** - `set()`, `remove()`, and `merge()` return new instances
- **Cross-language parity** - same input → same output in PHP and TypeScript

## Packages

| Package                              | Language         | Install                              |
| ------------------------------------ | ---------------- | ------------------------------------ |
| [`safeaccess/inline`](packages/php/) | PHP 8.2+         | `composer require safeaccess/inline` |
| [`@safeaccess/inline`](packages/js/) | TypeScript (ESM) | `npm install @safeaccess/inline`     |

Both packages expose the same public API surface and are tested for behavioral parity.

## Installation

### PHP

```bash
composer require safeaccess/inline
```

**Requirements:** PHP 8.2+, extensions: `json`, `simplexml`, `libxml`

**Optional:** `ext-yaml` for improved YAML parsing performance (a built-in minimal parser is used by default).

### JavaScript / TypeScript

```bash
npm install @safeaccess/inline
```

**Requirements:** Node.js 22+

## Quick Start

### PHP

```php
use SafeAccess\Inline\Inline;

$accessor = Inline::fromJson('{"user": {"name": "Alice", "age": 30}}');

$accessor->get('user.name');           // 'Alice'
$accessor->get('user.email', 'N/A');   // 'N/A' (default when missing)
$accessor->has('user.age');            // true
$accessor->getOrFail('user.name');     // 'Alice' (throws if missing)

// Immutable writes - original is never modified
$updated = $accessor->set('user.email', 'alice@example.com');
$updated->get('user.email');           // 'alice@example.com'
$accessor->has('user.email');          // false (original unchanged)
```

### TypeScript

```typescript
import { Inline } from '@safeaccess/inline';

const accessor = Inline.fromJson('{"user": {"name": "Alice", "age": 30}}');

accessor.get('user.name'); // 'Alice'
accessor.get('user.email', 'N/A'); // 'N/A' (default when missing)
accessor.has('user.age'); // true
accessor.getOrFail('user.name'); // 'Alice' (throws if missing)

// Immutable writes - original is never modified
const updated = accessor.set('user.email', 'alice@example.com');
updated.get('user.email'); // 'alice@example.com'
accessor.has('user.email'); // false (original unchanged)
```

## Dot Notation Syntax

### Basic Syntax (PHP & TypeScript)

| Syntax            | Example            | Description                         |
| ----------------- | ------------------ | ----------------------------------- |
| `key.key`         | `user.name`        | Nested key access                   |
| `key.0.key`       | `users.0.name`     | Numeric key (array index)           |
| `key\.with\.dots` | `config\.db\.host` | Escaped dots in key names           |
| `$` or `$.path`   | `$.user.name`      | Optional `$` root prefix (stripped) |

### Advanced PathQuery

Both packages include a full PathQuery engine:

| Syntax          | Example             | Description                               |
| --------------- | ------------------- | ----------------------------------------- |
| `[0]`           | `users[0]`          | Bracket index access                      |
| `*` or `[*]`    | `users.*`           | Wildcard - expand all children            |
| `..key`         | `..name`            | Recursive descent - find key at any depth |
| `..['a','b']`   | `..['name','age']`  | Multi-key recursive descent               |
| `[0,1,2]`       | `users[0,1,2]`      | Multi-index - select multiple indices     |
| `['a','b']`     | `['name','age']`    | Multi-key - select multiple keys          |
| `[0:5]`         | `items[0:5]`        | Slice - indices 0 through 4               |
| `[::2]`         | `items[::2]`        | Slice with step - every 2nd item          |
| `[::-1]`        | `items[::-1]`       | Reverse slice                             |
| `[?expr]`       | `users[?age>18]`    | Filter predicate expression               |
| `.{fields}`     | `.{name, age}`      | Projection - select fields                |
| `.{alias: src}` | `.{fullName: name}` | Aliased projection                        |

#### Filter Expressions

```php
// PHP
$data = Inline::fromJson('[
    {"name": "Alice", "age": 25, "role": "admin"},
    {"name": "Bob",   "age": 17, "role": "user"},
    {"name": "Carol", "age": 30, "role": "admin"}
]');

// Comparison: ==, !=, >, <, >=, <=
$data->get('[?age>18]');                          // Alice and Carol

// Logical: && and ||
$data->get('[?age>18 && role==\'admin\']');         // Alice and Carol

// Built-in functions: starts_with, contains, values
$data->get('[?starts_with(@.name, \'A\')]');        // Alice
$data->get('[?contains(@.name, \'ob\')]');          // Bob

// Arithmetic in predicates: +, -, *, /
$orders = Inline::fromJson('[{"price": 10, "qty": 5}, {"price": 3, "qty": 2}]');
$orders->get('[?@.price * @.qty > 20]');           // first order only
```

```typescript
// TypeScript
const data = Inline.fromJson(`[
    {"name": "Alice", "age": 25, "role": "admin"},
    {"name": "Bob",   "age": 17, "role": "user"},
    {"name": "Carol", "age": 30, "role": "admin"}
]`);

// Comparison: ==, !=, >, <, >=, <=
data.get('[?age>18]'); // Alice and Carol

// Logical: && and ||
data.get('[?age>18 && role=="admin"]'); // Alice and Carol

// Built-in functions: starts_with, contains, values
data.get('[?starts_with(@.name, "A")]'); // Alice
data.get('[?contains(@.name, "ob")]'); // Bob

// Arithmetic in predicates: +, -, *, /
const orders = Inline.fromJson('[{"price": 10, "qty": 5}, {"price": 3, "qty": 2}]');
orders.get('[?@.price * @.qty > 20]'); // first order only
```

## Supported Formats

Each format has a dedicated accessor with automatic parsing and security validation.

<details>
<summary><strong>JSON</strong></summary>

```php
// PHP
$accessor = Inline::fromJson('{"users": [{"name": "Alice"}, {"name": "Bob"}]}');
$accessor->get('users.0.name'); // 'Alice'
```

```typescript
// TypeScript
const accessor = Inline.fromJson('{"users": [{"name": "Alice"}, {"name": "Bob"}]}');
accessor.get('users.0.name'); // 'Alice'
```

</details>

<details>
<summary><strong>YAML</strong></summary>

```php
// PHP
$yaml = <<<YAML
database:
  host: localhost
  port: 5432
  credentials:
    user: admin
YAML;

$accessor = Inline::fromYaml($yaml);
$accessor->get('database.credentials.user'); // 'admin'
```

```typescript
// TypeScript
const yaml = `database:
  host: localhost
  port: 5432
  credentials:
    user: admin`;

const accessor = Inline.fromYaml(yaml);
accessor.get('database.credentials.user'); // 'admin'
```

</details>

<details>
<summary><strong>XML</strong></summary>

```php
// PHP
$xml = '<config><database><host>localhost</host><port>5432</port></database></config>';
$accessor = Inline::fromXml($xml);
$accessor->get('database.host'); // 'localhost'

// Also accepts SimpleXMLElement
$accessor = Inline::fromXml(simplexml_load_string($xml));
```

```typescript
// TypeScript
const accessor = Inline.fromXml('<config><database><host>localhost</host></database></config>');
accessor.get('database.host'); // 'localhost'
```

</details>

<details>
<summary><strong>INI</strong></summary>

```php
// PHP
$accessor = Inline::fromIni("[database]\nhost=localhost\nport=5432");
$accessor->get('database.host'); // 'localhost'
```

```typescript
// TypeScript
const accessor = Inline.fromIni('[database]\nhost=localhost\nport=5432');
accessor.get('database.host'); // 'localhost'
```

</details>

<details>
<summary><strong>ENV (dotenv)</strong></summary>

```php
// PHP
$accessor = Inline::fromEnv("APP_NAME=MyApp\nAPP_DEBUG=true\nDB_HOST=localhost");
$accessor->get('DB_HOST'); // 'localhost'
```

```typescript
// TypeScript
const accessor = Inline.fromEnv('APP_NAME=MyApp\nAPP_DEBUG=true\nDB_HOST=localhost');
accessor.get('DB_HOST'); // 'localhost'
```

</details>

<details>
<summary><strong>NDJSON (Newline-Delimited JSON)</strong></summary>

```php
// PHP
$ndjson = '{"id":1,"name":"Alice"}' . "\n" . '{"id":2,"name":"Bob"}';
$accessor = Inline::fromNdjson($ndjson);
$accessor->get('0.name'); // 'Alice'
$accessor->get('1.name'); // 'Bob'
```

```typescript
// TypeScript
const accessor = Inline.fromNdjson('{"id":1,"name":"Alice"}\n{"id":2,"name":"Bob"}');
accessor.get('0.name'); // 'Alice'
accessor.get('1.name'); // 'Bob'
```

</details>

<details>
<summary><strong>Array / Object</strong></summary>

```php
// PHP
$accessor = Inline::fromArray(['users' => [['name' => 'Alice'], ['name' => 'Bob']]]);
$accessor->get('users.0.name'); // 'Alice'

$accessor = Inline::fromObject((object) ['name' => 'Alice', 'age' => 30]);
$accessor->get('name'); // 'Alice'
```

```typescript
// TypeScript
const accessor = Inline.fromArray({ users: [{ name: 'Alice' }, { name: 'Bob' }] });
accessor.get('users.0.name'); // 'Alice'

const objAccessor = Inline.fromObject({ name: 'Alice', age: 30 });
objAccessor.get('name'); // 'Alice'
```

</details>

<details>
<summary><strong>Any (custom format via integration)</strong></summary>

```php
// PHP - requires implementing ParseIntegrationInterface
$accessor = Inline::withParserIntegration(new MyCsvIntegration())->fromAny($csvString);
$accessor->get('0.column_name');
```

```typescript
// TypeScript - requires implementing ParseIntegrationInterface
const accessor = Inline.withParserIntegration(new MyCsvIntegration()).fromAny(csvString);
accessor.get('0.column_name');
```

</details>

<details>
<summary><strong>Dynamic (by TypeFormat enum)</strong></summary>

```php
// PHP
use SafeAccess\Inline\Enums\TypeFormat;
$accessor = Inline::from(TypeFormat::Json, '{"key": "value"}');
$accessor->get('key'); // 'value'
```

```typescript
// TypeScript
import { Inline, TypeFormat } from '@safeaccess/inline';
const accessor = Inline.from(TypeFormat.Json, '{"key": "value"}');
accessor.get('key'); // 'value'
```

</details>

## Reading & Writing

All accessor methods are identical in PHP and TypeScript.

### PHP

```php
$accessor = Inline::fromJson('{"a": {"b": 1, "c": 2}}');

// Read
$accessor->get('a.b');                  // 1
$accessor->get('a.missing', 'default'); // 'default'
$accessor->getOrFail('a.b');            // 1 (throws PathNotFoundException if missing)
$accessor->has('a.b');                  // true
$accessor->all();                       // ['a' => ['b' => 1, 'c' => 2]]
$accessor->count();                     // 1 (root keys)
$accessor->count('a');                  // 2 (keys under 'a')
$accessor->keys();                      // ['a']
$accessor->keys('a');                   // ['b', 'c']
$accessor->getMany([
    'a.b' => null,
    'a.x' => 'fallback',
]);                                     // ['a.b' => 1, 'a.x' => 'fallback']
$accessor->getRaw();                    // original JSON string

// Write (immutable - every write returns a new instance)
$updated = $accessor->set('a.d', 3);
$updated = $updated->remove('a.c');
$updated = $updated->merge('a', ['e' => 4]);
$updated = $updated->mergeAll(['f' => 5]);
$updated->all();                        // ['a' => ['b' => 1, 'd' => 3, 'e' => 4], 'f' => 5]

// Readonly mode - block all writes
$readonly = $accessor->readonly();
$readonly->get('a.b');                  // 1 (reads work)
$readonly->set('a.b', 99);             // throws ReadonlyViolationException
```

### TypeScript

```typescript
const accessor = Inline.fromJson('{"a": {"b": 1, "c": 2}}');

// Read
accessor.get('a.b'); // 1
accessor.get('a.missing', 'default'); // 'default'
accessor.getOrFail('a.b'); // 1 (throws PathNotFoundException if missing)
accessor.has('a.b'); // true
accessor.all(); // { a: { b: 1, c: 2 } }
accessor.count(); // 1
accessor.count('a'); // 2
accessor.keys(); // ['a']
accessor.keys('a'); // ['b', 'c']
accessor.getMany({
    'a.b': null,
    'a.x': 'fallback',
}); // { 'a.b': 1, 'a.x': 'fallback' }
accessor.getRaw(); // original JSON string

// Write (immutable)
const updated = accessor.set('a.d', 3).remove('a.c').merge('a', { e: 4 }).mergeAll({ f: 5 });
updated.all(); // { a: { b: 1, d: 3, e: 4 }, f: 5 }

// Readonly mode
const readonly = accessor.readonly();
readonly.get('a.b'); // 1
readonly.set('a.b', 99); // throws ReadonlyViolationException
```

## Configure

Customize security, caching, and parsing via the builder pattern:

### PHP

```php
use SafeAccess\Inline\Inline;
use SafeAccess\Inline\Security\SecurityGuard;
use SafeAccess\Inline\Security\SecurityParser;

$accessor = Inline::withSecurityGuard(new SecurityGuard(extraForbiddenKeys: ['secret']))
    ->withSecurityParser(new SecurityParser(maxDepth: 5))
    ->withStrictMode(true)
    ->fromJson($untrustedInput);
```

### TypeScript

```typescript
import { Inline, SecurityGuard, SecurityParser } from '@safeaccess/inline';

const accessor = Inline.withSecurityGuard(new SecurityGuard(512, ['secret']))
    .withSecurityParser(new SecurityParser({ maxDepth: 5 }))
    .withStrictMode(true)
    .fromJson(untrustedInput);
```

### Builder Methods

| Method                               | Description                                      |
| ------------------------------------ | ------------------------------------------------ |
| `withSecurityGuard(guard)`           | Custom forbidden-key rules and depth limits      |
| `withSecurityParser(parser)`         | Custom payload size and structural limits        |
| `withPathCache(cache)`               | Path segment cache for repeated lookups          |
| `withParserIntegration(integration)` | Custom format parser for `fromAny()`             |
| `withStrictMode(false)`              | Disable security validation (trusted input only) |

## Security

Safe Access Inline applies security validation **by default** on every public entry point. All keys pass through `SecurityGuard` and `SecurityParser` before being accessible.

### Forbidden Keys

The two packages block different key sets tailored to their runtime:

**PHP** (`packages/php`)

| Category            | Examples                                                                                                      | Reason                                              |
| ------------------- | ------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| PHP magic methods   | `__construct`, `__destruct`, `__wakeup`, `__sleep`, `__toString`, `__call`, `__get`, `__set`, `__invoke`, ... | Prevent triggering PHP magic behavior via data keys |
| Prototype pollution | `__proto__`, `constructor`, `prototype`                                                                       | Prevent prototype pollution attacks                 |
| PHP superglobals    | `GLOBALS`, `_GET`, `_POST`, `_COOKIE`, `_REQUEST`, `_SERVER`, `_ENV`, `_FILES`, `_SESSION`                    | Prevent superglobal variable access                 |
| Stream wrapper URIs | `php://input`, `php://filter`, `phar://...`, `data://...`, `file://...`, ...                                  | Prevent stream wrapper injection                    |

**TypeScript** (`packages/js`)

| Category                      | Examples                                                                                                     | Reason                                             |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------ | -------------------------------------------------- |
| Prototype pollution           | `__proto__`, `constructor`, `prototype`                                                                      | Prevent prototype pollution attacks                |
| Legacy prototype manipulation | `__defineGetter__`, `__defineSetter__`, `__lookupGetter__`, `__lookupSetter__`                               | Prevent legacy prototype tampering                 |
| Property shadow               | `hasOwnProperty`                                                                                             | Overriding it can bypass guard checks              |
| Node.js globals               | `__dirname`, `__filename`                                                                                    | Prevent path-injection via dynamic property access |
| Protocol / stream URIs        | `javascript:`, `blob:`, `ws://`, `wss://`, `node:`, `file://`, `http://`, `https://`, `ftp://`, `data:`, ... | Prevent URI injection and XSS vectors              |

Keys starting with `__` are matched **case-insensitively**. Stream wrapper URIs and protocol schemes are matched by **prefix**.

Add custom forbidden keys:

```php
// PHP
$guard = new SecurityGuard(extraForbiddenKeys: ['secret', 'internal_token']);
$accessor = Inline::withSecurityGuard($guard)->fromJson($data);
```

```typescript
// TypeScript
const guard = new SecurityGuard(512, ['secret', 'internal_token']);
const accessor = Inline.withSecurityGuard(guard).fromJson(data);
```

### Structural Limits

| Limit                    | Default            | Description                                          |
| ------------------------ | ------------------ | ---------------------------------------------------- |
| `maxPayloadBytes`        | 10 MB (10,485,760) | Maximum raw string input size                        |
| `maxKeys`                | 10,000             | Maximum total key count across the entire structure  |
| `maxDepth`               | 512                | Maximum structural nesting depth                     |
| `maxResolveDepth`        | 100                | Maximum recursion for path resolution and deep merge |
| `maxCountRecursiveDepth` | 100                | Maximum recursion when counting keys                 |

### Format-Specific Protections

| Format | Protection                                                              |
| ------ | ----------------------------------------------------------------------- |
| XML    | Rejects `<!DOCTYPE` - prevents XXE (XML External Entity) attacks        |
| YAML   | Blocks unsafe tags, anchors (`&`), aliases (`*`), and merge keys (`<<`) |
| All    | Forbidden key validation on every parsed key                            |

Disable for fully trusted input: `Inline::withStrictMode(false)` / `Inline.withStrictMode(false)`.

> **Warning:** Disabling strict mode skips **all** validation - forbidden keys, payload size, depth and key-count limits. Only use with application-controlled input.

For vulnerability reports, see [SECURITY.md](SECURITY.md).

## Error Handling

All exceptions extend `AccessorException`, making it easy to catch every library error in a single block.

### PHP

```php
use SafeAccess\Inline\Inline;
use SafeAccess\Inline\Exceptions\AccessorException;
use SafeAccess\Inline\Exceptions\InvalidFormatException;
use SafeAccess\Inline\Exceptions\SecurityException;
use SafeAccess\Inline\Exceptions\PathNotFoundException;
use SafeAccess\Inline\Exceptions\ReadonlyViolationException;

try {
    $accessor = Inline::fromJson($untrustedInput);
    $value = $accessor->getOrFail('config.key');
} catch (InvalidFormatException $e) {
    // Malformed JSON, XML, INI, or NDJSON input
} catch (SecurityException $e) {
    // Forbidden key, payload too large, depth/key-count exceeded
} catch (PathNotFoundException $e) {
    // Path does not exist in the data
} catch (ReadonlyViolationException $e) {
    // Write attempted on a readonly accessor
} catch (AccessorException $e) {
    // Catch-all for any SafeAccess error
}
```

### TypeScript

```typescript
import {
    Inline,
    AccessorException,
    InvalidFormatException,
    SecurityException,
    PathNotFoundException,
    ReadonlyViolationException,
} from '@safeaccess/inline';

try {
    const accessor = Inline.fromJson(untrustedInput);
    const value = accessor.getOrFail('config.key');
} catch (e) {
    if (e instanceof InvalidFormatException) {
        /* malformed input */
    }
    if (e instanceof SecurityException) {
        /* security violation */
    }
    if (e instanceof PathNotFoundException) {
        /* path not found */
    }
    if (e instanceof ReadonlyViolationException) {
        /* readonly violation */
    }
    if (e instanceof AccessorException) {
        /* any library error */
    }
}
```

### Exception Hierarchy

| Exception                    | Extends                      | When                                                                                   |
| ---------------------------- | ---------------------------- | -------------------------------------------------------------------------------------- |
| `AccessorException`          | `RuntimeException` / `Error` | Root - catch-all for any library error                                                 |
| `SecurityException`          | `AccessorException`          | Forbidden key, payload too large, structural limits exceeded                           |
| `InvalidFormatException`     | `AccessorException`          | Malformed JSON, XML, INI, NDJSON                                                       |
| `YamlParseException`         | `InvalidFormatException`     | Unsafe or malformed YAML                                                               |
| `PathNotFoundException`      | `AccessorException`          | `getOrFail()` on a missing path                                                        |
| `ReadonlyViolationException` | `AccessorException`          | Write on a readonly accessor                                                           |
| `UnsupportedTypeException`   | `AccessorException`          | Unknown accessor class in `make()`                                                     |
| `ParserException`            | `AccessorException`          | Reserved for custom parser-level errors; built-in depth limits use `SecurityException` |

## Advanced Usage

### Strict Mode

By default, all input is validated. Disable for trusted data:

```php
// PHP
$accessor = Inline::withStrictMode(false)->fromJson($trustedPayload);
```

```typescript
// TypeScript
const accessor = Inline.withStrictMode(false).fromJson(trustedPayload);
```

### Path Cache

Cache parsed path segments for repeated lookups:

```php
// PHP - implement PathCacheInterface
$cache = new MyPathCache();
$accessor = Inline::withPathCache($cache)->fromJson($data);
$accessor->get('deeply.nested.path'); // parses path
$accessor->get('deeply.nested.path'); // cache hit - skips parsing
```

```typescript
// TypeScript - implement PathCacheInterface
const cacheMap = new Map();
const cache: PathCacheInterface = {
    get: (path) => cacheMap.get(path) ?? null,
    set: (path, segments) => {
        cacheMap.set(path, segments);
    },
    has: (path) => cacheMap.has(path),
    clear: () => {
        cacheMap.clear();
        return cache;
    },
};
const accessor = Inline.withPathCache(cache).fromJson(data);
```

### Custom Format Integration

Add support for custom data formats by implementing `ParseIntegrationInterface`:

```php
// PHP
class CsvIntegration implements ParseIntegrationInterface
{
    public function assertFormat(mixed $raw): bool
    {
        return is_string($raw) && str_contains($raw, ',');
    }

    public function parse(mixed $raw): array
    {
        // Parse CSV to associative array
        return $parsed;
    }
}

$accessor = Inline::withParserIntegration(new CsvIntegration())->fromAny($csvString);
```

```typescript
// TypeScript
const csvIntegration: ParseIntegrationInterface = {
    assertFormat: (raw: unknown) => typeof raw === 'string' && (raw as string).includes(','),
    parse: (raw: unknown) => {
        // Parse CSV to object
        return parsed;
    },
};

const accessor = Inline.withParserIntegration(csvIntegration).fromAny(csvString);
```

## API Reference

### `Inline` Facade

#### Static Factory Methods

| Method                        | Input                              | Returns              |
| ----------------------------- | ---------------------------------- | -------------------- |
| `fromArray(data)`             | Array / plain object               | `ArrayAccessor`      |
| `fromObject(data)`            | Object                             | `ObjectAccessor`     |
| `fromJson(data)`              | JSON `string`                      | `JsonAccessor`       |
| `fromXml(data)`               | XML `string` or `SimpleXMLElement` | `XmlAccessor`        |
| `fromYaml(data)`              | YAML `string`                      | `YamlAccessor`       |
| `fromIni(data)`               | INI `string`                       | `IniAccessor`        |
| `fromEnv(data)`               | dotenv `string`                    | `EnvAccessor`        |
| `fromNdjson(data)`            | NDJSON `string`                    | `NdjsonAccessor`     |
| `fromAny(data, integration?)` | Any format                         | `AnyAccessor`        |
| `from(typeFormat, data)`      | `TypeFormat` enum                  | `AccessorsInterface` |
| `make(accessorClass, data)`   | Accessor class                     | `AbstractAccessor`   |

#### Accessor Read Methods

| Method                      | Returns                                 |
| --------------------------- | --------------------------------------- |
| `get(path, default?)`       | Value at path, or default               |
| `getOrFail(path)`           | Value or throws `PathNotFoundException` |
| `getAt(segments, default?)` | Value at key segments                   |
| `has(path)`                 | `boolean`                               |
| `hasAt(segments)`           | `boolean`                               |
| `getMany(paths)`            | `Record<string, unknown>`               |
| `all()`                     | All parsed data                         |
| `count(path?)`              | Element count                           |
| `keys(path?)`               | Key names                               |
| `getRaw()`                  | Original input                          |

#### Accessor Write Methods (immutable)

| Method                   | Description            |
| ------------------------ | ---------------------- |
| `set(path, value)`       | Set at path            |
| `setAt(segments, value)` | Set at key segments    |
| `remove(path)`           | Remove at path         |
| `removeAt(segments)`     | Remove at key segments |
| `merge(path, value)`     | Deep-merge at path     |
| `mergeAll(value)`        | Deep-merge at root     |

#### Modifier Methods

| Method            | Description                |
| ----------------- | -------------------------- |
| `readonly(flag?)` | Block all writes           |
| `strict(flag?)`   | Toggle security validation |

#### TypeFormat Enum

`Array` · `Object` · `Json` · `Xml` · `Yaml` · `Ini` · `Env` · `Ndjson` · `Any`

## Comparison

| Feature                   | Safe Access Inline | `lodash.get` | Laravel `data_get` | `jmespath`  |
| ------------------------- | ------------------ | ------------ | ------------------ | ----------- |
| Language                  | PHP + TypeScript   | JavaScript   | PHP                | Multi       |
| Security validation       | Built-in           | None         | None               | None        |
| Forbidden key blocking    | Yes                | No           | No                 | No          |
| Payload size limits       | Yes                | No           | No                 | No          |
| Immutable writes          | Yes                | No           | No                 | N/A         |
| Readonly mode             | Yes                | No           | No                 | N/A         |
| JSON support              | Yes                | Manual       | Manual             | Manual      |
| YAML / XML / INI / ENV    | Yes                | No           | No                 | No          |
| Multiple formats          | 9 formats          | Object only  | Array only         | Object only |
| Custom format integration | Yes                | No           | No                 | No          |
| Wildcard / Filter         | Yes                | No           | Partial (`*`)      | Yes         |
| Type-safe (TypeScript)    | Strict mode        | `any`        | N/A                | `any`       |
| Zero prod dependencies    | Yes                | lodash       | Laravel            | jmespath    |

## Project Structure

```
packages/php/   - PHP package (PSR-4, Pest, PHPStan, Infection)
packages/js/    - TypeScript package (ESM, Vitest, Stryker)
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup, commit conventions, and pull request guidelines.

## License

[MIT](LICENSE) © Felipe Sauer
