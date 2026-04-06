<?php

declare(strict_types=1);

namespace SafeAccess\Inline\Exceptions;

/**
 * Thrown when an unrecognized accessor class or format type is requested.
 *
 * Raised by {@see SafeAccess\Inline::make()} when the given class-string
 * does not match any known accessor implementation.
 *
 * @api
 *
 * @see AccessorException   Parent exception class.
 * @see \SafeAccess\Inline\Inline Facade that dispatches typed accessor creation.
 */
class UnsupportedTypeException extends AccessorException
{
    /**
     * Create a new unsupported-type exception.
     *
     * @param string          $message  Description including the unsupported type.
     * @param int             $code     Application-specific error code.
     * @param \Throwable|null $previous Previous exception for chaining.
     */
    public function __construct(string $message, int $code = 0, ?\Throwable $previous = null)
    {
        parent::__construct($message, $code, $previous);
    }
}
