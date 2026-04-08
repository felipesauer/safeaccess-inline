<?php

declare(strict_types=1);

namespace SafeAccess\Inline\Accessors\Formats;

use SafeAccess\Inline\Accessors\AbstractAccessor;
use SafeAccess\Inline\Exceptions\InvalidFormatException;

/**
 * Accessor for ENV (dotenv) formatted strings.
 *
 * Parses KEY=VALUE lines, skipping comments (#) and blank lines.
 * Strips surrounding quotes from values.
 *
 * @api
 *
 * @example
 * $accessor = Inline::fromEnv("DB_HOST=localhost\nDEBUG=true");
 * $accessor->get('DB_HOST'); // 'localhost'
 */
final class EnvAccessor extends AbstractAccessor
{
    /**
     * Hydrate from an ENV-formatted string.
     *
     * @param mixed $data ENV string input.
     *
     * @return static Populated accessor instance.
     *
     * @throws \SafeAccess\Inline\Exceptions\InvalidFormatException When input is not a string.
     * @throws \SafeAccess\Inline\Exceptions\SecurityException      When security constraints are violated.
     *
     * @example
     * $accessor = (new EnvAccessor($parser))->from("APP_ENV=production\nPORT=3000");
     */
    public function from(mixed $data): static
    {
        if (!is_string($data)) {
            throw new InvalidFormatException(
                'EnvAccessor expects an ENV string, got ' . gettype($data)
            );
        }

        return $this->raw($data);
    }

    /** {@inheritDoc} */
    protected function parse(mixed $raw): array
    {
        assert(is_string($raw));
        $result = [];
        $lines = explode("\n", $raw);

        foreach ($lines as $line) {
            $line = trim($line);

            // Skip blank lines and comments
            if ($line === '' || str_starts_with($line, '#')) {
                continue;
            }

            $eqPos = strpos($line, '=');
            if ($eqPos === false) {
                continue;
            }

            $key = trim(substr($line, 0, $eqPos));
            $value = trim(substr($line, $eqPos + 1));

            // Strip surrounding quotes
            if (
                (str_starts_with($value, '"') && str_ends_with($value, '"')) ||
                (str_starts_with($value, "'") && str_ends_with($value, "'"))
            ) {
                $value = substr($value, 1, -1);
            }

            $result[$key] = $value;
        }

        return $result;
    }
}
