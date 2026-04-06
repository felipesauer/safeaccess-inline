<?php

declare(strict_types=1);

namespace SafeAccess\Inline\Tests\Mocks;

use SafeAccess\Inline\Contracts\ParseIntegrationInterface;

final class FakeParseIntegration implements ParseIntegrationInterface
{
    /**
     * @param bool         $accepts Whether assertFormat() returns true.
     * @param array<mixed> $parsed  The fixed value returned by parse().
     */
    public function __construct(
        private readonly bool $accepts = true,
        private readonly array $parsed = [],
    ) {
    }

    public function assertFormat(mixed $raw): bool
    {
        return $this->accepts;
    }

    /** @return array<mixed> */
    public function parse(mixed $raw): array
    {
        return $this->parsed;
    }
}
