<?php

declare(strict_types=1);

namespace SafeAccess\Inline\Accessors\Formats;

use SafeAccess\Inline\Accessors\AbstractAccessor;
use SafeAccess\Inline\Exceptions\InvalidFormatException;
use SafeAccess\Inline\Parser\Yaml\YamlParser;

/**
 * Accessor for YAML-encoded strings.
 *
 * Uses the internal {@see YamlParser} for safe YAML parsing without
 * depending on ext-yaml. Tags, anchors, aliases, and merge keys
 * are blocked as unsafe constructs.
 *
 * @api
 */
final class YamlAccessor extends AbstractAccessor
{
    /**
     * Hydrate from a YAML string.
     *
     * @param mixed $data YAML string input.
     *
     * @return static Populated accessor instance.
     *
     * @throws \SafeAccess\Inline\Exceptions\YamlParseException    When the YAML is malformed or contains unsafe constructs.
     * @throws \SafeAccess\Inline\Exceptions\SecurityException      When security constraints are violated.
     */
    public function from(mixed $data): static
    {
        if (!is_string($data)) {
            throw new InvalidFormatException(
                'YamlAccessor expects a YAML string, got ' . gettype($data)
            );
        }

        return $this->raw($data);
    }

    /** {@inheritDoc} */
    protected function parse(mixed $raw): array
    {
        assert(is_string($raw));

        // YamlParseException extends InvalidFormatException and is the only
        // exception YamlParser (final class) can throw — no catch needed.
        return (new YamlParser())->parse($raw);
    }
}
