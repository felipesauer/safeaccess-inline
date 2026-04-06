<?php

declare(strict_types=1);

namespace SafeAccess\Inline\Accessors\Formats;

use SafeAccess\Inline\Accessors\AbstractAccessor;
use SafeAccess\Inline\Exceptions\InvalidFormatException;
use SafeAccess\Inline\Exceptions\SecurityException;

/**
 * Accessor for PHP objects converted to arrays.
 *
 * Recursively transforms objects into associative arrays using
 * `get_object_vars()` without JSON roundtrip. Handles nested
 * objects and arrays of objects.
 *
 * @api
 */
final class ObjectAccessor extends AbstractAccessor
{
    /**
     * Hydrate from a PHP object.
     *
     * @param mixed $data Object input.
     *
     * @return static Populated accessor instance.
     *
     * @throws \SafeAccess\Inline\Exceptions\InvalidFormatException When input is not an object.
     * @throws \SafeAccess\Inline\Exceptions\SecurityException          When data contains forbidden keys or exceeds depth limit.
     */
    public function from(mixed $data): static
    {
        if (!is_object($data)) {
            throw new InvalidFormatException(
                'ObjectAccessor expects an object, got ' . gettype($data)
            );
        }

        return $this->raw($data);
    }

    /** {@inheritDoc} */
    protected function parse(mixed $raw): array
    {
        assert(is_object($raw));

        return $this->objectToArray($raw, 0);
    }

    /**
     * Recursively convert an object to an associative array.
     *
     * @param object $value Object to convert.
     * @param int    $depth Current recursion depth.
     *
     * @return array<string, mixed> Converted array.
     *
     * @throws \SafeAccess\Inline\Exceptions\SecurityException When recursion depth exceeds the configured maximum.
     */
    private function objectToArray(object $value, int $depth = 0): array
    {
        $maxDepth = $this->dotNotationParser->getMaxDepth();
        if ($depth > $maxDepth) {
            throw new SecurityException(
                "Object depth {$depth} exceeds maximum of {$maxDepth}."
            );
        }

        $vars = get_object_vars($value);
        $result = [];

        foreach ($vars as $key => $val) {
            if (is_object($val)) {
                $result[$key] = $this->objectToArray($val, $depth + 1);
            } elseif (is_array($val)) {
                $result[$key] = $this->convertArrayValues($val, $depth + 1);
            } else {
                $result[$key] = $val;
            }
        }

        // keys are always strings — get_object_vars() guarantees it; PHPStan loses the constraint through the recursive call
        /** @var array<string, mixed> $typed */
        $typed = $result;

        return $typed;
    }

    /**
     * Recursively convert nested arrays containing objects.
     *
     * @param array<mixed> $array Array to process.
     * @param int          $depth Current recursion depth.
     *
     * @return array<mixed> Array with all objects converted.
     *
     * @throws \SafeAccess\Inline\Exceptions\SecurityException When recursion depth exceeds the configured maximum.
     */
    private function convertArrayValues(array $array, int $depth = 0): array
    {
        $maxDepth = $this->dotNotationParser->getMaxDepth();
        if ($depth > $maxDepth) {
            throw new SecurityException(
                "Object depth {$depth} exceeds maximum of {$maxDepth}."
            );
        }

        $result = [];
        foreach ($array as $key => $val) {
            if (is_object($val)) {
                $result[$key] = $this->objectToArray($val, $depth + 1);
            } elseif (is_array($val)) {
                $result[$key] = $this->convertArrayValues($val, $depth + 1);
            } else {
                $result[$key] = $val;
            }
        }
        return $result;
    }
}
