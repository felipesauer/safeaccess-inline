<?php

declare(strict_types=1);

namespace SafeAccess\Inline\Contracts;

/**
 * Contract for custom format detection and parsing integration.
 *
 * Enables the {@see SafeAccess\Inline\Accessors\Formats\AnyAccessor} to accept arbitrary input by delegating
 * format validation and parsing to a user-provided implementation.
 *
 * @api
 */
interface ParseIntegrationInterface
{
    /**
     * Assert whether the given raw input is in a supported format.
     *
     * @param mixed $raw Raw input data to validate.
     *
     * @return bool True if the input can be parsed.
     */
    public function assertFormat(mixed $raw): bool;

    /**
     * Parse raw input data into a normalized associative array.
     *
     * @param mixed $raw Raw input data previously validated by {@see assertFormat()}.
     *
     * @return array<string, mixed> Parsed data as a nested associative array.
     *
     * @throws \Throwable When the implementation fails to parse the data.
     */
    public function parse(mixed $raw): array;
}
