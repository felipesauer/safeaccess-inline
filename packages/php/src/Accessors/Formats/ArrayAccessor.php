<?php

declare(strict_types=1);

namespace SafeAccess\Inline\Accessors\Formats;

use SafeAccess\Inline\Accessors\AbstractAccessor;
use SafeAccess\Inline\Exceptions\InvalidFormatException;

/**
 * Accessor for PHP native arrays and objects cast to arrays.
 *
 * Accepts arrays directly or objects that are cast to arrays
 * via the `(array)` operator. No string parsing is involved.
 *
 * @api
 *
 * @example
 * $accessor = Inline::fromArray(['name' => 'Alice']);
 * $accessor->get('name'); // 'Alice'
 */
final class ArrayAccessor extends AbstractAccessor
{
    /**
     * Hydrate from a PHP array or object.
     *
     * @param mixed $data Array or object input.
     *
     * @return static Populated accessor instance.
     *
     * @throws \SafeAccess\Inline\Exceptions\InvalidFormatException When input is neither array nor object.
     * @throws \SafeAccess\Inline\Exceptions\SecurityException          When data contains forbidden keys.
     *
     * @example
     * $accessor = (new ArrayAccessor($parser))->from(['key' => 'value']);
     */
    public function from(mixed $data): static
    {
        if (!is_array($data) && !is_object($data)) {
            throw new InvalidFormatException(
                'ArrayAccessor expects an array or object, got ' . gettype($data)
            );
        }

        $resolved = is_array($data) ? $data : (array) $data;
        return $this->raw($resolved);
    }

    /** {@inheritDoc} */
    protected function parse(mixed $raw): array
    {
        /** @var array<mixed> $raw */
        return $raw;
    }
}
