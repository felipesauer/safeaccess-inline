<?php

declare(strict_types=1);

namespace SafeAccess\Inline\Core;

use SafeAccess\Inline\Accessors\Formats\AnyAccessor;
use SafeAccess\Inline\Accessors\Formats\ArrayAccessor;
use SafeAccess\Inline\Accessors\Formats\EnvAccessor;
use SafeAccess\Inline\Accessors\Formats\IniAccessor;
use SafeAccess\Inline\Accessors\Formats\JsonAccessor;
use SafeAccess\Inline\Accessors\Formats\NdjsonAccessor;
use SafeAccess\Inline\Accessors\Formats\ObjectAccessor;
use SafeAccess\Inline\Accessors\Formats\XmlAccessor;
use SafeAccess\Inline\Accessors\Formats\YamlAccessor;
use SafeAccess\Inline\Contracts\ParseIntegrationInterface;
use SafeAccess\Inline\Contracts\ValidatableParserInterface;
use SafeAccess\Inline\Exceptions\InvalidFormatException;

/**
 * Factory for creating typed format-specific accessors.
 *
 * Encapsulate the wiring between a parser and accessor construction,
 * providing one method per supported format. Used internally by
 * {@see \SafeAccess\Inline\Inline} to create accessors.
 *
 * @internal
 */
final class AccessorFactory
{
    /**
     * Initialize the factory with a parser, optional integration, and optional strict mode.
     *
     * @param ValidatableParserInterface     $parser             Parser for dot-notation resolution.
     * @param ParseIntegrationInterface|null $defaultIntegration Default integration for AnyAccessor.
     * @param bool|null                      $strictMode         Override strict mode for created accessors.
     */
    public function __construct(
        private readonly ValidatableParserInterface $parser,
        private readonly ?ParseIntegrationInterface $defaultIntegration = null,
        private readonly ?bool $strictMode = null,
    ) {
    }

    /**
     * Apply configured strict mode to a new accessor before hydration.
     *
     * @template T of \SafeAccess\Inline\Accessors\AbstractAccessor
     *
     * @param T $accessor Unhydrated accessor instance.
     *
     * @return T Same type with strict mode applied if configured.
     */
    private function applyOptions(\SafeAccess\Inline\Accessors\AbstractAccessor $accessor): \SafeAccess\Inline\Accessors\AbstractAccessor
    {
        if ($this->strictMode !== null) {
            /** @var T */
            return $accessor->strict($this->strictMode);
        }

        return $accessor;
    }

    /**
     * Create an ArrayAccessor from raw array data.
     *
     * @param mixed $data Source array.
     *
     * @return ArrayAccessor
     *
     * @throws \SafeAccess\Inline\Exceptions\SecurityException When security constraints are violated.
     */
    public function array(mixed $data): ArrayAccessor
    {
        return $this->applyOptions(new ArrayAccessor($this->parser))->from($data);
    }

    /**
     * Create an ObjectAccessor from a source object.
     *
     * @param mixed $data Source object.
     *
     * @return ObjectAccessor
     *
     * @throws \SafeAccess\Inline\Exceptions\SecurityException When security constraints are violated.
     */
    public function object(mixed $data): ObjectAccessor
    {
        return $this->applyOptions(new ObjectAccessor($this->parser))->from($data);
    }

    /**
     * Create a JsonAccessor from a JSON string.
     *
     * @param mixed $data Raw JSON string.
     *
     * @return JsonAccessor
     *
     * @throws \SafeAccess\Inline\Exceptions\InvalidFormatException When the JSON is malformed.
     * @throws \SafeAccess\Inline\Exceptions\SecurityException      When security constraints are violated.
     */
    public function json(mixed $data): JsonAccessor
    {
        return $this->applyOptions(new JsonAccessor($this->parser))->from($data);
    }

    /**
     * Create an XmlAccessor from an XML string or SimpleXMLElement.
     *
     * @param mixed $data Raw XML string or pre-parsed element.
     *
     * @return XmlAccessor
     *
     * @throws \SafeAccess\Inline\Exceptions\InvalidFormatException When the XML is malformed.
     * @throws \SafeAccess\Inline\Exceptions\SecurityException      When security constraints are violated.
     */
    public function xml(mixed $data): XmlAccessor
    {
        return $this->applyOptions(new XmlAccessor($this->parser))->from($data);
    }

    /**
     * Create a YamlAccessor from a YAML string.
     *
     * @param mixed $data Raw YAML string.
     *
     * @return YamlAccessor
     *
     * @throws \SafeAccess\Inline\Exceptions\YamlParseException When the YAML is malformed.
     * @throws \SafeAccess\Inline\Exceptions\SecurityException  When security constraints are violated.
     */
    public function yaml(mixed $data): YamlAccessor
    {
        return $this->applyOptions(new YamlAccessor($this->parser))->from($data);
    }

    /**
     * Create an IniAccessor from an INI string.
     *
     * @param mixed $data Raw INI string.
     *
     * @return IniAccessor
     *
     * @throws \SafeAccess\Inline\Exceptions\InvalidFormatException When the INI is malformed.
     * @throws \SafeAccess\Inline\Exceptions\SecurityException      When security constraints are violated.
     */
    public function ini(mixed $data): IniAccessor
    {
        return $this->applyOptions(new IniAccessor($this->parser))->from($data);
    }

    /**
     * Create an EnvAccessor from a dotenv-formatted string.
     *
     * @param mixed $data Raw dotenv string.
     *
     * @return EnvAccessor
     *
     * @throws \SafeAccess\Inline\Exceptions\SecurityException When security constraints are violated.
     */
    public function env(mixed $data): EnvAccessor
    {
        return $this->applyOptions(new EnvAccessor($this->parser))->from($data);
    }

    /**
     * Create an NdjsonAccessor from a newline-delimited JSON string.
     *
     * @param mixed $data Raw NDJSON string.
     *
     * @return NdjsonAccessor
     *
     * @throws \SafeAccess\Inline\Exceptions\InvalidFormatException When any JSON line is malformed.
     * @throws \SafeAccess\Inline\Exceptions\SecurityException      When security constraints are violated.
     */
    public function ndjson(mixed $data): NdjsonAccessor
    {
        return $this->applyOptions(new NdjsonAccessor($this->parser))->from($data);
    }

    /**
     * Create an AnyAccessor with automatic format detection.
     *
     * @param mixed                          $data        Raw data in any supported format.
     * @param ParseIntegrationInterface|null $integration Override integration (falls back to default).
     *
     * @return AnyAccessor
     *
     * @throws \SafeAccess\Inline\Exceptions\InvalidFormatException When no integration is available.
     */
    public function any(mixed $data, ?ParseIntegrationInterface $integration = null): AnyAccessor
    {
        $integration ??= $this->defaultIntegration;

        if ($integration === null) {
            throw new InvalidFormatException(
                'AnyAccessor requires a ParseIntegrationInterface. ' .
                'Pass one directly or configure a default via Inline::withParserIntegration($i)->fromAny($data).'
            );
        }

        return $this->applyOptions(new AnyAccessor($this->parser, $integration))->from($data);
    }
}
