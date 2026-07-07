<?php

declare(strict_types=1);

namespace SafeAccess\Inline\Exceptions;

/**
 * Thrown when the internal CSV/TSV parser encounters malformed content.
 *
 * Specialized subclass of {@see InvalidFormatException} for CSV/TSV-specific
 * errors such as duplicate header columns, a row whose field count differs
 * from the header, and unterminated quoted fields.
 *
 * @api
 *
 * @see \SafeAccess\Inline\Parser\Csv\CsvParser   Internal parser that throws this exception.
 * @see InvalidFormatException  Parent exception class.
 *
 * @example
 * throw new CsvParseException('Row 3 has 2 fields, expected 3.');
 */
class CsvParseException extends InvalidFormatException
{
    /**
     * Create a new CSV/TSV parse exception.
     *
     * @param string          $message  Description of the CSV/TSV parsing error.
     * @param int             $code     Application-specific error code.
     * @param \Throwable|null $previous Previous exception for chaining.
     */
    public function __construct(string $message, int $code = 0, ?\Throwable $previous = null)
    {
        parent::__construct($message, $code, $previous);
    }
}
