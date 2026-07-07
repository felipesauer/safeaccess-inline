<?php

declare(strict_types=1);

namespace SafeAccess\Inline\Exceptions;

/**
 * Thrown when the internal TOML parser encounters a syntax or safety error.
 *
 * Specialized subclass of {@see InvalidFormatException} for TOML-specific
 * errors such as duplicate keys, redefined tables, unterminated strings or
 * arrays, and nesting that exceeds the configured depth.
 *
 * @api
 *
 * @see \SafeAccess\Inline\Parser\Toml\TomlParser   Internal parser that throws this exception.
 * @see InvalidFormatException  Parent exception class.
 *
 * @example
 * throw new TomlParseException('Duplicate key "host" (line 4).');
 */
class TomlParseException extends InvalidFormatException
{
    /**
     * Create a new TOML parse exception.
     *
     * @param string          $message  Description of the TOML parsing error.
     * @param int             $code     Application-specific error code.
     * @param \Throwable|null $previous Previous exception for chaining.
     */
    public function __construct(string $message, int $code = 0, ?\Throwable $previous = null)
    {
        parent::__construct($message, $code, $previous);
    }
}
