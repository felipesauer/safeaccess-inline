<?php

declare(strict_types=1);

namespace SafeAccess\Inline\Accessors\Formats;

use SafeAccess\Inline\Accessors\AbstractAccessor;
use SafeAccess\Inline\Exceptions\InvalidFormatException;

/**
 * Accessor for Newline-Delimited JSON (NDJSON) strings.
 *
 * Parses each non-empty line as a standalone JSON object,
 * producing an indexed array of parsed records.
 *
 * @api
 *
 * @example
 * $ndjson = "{\"id\":1}\n{\"id\":2}";
 * $accessor = Inline::fromNdjson($ndjson);
 * $accessor->get('0.id'); // 1
 */
final class NdjsonAccessor extends AbstractAccessor
{
    /**
     * Hydrate from an NDJSON string.
     *
     * @param mixed $data NDJSON string input.
     *
     * @return static Populated accessor instance.
     *
     * @throws \SafeAccess\Inline\Exceptions\InvalidFormatException When input is not a string.
     * @throws \SafeAccess\Inline\Exceptions\SecurityException      When security constraints are violated.
     *
     * @example
     * $accessor = (new NdjsonAccessor($parser))->from("{\"name\":\"Alice\"}\n{\"name\":\"Bob\"}");
     */
    public function from(mixed $data): static
    {
        if (!is_string($data)) {
            throw new InvalidFormatException(
                'NdjsonAccessor expects an NDJSON string, got ' . gettype($data)
            );
        }

        return $this->raw($data);
    }

    /** {@inheritDoc} */
    protected function parse(mixed $raw): array
    {
        assert(is_string($raw));

        $allLines = explode("\n", $raw);
        $lines = [];
        foreach ($allLines as $idx => $line) {
            $trimmed = trim($line);
            if ($trimmed !== '') {
                $lines[] = ['line' => $trimmed, 'originalLine' => $idx + 1];
            }
        }

        if (count($lines) === 0) {
            return [];
        }

        $result = [];
        $i = 0;
        foreach ($lines as $entry) {
            $decoded = json_decode($entry['line'], true);
            if (json_last_error() !== JSON_ERROR_NONE) {
                throw new InvalidFormatException(
                    'NdjsonAccessor failed to parse line ' . $entry['originalLine'] . ': ' . $entry['line']
                );
            }
            $result[$i] = $decoded;
            $i++;
        }

        return $result;
    }
}
