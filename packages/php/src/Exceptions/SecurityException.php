<?php

declare(strict_types=1);

namespace SafeAccess\Inline\Exceptions;

/**
 * Thrown when a security constraint is violated.
 *
 * Raised when forbidden keys are detected, payload size exceeds limits,
 * structural depth surpasses thresholds, or key count caps are breached.
 *
 * @api
 *
 * @see AccessorException                             Parent exception class.
 * @see \SafeAccess\Inline\Security\SecurityGuard     Validates keys against the forbidden list.
 * @see \SafeAccess\Inline\Security\SecurityParser    Enforces payload, depth, and key-count limits.
 */
class SecurityException extends AccessorException
{
    /**
     * Create a new security exception.
     *
     * @param string          $message  Description of the security violation.
     * @param int             $code     Application-specific error code.
     * @param \Throwable|null $previous Previous exception for chaining.
     */
    public function __construct(string $message, int $code = 0, ?\Throwable $previous = null)
    {
        parent::__construct($message, $code, $previous);
    }
}
