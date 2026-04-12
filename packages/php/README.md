<p align="center">
  <img src="https://raw.githubusercontent.com/felipesauer/safeaccess-inline/main/.github/assets/logo.svg" width="80" alt="safeaccess-inline logo">
</p>

<h1 align="center">Safe Access Inline — PHP</h1>

<p align="center">
  <a href="https://packagist.org/packages/safeaccess/inline"><img src="https://img.shields.io/packagist/v/safeaccess/inline?label=packagist" alt="Packagist"></a>
  <a href="../../LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="License: MIT"></a>
  <img src="https://img.shields.io/badge/PHP-8.2%2B-777BB4?logo=php&logoColor=white" alt="PHP 8.2+">
  <img src="https://img.shields.io/badge/PHPStan-max-0A6DAD" alt="PHPStan max">
  <img src="https://img.shields.io/badge/Tested%20with-Pest-FF5733" alt="Tested with Pest">
  <img src="https://img.shields.io/endpoint?url=https://gist.githubusercontent.com/felipesauer/80c602b17107f88fb17794d4d44c94fa/raw/infection-msi.json" alt="Infection MSI">
</p>

---

PHP library for safe nested data access with security validation on by default — JSON, YAML, XML, INI, ENV, NDJSON, arrays and objects. Includes a full PathQuery engine with filters, wildcards, slices, and projections. Zero production dependencies.

## The problem

Reading nested data from external sources requires more than null-safe access. You also need to defend against XXE in XML, anchor bombs in YAML, PHP magic method injection, stream wrapper abuse, superglobal access, and payload size attacks. Without a tool for this, that validation is boilerplate you write manually for every format and every endpoint.

**Without this library (XML from an external API):**

```php
libxml_disable_entity_loader(true);
$xml = simplexml_load_string($input, 'SimpleXMLElement', LIBXML_NOENT);
if ($xml === false) {
    throw new RuntimeException('Invalid XML');
}
// validate keys against magic methods, superglobals, stream wrappers...
// enforce depth and key count limits...
$host = isset($xml->database->host) ? (string) $xml->database->host : null;
```

**With this library:**

```php
$host = Inline::fromXml($input)->get('database.host');
// XXE blocked, forbidden keys validated, depth enforced — by default
```

## Installation

```bash
composer require safeaccess/inline
```

**Requirements:** PHP 8.2+, extensions: `json`, `simplexml`, `libxml`

**Optional:** `ext-yaml` for improved YAML parsing performance (a built-in minimal parser is used by default).

## Quick start

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

## Security

All public entry points validate input **by default**. Every key passes through `SecurityGuard` and `SecurityParser` before being accessible.

### What gets blocked

| Category            | Examples                                                              | Reason                                   |
| ------------------- | --------------------------------------------------------------------- | ---------------------------------------- |
| PHP magic methods   | `__construct`, `__destruct`, `__wakeup`, `__sleep`, `__toString`, ... | Prevent PHP magic behavior via data keys |
| Prototype pollution | `__proto__`, `constructor`, `prototype`                               | Prevent prototype pollution attacks      |
| PHP superglobals    | `GLOBALS`, `_GET`, `_POST`, `_COOKIE`, `_SERVER`, `_ENV`, ...         | Prevent superglobal variable access      |
| Stream wrapper URIs | `php://input`, `phar://...`, `data://...`, `file://...`               | Prevent stream wrapper injection         |

### Format-specific protections

| Format | Protection                                                              |
| ------ | ----------------------------------------------------------------------- |
| XML    | Rejects `<!DOCTYPE` — prevents XXE (XML External Entity) attacks        |
| YAML   | Blocks unsafe tags, anchors (`&`), aliases (`*`), and merge keys (`<<`) |
| All    | Forbidden key validation on every parsed key                            |

### Structural limits

| Limit                    | Default | Description                           |
| ------------------------ | ------- | ------------------------------------- |
| `maxPayloadBytes`        | 10 MB   | Maximum raw string input size         |
| `maxKeys`                | 10,000  | Maximum total key count               |
| `maxDepth`               | 512     | Maximum structural nesting depth      |
| `maxResolveDepth`        | 100     | Maximum recursion for path resolution |
| `maxCountRecursiveDepth` | 100     | Maximum recursion when counting keys  |

### Custom forbidden keys

```php
$guard = new SecurityGuard(extraForbiddenKeys: ['secret', 'internal_token']);
$accessor = Inline::withSecurityGuard($guard)->fromJson($data);
```

### Disabling validation for trusted input

```php
$accessor = Inline::withStrictMode(false)->fromJson($trustedPayload);
```

> **Warning:** Disabling strict mode skips **all** validation. Only use with application-controlled input.

For vulnerability reports, see [SECURITY.md](../../SECURITY.md).

## Dot notation syntax

### Basic syntax

| Syntax            | Example            | Description                     |
| ----------------- | ------------------ | ------------------------------- |
| `key.key`         | `user.name`        | Nested key access               |
| `key.0.key`       | `users.0.name`     | Numeric key (array index)       |
| `key\.with\.dots` | `config\.db\.host` | Escaped dots in key names       |
| `$` or `$.path`   | `$.user.name`      | Optional root prefix (stripped) |

```php
$data = Inline::fromJson('{"users": [{"name": "Alice"}, {"name": "Bob"}]}');
$data->get('users.0.name'); // 'Alice'
$data->get('users.1.name'); // 'Bob'
```

### Advanced PathQuery

| Syntax          | Example             | Description                               |
| --------------- | ------------------- | ----------------------------------------- |
| `[0]`           | `users[0]`          | Bracket index access                      |
| `*` or `[*]`    | `users.*`           | Wildcard — expand all children            |
| `..key`         | `..name`            | Recursive descent — find key at any depth |
| `..['a','b']`   | `..['name','age']`  | Multi-key recursive descent               |
| `[0,1,2]`       | `users[0,1,2]`      | Multi-index selection                     |
| `['a','b']`     | `['name','age']`    | Multi-key selection                       |
| `[0:5]`         | `items[0:5]`        | Slice — indices 0 through 4               |
| `[::2]`         | `items[::2]`        | Slice with step                           |
| `[::-1]`        | `items[::-1]`       | Reverse slice                             |
| `[?expr]`       | `users[?age>18]`    | Filter predicate expression               |
| `.{fields}`     | `.{name, age}`      | Projection — select fields                |
| `.{alias: src}` | `.{fullName: name}` | Aliased projection                        |

### Filter expressions

```php
$data = Inline::fromJson('[
    {"name": "Alice", "age": 25, "role": "admin"},
    {"name": "Bob",   "age": 17, "role": "user"},
    {"name": "Carol", "age": 30, "role": "admin"}
]');

// Comparison: ==, !=, >, <, >=, <=
$data->get('[?age>18]');                          // Alice and Carol

// Logical: && and ||
$data->get('[?age>18 && role==\'admin\']');       // Alice and Carol

// Built-in functions: starts_with, contains, values
$data->get('[?starts_with(@.name, \'A\')]');      // Alice
$data->get('[?contains(@.name, \'ob\')]');        // Bob

// Arithmetic: +, -, *, /
$orders = Inline::fromJson('[{"price": 10, "qty": 5}, {"price": 3, "qty": 2}]');
$orders->get('[?@.price * @.qty > 20]');          // first order only
```

## Supported formats

<details>
<summary><strong>JSON</strong></summary>

```php
$accessor = Inline::fromJson('{"users": [{"name": "Alice"}, {"name": "Bob"}]}');
$accessor->get('users.0.name'); // 'Alice'
```

</details>

<details>
<summary><strong>YAML</strong></summary>

```php
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

</details>

<details>
<summary><strong>XML</strong></summary>

```php
$xml = '<config><database><host>localhost</host></database></config>';
$accessor = Inline::fromXml($xml);
$accessor->get('database.host'); // 'localhost'

// Also accepts SimpleXMLElement
$accessor = Inline::fromXml(simplexml_load_string($xml));
```

</details>

<details>
<summary><strong>INI</strong></summary>

```php
$accessor = Inline::fromIni("[database]\nhost=localhost\nport=5432");
$accessor->get('database.host'); // 'localhost'
```

</details>

<details>
<summary><strong>ENV (dotenv)</strong></summary>

```php
$accessor = Inline::fromEnv("APP_NAME=MyApp\nAPP_DEBUG=true\nDB_HOST=localhost");
$accessor->get('DB_HOST'); // 'localhost'
```

</details>

<details>
<summary><strong>NDJSON</strong></summary>

```php
$ndjson = '{"id":1,"name":"Alice"}' . "\n" . '{"id":2,"name":"Bob"}';
$accessor = Inline::fromNdjson($ndjson);
$accessor->get('0.name'); // 'Alice'
$accessor->get('1.name'); // 'Bob'
```

</details>

<details>
<summary><strong>Array / Object</strong></summary>

```php
$accessor = Inline::fromArray(['users' => [['name' => 'Alice'], ['name' => 'Bob']]]);
$accessor->get('users.0.name'); // 'Alice'

$accessor = Inline::fromObject((object) ['name' => 'Alice']);
$accessor->get('name'); // 'Alice'
```

</details>

<details>
<summary><strong>Any (custom format via integration)</strong></summary>

```php
use SafeAccess\Inline\Contracts\ParseIntegrationInterface;

// Requires implementing ParseIntegrationInterface
$accessor = Inline::withParserIntegration(new MyCsvIntegration())->fromAny($csvString);
$accessor->get('0.column_name');
```

</details>

<details>
<summary><strong>Dynamic (by TypeFormat enum)</strong></summary>

```php
use SafeAccess\Inline\Enums\TypeFormat;
$accessor = Inline::from(TypeFormat::Json, '{"key": "value"}');
$accessor->get('key'); // 'value'
```

</details>

## Reading & writing

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

## Configure

### Builder pattern

```php
use SafeAccess\Inline\Inline;
use SafeAccess\Inline\Security\SecurityGuard;
use SafeAccess\Inline\Security\SecurityParser;

$accessor = Inline::withSecurityGuard(new SecurityGuard(extraForbiddenKeys: ['secret']))
    ->withSecurityParser(new SecurityParser(maxDepth: 5))
    ->withStrictMode(true)
    ->fromJson($untrustedInput);
```

### Builder methods

| Method                                | Description                                      |
| ------------------------------------- | ------------------------------------------------ |
| `withSecurityGuard($guard)`           | Custom forbidden-key rules and depth limits      |
| `withSecurityParser($parser)`         | Custom payload size and structural limits        |
| `withPathCache($cache)`               | Path segment cache for repeated lookups          |
| `withParserIntegration($integration)` | Custom format parser for `fromAny()`             |
| `withStrictMode(false)`               | Disable security validation (trusted input only) |

## Error handling

All exceptions extend `AccessorException`:

```php
use SafeAccess\Inline\Exceptions\AccessorException;
use SafeAccess\Inline\Exceptions\InvalidFormatException;
use SafeAccess\Inline\Exceptions\SecurityException;
use SafeAccess\Inline\Exceptions\PathNotFoundException;
use SafeAccess\Inline\Exceptions\ReadonlyViolationException;

try {
    $accessor = Inline::fromJson($untrustedInput);
    $value = $accessor->getOrFail('config.key');
} catch (InvalidFormatException $e) {
    // Malformed JSON, XML, INI, or NDJSON
} catch (SecurityException $e) {
    // Forbidden key, payload too large, depth/key-count exceeded
} catch (PathNotFoundException $e) {
    // Path does not exist
} catch (ReadonlyViolationException $e) {
    // Write on readonly accessor
} catch (AccessorException $e) {
    // Catch-all for any library error
}
```

### Exception hierarchy

| Exception                    | Extends                  | When                                      |
| ---------------------------- | ------------------------ | ----------------------------------------- |
| `AccessorException`          | `RuntimeException`       | Root — catch-all                          |
| `SecurityException`          | `AccessorException`      | Forbidden key, payload, structural limits |
| `InvalidFormatException`     | `AccessorException`      | Malformed JSON, XML, INI, NDJSON          |
| `YamlParseException`         | `InvalidFormatException` | Unsafe or malformed YAML                  |
| `PathNotFoundException`      | `AccessorException`      | `getOrFail()` on missing path             |
| `ReadonlyViolationException` | `AccessorException`      | Write on readonly accessor                |
| `UnsupportedTypeException`   | `AccessorException`      | Unknown accessor class in `make()`        |
| `ParserException`            | `AccessorException`      | Internal parser errors                    |

## Advanced usage

### Strict mode

```php
// Disable all security validation for trusted input
$accessor = Inline::withStrictMode(false)->fromJson($trustedPayload);
```

> **Warning:** Disabling strict mode skips **all** validation. Only use with application-controlled input.

### Path cache

```php
// Implement PathCacheInterface for repeated lookups
$cache = new MyPathCache();
$accessor = Inline::withPathCache($cache)->fromJson($data);
$accessor->get('deeply.nested.path'); // parses path
$accessor->get('deeply.nested.path'); // cache hit
```

### Custom format integration

```php
// Implement ParseIntegrationInterface for custom formats
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

## API reference

### `Inline` facade

#### Static factory methods

| Method                          | Input                              | Returns              |
| ------------------------------- | ---------------------------------- | -------------------- |
| `fromArray($data)`              | `array<array-key, mixed>`          | `ArrayAccessor`      |
| `fromObject($data)`             | `object`                           | `ObjectAccessor`     |
| `fromJson($data)`               | JSON `string`                      | `JsonAccessor`       |
| `fromXml($data)`                | XML `string` or `SimpleXMLElement` | `XmlAccessor`        |
| `fromYaml($data)`               | YAML `string`                      | `YamlAccessor`       |
| `fromIni($data)`                | INI `string`                       | `IniAccessor`        |
| `fromEnv($data)`                | dotenv `string`                    | `EnvAccessor`        |
| `fromNdjson($data)`             | NDJSON `string`                    | `NdjsonAccessor`     |
| `fromAny($data, $integration?)` | `mixed`                            | `AnyAccessor`        |
| `from($typeFormat, $data)`      | `TypeFormat` enum                  | `AccessorsInterface` |
| `make($class, $data)`           | `class-string`                     | `AbstractAccessor`   |

#### Accessor read methods

| Method                        | Returns                                 |
| ----------------------------- | --------------------------------------- |
| `get($path, $default?)`       | Value at path, or default               |
| `getOrFail($path)`            | Value or throws `PathNotFoundException` |
| `getAt($segments, $default?)` | Value at key segments                   |
| `has($path)`                  | `bool`                                  |
| `hasAt($segments)`            | `bool`                                  |
| `getMany($paths)`             | `array<string, mixed>`                  |
| `all()`                       | `array<string, mixed>`                  |
| `count($path?)`               | `int`                                   |
| `keys($path?)`                | `list<string>`                          |
| `getRaw()`                    | `mixed`                                 |

#### Accessor write methods (immutable)

| Method                     | Description            |
| -------------------------- | ---------------------- |
| `set($path, $value)`       | Set at path            |
| `setAt($segments, $value)` | Set at key segments    |
| `remove($path)`            | Remove at path         |
| `removeAt($segments)`      | Remove at key segments |
| `merge($path, $value)`     | Deep-merge at path     |
| `mergeAll($value)`         | Deep-merge at root     |

#### Modifier methods

| Method             | Description                |
| ------------------ | -------------------------- |
| `readonly($flag?)` | Block all writes           |
| `strict($flag?)`   | Toggle security validation |

#### TypeFormat enum

`Array` · `Object` · `Json` · `Xml` · `Yaml` · `Ini` · `Env` · `Ndjson` · `Any`

## Contributing

See [CONTRIBUTING.md](../../CONTRIBUTING.md) for development setup, commit conventions, and pull request guidelines.

## License

[MIT](../../LICENSE) © Felipe Sauer
