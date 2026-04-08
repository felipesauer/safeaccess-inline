<?php

declare(strict_types=1);

namespace SafeAccess\Inline\Exceptions;

/**
 * Base exception for all SafeAccess\Inline errors.
 *
 * Serves as the root of the exception hierarchy, enabling catch-all handling
 * for any error originating from data access, parsing, or security operations.
 *
 * @api
 *
 * @see InvalidFormatException  Thrown on malformed input data.
 * @see ParserException         Thrown on dot-notation parsing failures.
 * @see PathNotFoundException   Thrown when a requested path does not exist.
 * @see SecurityException       Thrown on security constraint violations.
 * @see ReadonlyViolationException Thrown on write attempts to a readonly accessor.
 * @see UnsupportedTypeException   Thrown when an unsupported format or accessor class is requested.
 *
 * @example
 * throw new AccessorException('Something went wrong.');
 */
class AccessorException extends \RuntimeException
{
    /**
     * Create a new accessor exception.
     *
     * @param string          $message  Human-readable error description.
     * @param int             $code     Application-specific error code.
     * @param \Throwable|null $previous Previous exception for chaining.
     */
    public function __construct(string $message, int $code = 0, ?\Throwable $previous = null)
    {
        parent::__construct($message, $code, $previous);
    }
}
