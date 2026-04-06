<?php

declare(strict_types=1);

namespace SafeAccess\Inline\Exceptions;

/**
 * Thrown when a requested dot-notation path does not exist in the data.
 *
 * Raised by strict access methods such as {@see \SafeAccess\Inline\Accessors\AbstractAccessor::getOrFail()}
 * and {@see \SafeAccess\Inline\Core\DotNotationParser::getStrict()} to enforce path existence.
 *
 * @api
 *
 * @see AccessorException  Parent exception class.
 */
class PathNotFoundException extends AccessorException
{
    /**
     * Create a new path-not-found exception.
     *
     * @param string          $message  Description including the missing path.
     * @param int             $code     Application-specific error code.
     * @param \Throwable|null $previous Previous exception for chaining.
     */
    public function __construct(string $message, int $code = 0, ?\Throwable $previous = null)
    {
        parent::__construct($message, $code, $previous);
    }
}
