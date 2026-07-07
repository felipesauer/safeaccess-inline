<?php

declare(strict_types=1);

namespace SafeAccess\Inline\Accessors\Formats;

use SafeAccess\Inline\Accessors\AbstractAccessor;
use SafeAccess\Inline\Exceptions\InvalidFormatException;
use SafeAccess\Inline\Parser\Csv\CsvParser;

/**
 * Accessor for CSV (comma-separated) strings.
 *
 * The first row is the header; each subsequent row becomes an indexed record
 * keyed by the header columns. All values are strings. Uses the internal
 * {@see CsvParser} with no external dependencies.
 *
 * @api
 *
 * @example
 * $accessor = Inline::fromCsv("name,age\nAlice,30");
 * $accessor->get('0.name'); // 'Alice'
 */
final class CsvAccessor extends AbstractAccessor
{
    /**
     * Hydrate from a CSV string.
     *
     * @param mixed $data CSV string input.
     *
     * @return static Populated accessor instance.
     *
     * @throws \SafeAccess\Inline\Exceptions\CsvParseException     When the CSV is malformed.
     * @throws \SafeAccess\Inline\Exceptions\SecurityException      When security constraints are violated.
     *
     * @example
     * $accessor = Inline::fromCsv("name,age\nAlice,30");
     * $accessor->get('0.name'); // 'Alice'
     */
    public function from(mixed $data): static
    {
        if (!is_string($data)) {
            throw new InvalidFormatException(
                'CsvAccessor expects a CSV string, got ' . gettype($data)
            );
        }

        return $this->raw($data);
    }

    /** {@inheritDoc} */
    protected function parse(mixed $raw): array
    {
        assert(is_string($raw));

        return (new CsvParser(','))->parse($raw);
    }
}
