<?php

declare(strict_types=1);

namespace SafeAccess\Inline\Exceptions;

/**
 * Thrown when input data does not conform to the expected format.
 *
 * Raised by format-specific accessors (JSON, XML, YAML, INI, ENV, NDJSON)
 * and by the filter parser when encountering malformed filter expressions.
 *
 * @api
 *
 * @see AccessorException       Parent exception class.
 * @see YamlParseException      Specialized subclass for YAML parsing errors.
 *
 * @example
 * throw new InvalidFormatException('Expected JSON string, got number.');
 */
class InvalidFormatException extends AccessorException
{
    /**
     * Create a new invalid-format exception.
     *
     * @param string          $message  Description of the format violation.
     * @param int             $code     Application-specific error code.
     * @param \Throwable|null $previous Previous exception for chaining.
     */
    public function __construct(string $message, int $code = 0, ?\Throwable $previous = null)
    {
        parent::__construct($message, $code, $previous);
    }
}
