<?php

declare(strict_types=1);

namespace SafeAccess\Inline\Accessors\Formats;

use SafeAccess\Inline\Accessors\AbstractAccessor;
use SafeAccess\Inline\Exceptions\InvalidFormatException;
use SafeAccess\Inline\Parser\Toml\TomlParser;

/**
 * Accessor for TOML-encoded strings.
 *
 * Uses the internal {@see TomlParser} for safe TOML parsing without depending
 * on an external TOML library. Duplicate keys, redefined tables, and nesting
 * beyond the configured depth are rejected as unsafe or malformed.
 *
 * @api
 *
 * @example
 * $accessor = Inline::fromToml("[server]\nhost = \"0.0.0.0\"");
 * $accessor->get('server.host'); // '0.0.0.0'
 */
final class TomlAccessor extends AbstractAccessor
{
    /**
     * Hydrate from a TOML string.
     *
     * @param mixed $data TOML string input.
     *
     * @return static Populated accessor instance.
     *
     * @throws \SafeAccess\Inline\Exceptions\TomlParseException    When the TOML is malformed or contains rejected constructs.
     * @throws \SafeAccess\Inline\Exceptions\SecurityException      When security constraints are violated.
     *
     * @example
     * $accessor = Inline::fromToml("name = \"Alice\"\nage = 30");
     * $accessor->get('name'); // 'Alice'
     */
    public function from(mixed $data): static
    {
        if (!is_string($data)) {
            throw new InvalidFormatException(
                'TomlAccessor expects a TOML string, got ' . gettype($data)
            );
        }

        return $this->raw($data);
    }

    /** {@inheritDoc} */
    protected function parse(mixed $raw): array
    {
        assert(is_string($raw));

        // TomlParseException extends InvalidFormatException and is the only
        // exception TomlParser (final class) can throw - no catch needed.
        return (new TomlParser($this->dotNotationParser->getMaxDepth()))->parse($raw);
    }
}
