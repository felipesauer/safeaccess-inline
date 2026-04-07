<?php

declare(strict_types=1);

namespace SafeAccess\Inline\Contracts;

/**
 * Contract for hydrating an accessor from raw input data.
 *
 * Each format-specific accessor implements this to accept its native
 * input type and return an initialized, immutable accessor instance.
 *
 * @api
 */
interface FactoryAccessorsInterface
{
    /**
     * Hydrate the accessor from raw input data.
     *
     * Note: this per-accessor `from(mixed): static` is distinct from the
     * facade dispatcher `Inline::from(TypeFormat, mixed): AccessorsInterface`.
     * IDE resolution may surface this method first; use the typed `Inline::fromJson()`,
     * `Inline::fromXml()`, etc. helpers for explicit format dispatch from the facade.
     *
     * @param mixed $data Raw input in the format expected by the accessor.
     *
     * @return static Immutable accessor instance populated with parsed data.
     *
     * @throws \SafeAccess\Inline\Exceptions\InvalidFormatException When data does not match the expected format.
     *
     * @see \SafeAccess\Inline\Inline::from() TypeFormat-based facade dispatcher.
     */
    public function from(mixed $data): static;
}
