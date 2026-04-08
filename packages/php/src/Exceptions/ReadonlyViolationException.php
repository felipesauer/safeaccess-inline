<?php

declare(strict_types=1);

namespace SafeAccess\Inline\Exceptions;

/**
 * Thrown when a write operation is attempted on a readonly accessor.
 *
 * Guards the immutability contract established by
 * {@see AbstractAccessor::readonly()}. Any call to set, remove, merge,
 * or mergeAll on a readonly accessor triggers this exception.
 *
 * @api
 *
 * @see AccessorException  Parent exception class.
 *
 * @example
 * $accessor = Inline::fromJson('{}')->readonly(true);
 * $accessor->set('key', 'value'); // throws ReadonlyViolationException
 */
class ReadonlyViolationException extends AccessorException
{
    /**
     * Create a new readonly-violation exception.
     *
     * @param string          $message  Human-readable error description.
     * @param int             $code     Exception code.
     * @param \Throwable|null $previous Previous exception for chaining.
     */
    public function __construct(
        string $message = 'Cannot modify a readonly accessor.',
        int $code = 0,
        ?\Throwable $previous = null,
    ) {
        parent::__construct($message, $code, $previous);
    }
}
