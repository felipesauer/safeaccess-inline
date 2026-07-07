<?php

declare(strict_types=1);

namespace SafeAccess\Inline\Exceptions;

use SafeAccess\Inline\Schema\SchemaError;

/**
 * Thrown by `assert()` when data does not satisfy the given schema.
 *
 * Carries the full list of validation failures and aggregates them into the
 * exception message.
 *
 * @api
 *
 * @see AccessorException  Parent exception class.
 * @see \SafeAccess\Inline\Schema\SchemaValidator  Producer of the failures.
 *
 * @example
 * try {
 *     Inline::fromJson($json)->assert(['user.age' => 'int']);
 * } catch (SchemaValidationException $e) {
 *     foreach ($e->getErrors() as $error) { ... }
 * }
 */
class SchemaValidationException extends AccessorException
{
    /** @var array<int, SchemaError> The validation failures that caused this exception. */
    private readonly array $errors;

    /**
     * @param array<int, SchemaError> $errors   The schema validation failures.
     * @param int                     $code     Application-specific error code.
     * @param \Throwable|null         $previous Previous exception for chaining.
     */
    public function __construct(array $errors, int $code = 0, ?\Throwable $previous = null)
    {
        $summary = implode(' ', array_map(static fn (SchemaError $e): string => $e->message, $errors));
        parent::__construct("Schema validation failed: {$summary}", $code, $previous);
        $this->errors = $errors;
    }

    /**
     * The validation failures.
     *
     * @return array<int, SchemaError>
     */
    public function getErrors(): array
    {
        return $this->errors;
    }
}
