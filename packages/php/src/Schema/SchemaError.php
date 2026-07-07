<?php

declare(strict_types=1);

namespace SafeAccess\Inline\Schema;

/**
 * A single schema validation failure.
 *
 * @api
 */
final class SchemaError
{
    /**
     * @param string $path     Dot-notation path that failed validation.
     * @param string $expected The rule the path was expected to satisfy (e.g. `int`, `string?`).
     * @param string $actual   The actual type found, or `missing` when the path is absent.
     * @param string $message  Human-readable description of the failure.
     */
    public function __construct(
        public readonly string $path,
        public readonly string $expected,
        public readonly string $actual,
        public readonly string $message,
    ) {
    }
}
