<?php

declare(strict_types=1);

namespace SafeAccess\Inline\Tests\Mocks;

use SafeAccess\Inline\Contracts\PathCacheInterface;

final class FakePathCache implements PathCacheInterface
{
    /** @var array<string, array<int, array<string, mixed>>> */
    public array $store = [];

    public int $getCallCount = 0;

    public int $setCallCount = 0;

    public function get(string $path): ?array
    {
        $this->getCallCount++;
        return $this->store[$path] ?? null;
    }

    public function set(string $path, array $segments): void
    {
        $this->setCallCount++;
        $this->store[$path] = $segments;
    }

    public function has(string $path): bool
    {
        return isset($this->store[$path]);
    }

    public function clear(): static
    {
        $this->store = [];
        return $this;
    }
}
