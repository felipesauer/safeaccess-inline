<?php

declare(strict_types=1);

namespace SafeAccess\Inline\Exceptions;

/**
 * Represents a parser-level operational error.
 *
 * This exception class is reserved for custom parser implementations that
 * extend the parsing layer. The built-in dot-notation parser uses
 * {@see \SafeAccess\Inline\Exceptions\SecurityException} for depth and
 * structural limit violations.
 *
 * @api
 *
 * @see AccessorException                              Parent exception class.
 * @see \SafeAccess\Inline\Core\DotNotationParser      Built-in parser (uses SecurityException for limits).
 */
class ParserException extends AccessorException
{
    /**
     * Create a new parser exception.
     *
     * @param string          $message  Description of the parser error.
     * @param int             $code     Application-specific error code.
     * @param \Throwable|null $previous Previous exception for chaining.
     */
    public function __construct(string $message, int $code = 0, ?\Throwable $previous = null)
    {
        parent::__construct($message, $code, $previous);
    }
}
