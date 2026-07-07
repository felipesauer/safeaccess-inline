<?php

declare(strict_types=1);

namespace SafeAccess\Inline\Schema;

/**
 * Outcome of validating data against a schema.
 *
 * Returned by {@see SchemaValidator::validate()} and the accessor's `validate`
 * method. Never thrown — inspect {@see SchemaResult::isValid()} or
 * {@see SchemaResult::errors()} to react to failures.
 *
 * @api
 *
 * @example
 * $result = Inline::fromJson($json)->validate(['user.age' => 'int']);
 * if (!$result->isValid()) {
 *     foreach ($result->errors() as $error) { ... }
 * }
 */
final class SchemaResult
{
    /**
     * @param array<int, SchemaError> $failures Validation failures; empty means valid.
     */
    public function __construct(private readonly array $failures)
    {
    }

    /**
     * Whether the data satisfied the schema.
     *
     * @return bool True when there are no validation errors.
     */
    public function isValid(): bool
    {
        return $this->failures === [];
    }

    /**
     * The validation failures.
     *
     * @return array<int, SchemaError> Error list (empty when valid).
     */
    public function errors(): array
    {
        return $this->failures;
    }
}
