<?php

declare(strict_types=1);

namespace SafeAccess\Inline\Accessors\Formats;

use SafeAccess\Inline\Accessors\AbstractAccessor;
use SafeAccess\Inline\Exceptions\InvalidFormatException;

/**
 * Accessor for JSON-encoded strings.
 *
 * Decodes JSON via `json_decode()` with associative mode enabled.
 * Validates payload size before parsing.
 *
 * @api
 */
final class JsonAccessor extends AbstractAccessor
{
    /**
     * Hydrate from a JSON string.
     *
     * @param mixed $data JSON string input.
     *
     * @return static Populated accessor instance.
     *
     * @throws \SafeAccess\Inline\Exceptions\InvalidFormatException When input is not a string.
     * @throws \SafeAccess\Inline\Exceptions\SecurityException      When security constraints are violated.
     */
    public function from(mixed $data): static
    {
        if (!is_string($data)) {
            throw new InvalidFormatException(
                'JsonAccessor expects a JSON string, got ' . gettype($data)
            );
        }

        return $this->raw($data);
    }

    /** {@inheritDoc} */
    protected function parse(mixed $raw): array
    {
        assert(is_string($raw));
        $decoded = json_decode($raw, true);

        if (json_last_error() !== JSON_ERROR_NONE) {
            throw new InvalidFormatException(
                'JsonAccessor failed to parse JSON: ' . json_last_error_msg()
            );
        }

        return is_array($decoded) ? $decoded : [];
    }
}
