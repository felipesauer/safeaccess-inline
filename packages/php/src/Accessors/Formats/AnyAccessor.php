<?php

declare(strict_types=1);

namespace SafeAccess\Inline\Accessors\Formats;

use SafeAccess\Inline\Accessors\AbstractIntegrationAccessor;
use SafeAccess\Inline\Exceptions\InvalidFormatException;

/**
 * Accessor for arbitrary formats via custom {@see SafeAccess\Inline\Contracts\ParseIntegrationInterface}.
 *
 * Delegates format detection and parsing to a user-provided integration.
 * Validates string payloads against security constraints before parsing.
 *
 * @api
 */
final class AnyAccessor extends AbstractIntegrationAccessor
{
    /**
     * Hydrate from raw data via the custom integration.
     *
     * @param mixed $data Raw input data.
     *
     * @return static Populated accessor instance.
     *
     * @throws \SafeAccess\Inline\Exceptions\InvalidFormatException When the integration rejects the format.
     * @throws \SafeAccess\Inline\Exceptions\SecurityException      When security constraints are violated.
     */
    public function from(mixed $data): static
    {
        if (!$this->integration->assertFormat($data)) {
            throw new InvalidFormatException(
                'AnyAccessor failed, got ' . gettype($data)
            );
        }

        return $this->raw($data);
    }

    /** {@inheritDoc} */
    protected function parse(mixed $raw): array
    {
        return $this->integration->parse($raw);
    }
}
