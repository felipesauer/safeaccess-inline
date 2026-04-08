<p align="center">
  <img src="https://raw.githubusercontent.com/felipesauer/safeaccess-inline/main/.github/assets/logo.svg" width="80" alt="safeaccess-inline logo">
</p>

<h1 align="center">Safe Access Inline - TypeScript</h1>

<p align="center">
  <a href="https://www.npmjs.com/package/@safeaccess/inline"><img src="https://img.shields.io/npm/v/@safeaccess/inline?label=npm" alt="npm"></a>
  <a href="../../LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="License: MIT"></a>
</p>

---

Safe nested data access with dot notation for JavaScript and TypeScript. Navigate deeply nested objects, JSON, YAML, XML, INI, ENV, and NDJSON structures - with built-in security validation, immutable writes, and a fluent builder API.

## Installation

```bash
npm install @safeaccess/inline
```

**Requirements:** Node.js 22+

## Quick Start

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

### Basic Syntax

| Syntax            | Example            | Description                     |
| ----------------- | ------------------ | ------------------------------- |
| `key.key`         | `user.name`        | Nested key access               |
| `key.0.key`       | `users.0.name`     | Numeric key (array index)       |
| `key\.with\.dots` | `config\.db\.host` | Escaped dots in key names       |
| `$` or `$.path`   | `$.user.name`      | Optional root prefix (stripped) |

```typescript
const data = Inline.fromJson('{"users": [{"name": "Alice"}, {"name": "Bob"}]}');
data.get('users.0.name'); // 'Alice'
data.get('users.1.name'); // 'Bob'
```

### Advanced PathQuery

| Syntax          | Example             | Description                               |
| --------------- | ------------------- | ----------------------------------------- |
| `[0]`           | `users[0]`          | Bracket index access                      |
| `*` or `[*]`    | `users.*`           | Wildcard - expand all children            |
| `..key`         | `..name`            | Recursive descent - find key at any depth |
| `..['a','b']`   | `..['name','age']`  | Multi-key recursive descent               |
| `[0,1,2]`       | `users[0,1,2]`      | Multi-index selection                     |
| `['a','b']`     | `['name','age']`    | Multi-key selection                       |
| `[0:5]`         | `items[0:5]`        | Slice - indices 0 through 4               |
| `[::2]`         | `items[::2]`        | Slice with step                           |
| `[::-1]`        | `items[::-1]`       | Reverse slice                             |
| `[?expr]`       | `users[?age>18]`    | Filter predicate expression               |
| `.{fields}`     | `.{name, age}`      | Projection - select fields                |
| `.{alias: src}` | `.{fullName: name}` | Aliased projection                        |

### Filter Expressions

```typescript
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

```typescript
const accessor = Inline.fromJson('{"users": [{"name": "Alice"}, {"name": "Bob"}]}');
accessor.get('users.0.name'); // 'Alice'
```

</details>

<details>
<summary><strong>YAML</strong></summary>

```typescript
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

```typescript
const accessor = Inline.fromXml('<config><database><host>localhost</host></database></config>');
accessor.get('database.host'); // 'localhost'
```

</details>

<details>
<summary><strong>INI</strong></summary>

```typescript
const accessor = Inline.fromIni('[database]\nhost=localhost\nport=5432');
accessor.get('database.host'); // 'localhost'
```

</details>

<details>
<summary><strong>ENV (dotenv)</strong></summary>

```typescript
const accessor = Inline.fromEnv('APP_NAME=MyApp\nDB_HOST=localhost');
accessor.get('DB_HOST'); // 'localhost'
```

</details>

<details>
<summary><strong>NDJSON</strong></summary>

```typescript
const accessor = Inline.fromNdjson('{"id":1,"name":"Alice"}\n{"id":2,"name":"Bob"}');
accessor.get('0.name'); // 'Alice'
accessor.get('1.name'); // 'Bob'
```

</details>

<details>
<summary><strong>Array / Object</strong></summary>

```typescript
const accessor = Inline.fromArray({ users: [{ name: 'Alice' }, { name: 'Bob' }] });
accessor.get('users.0.name'); // 'Alice'

const objAccessor = Inline.fromObject({ name: 'Alice', age: 30 });
objAccessor.get('name'); // 'Alice'
```

</details>

<details>
<summary><strong>Dynamic (by TypeFormat enum)</strong></summary>

```typescript
import { Inline, TypeFormat } from '@safeaccess/inline';

const accessor = Inline.from(TypeFormat.Json, '{"key": "value"}');
accessor.get('key'); // 'value'
```

</details>

## Reading & Writing

```typescript
const accessor = Inline.fromJson('{"a": {"b": 1, "c": 2}}');

// Read
accessor.get('a.b'); // 1
accessor.get('a.missing', 'default'); // 'default'
accessor.getOrFail('a.b'); // 1 (throws PathNotFoundException if missing)
accessor.has('a.b'); // true
accessor.all(); // { a: { b: 1, c: 2 } }
accessor.count(); // 1 (root keys)
accessor.count('a'); // 2 (keys under 'a')
accessor.keys(); // ['a']
accessor.keys('a'); // ['b', 'c']
accessor.getMany({
    'a.b': null,
    'a.x': 'fallback',
}); // { 'a.b': 1, 'a.x': 'fallback' }
accessor.getRaw(); // original JSON string

// Write (immutable - every write returns a new instance)
const updated = accessor.set('a.d', 3);
const cleaned = updated.remove('a.c');
const merged = cleaned.merge('a', { e: 4 });
const full = merged.mergeAll({ f: 5 });

// Readonly mode - block all writes
const readonly = accessor.readonly();
readonly.get('a.b'); // 1 (reads work)
readonly.set('a.b', 99); // throws ReadonlyViolationException
```

## Configure

### Builder Pattern

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
| `withPathCache(cache)`               | Custom path segment cache for repeated lookups   |
| `withParserIntegration(integration)` | Custom format parser for `fromAny()`             |
| `withStrictMode(false)`              | Disable security validation (trusted input only) |

## Security

All public entry points validate input **by default**. Every key passes through `SecurityGuard` and `SecurityParser`.

### Forbidden Keys

| Category                      | Examples                                                                                                     | Reason                                              |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------ | --------------------------------------------------- |
| Prototype pollution           | `__proto__`, `constructor`, `prototype`                                                                      | Prevents prototype pollution attacks                |
| Legacy prototype manipulation | `__defineGetter__`, `__defineSetter__`, `__lookupGetter__`, `__lookupSetter__`                               | Prevents legacy prototype tampering                 |
| Property shadow               | `hasOwnProperty`                                                                                             | Overriding it can bypass guard checks               |
| Node.js globals               | `__dirname`, `__filename`                                                                                    | Prevents path-injection via dynamic property access |
| Protocol / stream URIs        | `javascript:`, `blob:`, `ws://`, `wss://`, `node:`, `file://`, `http://`, `https://`, `ftp://`, `data:`, ... | Prevents URI injection and XSS vectors              |

Add custom forbidden keys:

```typescript
const guard = new SecurityGuard(512, ['secret', 'internal_token']);
const accessor = Inline.withSecurityGuard(guard).fromJson(data);
```

### Structural Limits

| Limit                    | Default | Description                           |
| ------------------------ | ------- | ------------------------------------- |
| `maxPayloadBytes`        | 10 MB   | Maximum raw string input size         |
| `maxKeys`                | 10,000  | Maximum total key count               |
| `maxDepth`               | 512     | Maximum structural nesting depth      |
| `maxResolveDepth`        | 100     | Maximum recursion for path resolution |
| `maxCountRecursiveDepth` | 100     | Maximum recursion when counting keys  |

### Format-Specific Protections

| Format | Protection                                       |
| ------ | ------------------------------------------------ |
| XML    | Rejects `<!DOCTYPE` - prevents XXE attacks       |
| YAML   | Blocks unsafe tags, anchors, aliases, merge keys |
| All    | Forbidden key validation on every parsed key     |

> Disable for trusted input: `Inline.withStrictMode(false).fromJson(trustedInput)`

For vulnerability reports, see [SECURITY.md](../../SECURITY.md).

## Error Handling

All exceptions extend `AccessorException`:

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
        // Malformed JSON, XML, INI, or NDJSON
    }
    if (e instanceof SecurityException) {
        // Forbidden key, payload too large, depth/key-count exceeded
    }
    if (e instanceof PathNotFoundException) {
        // Path does not exist
    }
    if (e instanceof ReadonlyViolationException) {
        // Write on readonly accessor
    }
    if (e instanceof AccessorException) {
        // Catch-all for any library error
    }
}
```

### Exception Hierarchy

| Exception                    | Extends                  | When                                      |
| ---------------------------- | ------------------------ | ----------------------------------------- |
| `AccessorException`          | `Error`                  | Root - catch-all                          |
| `SecurityException`          | `AccessorException`      | Forbidden key, payload, structural limits |
| `InvalidFormatException`     | `AccessorException`      | Malformed JSON, XML, INI, NDJSON          |
| `YamlParseException`         | `InvalidFormatException` | Unsafe or malformed YAML                  |
| `PathNotFoundException`      | `AccessorException`      | `getOrFail()` on missing path             |
| `ReadonlyViolationException` | `AccessorException`      | Write on readonly accessor                |
| `UnsupportedTypeException`   | `AccessorException`      | Unknown accessor class in `make()`        |
| `ParserException`            | `AccessorException`      | Internal parser errors                    |

## Advanced Usage

### Strict Mode

```typescript
// Disable all security validation for trusted input
const accessor = Inline.withStrictMode(false).fromJson(trustedPayload);
```

> **Warning:** Disabling strict mode skips **all** validation. Only use with application-controlled input.

### Path Cache

```typescript
// Implement PathCacheInterface for repeated lookups
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
accessor.get('deeply.nested.path'); // parses path
accessor.get('deeply.nested.path'); // cache hit
```

### Custom Format Integration

```typescript
// Implement ParseIntegrationInterface for custom formats
const csvIntegration: ParseIntegrationInterface = {
    assertFormat: (raw: unknown) => typeof raw === 'string' && raw.includes(','),
    parse: (raw: unknown) => {
        // Parse CSV to object
        return parsed;
    },
};

const accessor = Inline.withParserIntegration(csvIntegration).fromAny(csvString);
```

## API Reference

### Facade: `Inline`

#### Static Factory Methods

| Method                        | Input                                    | Returns              |
| ----------------------------- | ---------------------------------------- | -------------------- |
| `fromArray(data)`             | `Record<string, unknown>` or `unknown[]` | `ArrayAccessor`      |
| `fromObject(data)`            | `object`                                 | `ObjectAccessor`     |
| `fromJson(data)`              | JSON `string`                            | `JsonAccessor`       |
| `fromXml(data)`               | XML `string`                             | `XmlAccessor`        |
| `fromYaml(data)`              | YAML `string`                            | `YamlAccessor`       |
| `fromIni(data)`               | INI `string`                             | `IniAccessor`        |
| `fromEnv(data)`               | dotenv `string`                          | `EnvAccessor`        |
| `fromNdjson(data)`            | NDJSON `string`                          | `NdjsonAccessor`     |
| `fromAny(data, integration?)` | `unknown`                                | `AnyAccessor`        |
| `from(typeFormat, data)`      | `TypeFormat` enum                        | `AccessorsInterface` |
| `make(AccessorClass, data)`   | Accessor constructor                     | `AbstractAccessor`   |

#### Accessor Read Methods

| Method                      | Returns                                 |
| --------------------------- | --------------------------------------- |
| `get(path, default?)`       | Value at path, or default               |
| `getOrFail(path)`           | Value or throws `PathNotFoundException` |
| `getAt(segments, default?)` | Value at key segments                   |
| `has(path)`                 | `boolean`                               |
| `hasAt(segments)`           | `boolean`                               |
| `getMany(paths)`            | `Record<string, unknown>`               |
| `all()`                     | `Record<string, unknown>`               |
| `count(path?)`              | `number`                                |
| `keys(path?)`               | `string[]`                              |
| `getRaw()`                  | `unknown`                               |

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

## Exports

The package uses **named exports only** (no default exports). All public types are available from the main entry point:

```typescript
import {
    Inline,
    TypeFormat,
    SecurityGuard,
    SecurityParser,
    // Accessors
    AbstractAccessor,
    ArrayAccessor,
    ObjectAccessor,
    JsonAccessor,
    XmlAccessor,
    YamlAccessor,
    IniAccessor,
    EnvAccessor,
    NdjsonAccessor,
    AnyAccessor,
    // Exceptions
    AccessorException,
    SecurityException,
    InvalidFormatException,
    YamlParseException,
    ParserException,
    PathNotFoundException,
    ReadonlyViolationException,
    UnsupportedTypeException,
} from '@safeaccess/inline';

// Contracts (type-only imports)
import type {
    AccessorsInterface,
    ReadableAccessorsInterface,
    WritableAccessorsInterface,
    FactoryAccessorsInterface,
    SecurityGuardInterface,
    SecurityParserInterface,
    PathCacheInterface,
    ParseIntegrationInterface,
} from '@safeaccess/inline';
```

## Contributing

See [CONTRIBUTING.md](../../CONTRIBUTING.md) for development setup, commit conventions, and pull request guidelines.

## License

[MIT](../../LICENSE) © Felipe Sauer
