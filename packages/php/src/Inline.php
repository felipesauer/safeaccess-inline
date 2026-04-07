<?php

declare(strict_types=1);

namespace SafeAccess\Inline;

use SafeAccess\Inline\Accessors\AbstractAccessor;
use SafeAccess\Inline\Accessors\Formats\AnyAccessor;
use SafeAccess\Inline\Accessors\Formats\ArrayAccessor;
use SafeAccess\Inline\Accessors\Formats\EnvAccessor;
use SafeAccess\Inline\Accessors\Formats\IniAccessor;
use SafeAccess\Inline\Accessors\Formats\JsonAccessor;
use SafeAccess\Inline\Accessors\Formats\NdjsonAccessor;
use SafeAccess\Inline\Accessors\Formats\ObjectAccessor;
use SafeAccess\Inline\Accessors\Formats\XmlAccessor;
use SafeAccess\Inline\Accessors\Formats\YamlAccessor;
use SafeAccess\Inline\Contracts\AccessorsInterface;
use SafeAccess\Inline\Contracts\ParseIntegrationInterface;
use SafeAccess\Inline\Contracts\PathCacheInterface;
use SafeAccess\Inline\Contracts\SecurityGuardInterface;
use SafeAccess\Inline\Contracts\SecurityParserInterface;
use SafeAccess\Inline\Core\InlineBuilderAccessor;
use SafeAccess\Inline\Enums\TypeFormat;
use SafeAccess\Inline\Exceptions\UnsupportedTypeException;

/**
 * Facade for creating typed data accessors fluently.
 *
 * @example
 * // Quick access via static methods
 * $value = Inline::fromJson('{"name":"Alice"}')->get('name'); // 'Alice'
 *
 * @example
 * // Builder pattern with custom security
 * $value = Inline::withSecurityGuard($guard)->fromYaml($yaml)->get('config.key');
 *
 * @api
 *
 * @method static ArrayAccessor         fromArray(array<array-key, mixed> $data)
 * @method static ObjectAccessor        fromObject(object $data)
 * @method static JsonAccessor          fromJson(string $data)
 * @method static XmlAccessor           fromXml(string|\SimpleXMLElement $data)
 * @method static YamlAccessor          fromYaml(string $data)
 * @method static IniAccessor           fromIni(string $data)
 * @method static EnvAccessor           fromEnv(string $data)
 * @method static NdjsonAccessor        fromNdjson(string $data)
 * @method static AnyAccessor           fromAny(mixed $data, ?ParseIntegrationInterface $integration = null)
 * @method static AbstractAccessor      make(string $accessorClass, mixed $data)
 * @method static AccessorsInterface    from(TypeFormat $typeFormat, mixed $data)
 * @method static static                withSecurityGuard(SecurityGuardInterface $securityGuard)
 * @method static static                withSecurityParser(SecurityParserInterface $securityParser)
 * @method static static                withPathCache(PathCacheInterface $pathCache)
 * @method static static                withParserIntegration(ParseIntegrationInterface $parseIntegration)
 * @method static static                withStrictMode(bool $strict)
 */
class Inline extends InlineBuilderAccessor
{
    /**
     * Create an ArrayAccessor from the given array.
     *
     * @param array<array-key, mixed> $data Source array.
     *
     * @return ArrayAccessor
     *
     * @throws \SafeAccess\Inline\Exceptions\SecurityException When security constraints are violated.
     *
     * @example
     * $accessor = Inline::fromArray(['name' => 'Alice']);
     * $accessor->get('name'); // 'Alice'
     */
    protected function fromArray(array $data): ArrayAccessor
    {
        return $this->builder()->array($data);
    }

    /**
     * Create an ObjectAccessor from the given object.
     *
     * @param object $data Source object (stdClass or similar).
     *
     * @return ObjectAccessor
     *
     * @throws \SafeAccess\Inline\Exceptions\SecurityException When security constraints are violated.
     */
    protected function fromObject(object $data): ObjectAccessor
    {
        return $this->builder()->object($data);
    }

    /**
     * Create a JsonAccessor from a JSON string.
     *
     * @param string $data Raw JSON string.
     *
     * @return JsonAccessor
     *
     * @throws \SafeAccess\Inline\Exceptions\InvalidFormatException When the JSON is malformed.
     * @throws \SafeAccess\Inline\Exceptions\SecurityException      When security constraints are violated.
     *
     * @example
     * $accessor = Inline::fromJson('{"key":"value"}');
     * $accessor->get('key'); // 'value'
     */
    protected function fromJson(string $data): JsonAccessor
    {
        return $this->builder()->json($data);
    }

    /**
     * Create an XmlAccessor from an XML string or SimpleXMLElement.
     *
     * @param string|\SimpleXMLElement $data Raw XML string or pre-parsed element.
     *
     * @return XmlAccessor
     *
     * @throws \SafeAccess\Inline\Exceptions\InvalidFormatException When the XML is malformed.
     * @throws \SafeAccess\Inline\Exceptions\SecurityException      When the XML contains a DOCTYPE declaration.
     */
    protected function fromXml(string|\SimpleXMLElement $data): XmlAccessor
    {
        return $this->builder()->xml($data);
    }

    /**
     * Create a YamlAccessor from a YAML string.
     *
     * @param string $data Raw YAML string.
     *
     * @return YamlAccessor
     *
     * @throws \SafeAccess\Inline\Exceptions\YamlParseException When the YAML is malformed or contains unsafe constructs.
     * @throws \SafeAccess\Inline\Exceptions\SecurityException  When security constraints are violated.
     */
    protected function fromYaml(string $data): YamlAccessor
    {
        return $this->builder()->yaml($data);
    }

    /**
     * Create an IniAccessor from an INI string.
     *
     * @param string $data Raw INI string.
     *
     * @return IniAccessor
     *
     * @throws \SafeAccess\Inline\Exceptions\InvalidFormatException When the INI is malformed.
     * @throws \SafeAccess\Inline\Exceptions\SecurityException      When security constraints are violated.
     */
    protected function fromIni(string $data): IniAccessor
    {
        return $this->builder()->ini($data);
    }

    /**
     * Create an EnvAccessor from a dotenv-formatted string.
     *
     * @param string $data Raw dotenv string.
     *
     * @return EnvAccessor
     *
     * @throws \SafeAccess\Inline\Exceptions\SecurityException When security constraints are violated.
     */
    protected function fromEnv(string $data): EnvAccessor
    {
        return $this->builder()->env($data);
    }

    /**
     * Create an NdjsonAccessor from a newline-delimited JSON string.
     *
     * @param string $data Raw NDJSON string.
     *
     * @return NdjsonAccessor
     *
     * @throws \SafeAccess\Inline\Exceptions\InvalidFormatException When any JSON line is malformed.
     * @throws \SafeAccess\Inline\Exceptions\SecurityException      When security constraints are violated.
     */
    protected function fromNdjson(string $data): NdjsonAccessor
    {
        return $this->builder()->ndjson($data);
    }

    /**
     * Create an AnyAccessor that auto-detects the data format.
     *
     * @param mixed                          $data        Raw data in any supported format.
     * @param ParseIntegrationInterface|null $integration Override integration for this call.
     *
     * @return AnyAccessor
     *
     * @throws \SafeAccess\Inline\Exceptions\InvalidFormatException When no integration is available.
     * @throws \SafeAccess\Inline\Exceptions\SecurityException      When security constraints are violated.
     */
    protected function fromAny(mixed $data, ?ParseIntegrationInterface $integration = null): AnyAccessor
    {
        return $this->builder()->any($data, $integration);
    }

    /**
     * Create a typed accessor by its class name.
     *
     * @template T of AbstractAccessor
     *
     * @param class-string<T> $accessorClass Fully-qualified accessor class.
     * @param mixed            $data          Raw data to wrap.
     *
     * @return T
     *
     * @throws \SafeAccess\Inline\Exceptions\UnsupportedTypeException When the class is not a known accessor.
     *
     * @example
     * $accessor = Inline::make(JsonAccessor::class, '{"key":"value"}');
     * $accessor->get('key'); // 'value'
     */
    protected function make(string $accessorClass, mixed $data): AbstractAccessor
    {
        $factory = $this->builder();

        /** @phpstan-ignore return.type */
        return match ($accessorClass) {
            ArrayAccessor::class  => $factory->array($data),
            ObjectAccessor::class => $factory->object($data),
            JsonAccessor::class   => $factory->json($data),
            XmlAccessor::class    => $factory->xml($data),
            YamlAccessor::class   => $factory->yaml($data),
            IniAccessor::class    => $factory->ini($data),
            EnvAccessor::class    => $factory->env($data),
            NdjsonAccessor::class => $factory->ndjson($data),
            AnyAccessor::class    => $factory->any($data),
            default               => throw new UnsupportedTypeException(
                "Unsupported accessor class: {$accessorClass}"
            ),
        };
    }

    /**
     * Create an accessor by TypeFormat enum value.
     *
     * @param TypeFormat $typeFormat Target format.
     * @param mixed      $data       Raw data to wrap.
     *
     * @return AccessorsInterface
     *
     * @throws \SafeAccess\Inline\Exceptions\InvalidFormatException When the data is malformed for the target format.
     * @throws \SafeAccess\Inline\Exceptions\SecurityException      When security constraints are violated.
     *
     * @example
     * $accessor = Inline::from(TypeFormat::Yaml, "name: Alice");
     * $accessor->get('name'); // 'Alice'
     */
    protected function from(TypeFormat $typeFormat, mixed $data): AccessorsInterface
    {
        $factory = $this->builder();

        return match ($typeFormat) {
            TypeFormat::Array  => $factory->array($data),
            TypeFormat::Object => $factory->object($data),
            TypeFormat::Json   => $factory->json($data),
            TypeFormat::Xml    => $factory->xml($data),
            TypeFormat::Yaml   => $factory->yaml($data),
            TypeFormat::Ini    => $factory->ini($data),
            TypeFormat::Env    => $factory->env($data),
            TypeFormat::Ndjson => $factory->ndjson($data),
            TypeFormat::Any    => $factory->any($data),
        };
    }
}
