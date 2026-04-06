<?php

declare(strict_types=1);

namespace SafeAccess\Inline\Benchmarks;

use PhpBench\Attributes\BeforeMethods;
use PhpBench\Attributes\Iterations;
use PhpBench\Attributes\Revs;
use SafeAccess\Inline\Accessors\Formats\ArrayAccessor;
use SafeAccess\Inline\Inline;

#[BeforeMethods('setUp')]
class GetBench
{
    private ArrayAccessor $accessor;

    public function setUp(): void
    {
        $this->accessor = (new Inline())->fromArray([
            'user' => ['profile' => ['name' => 'Alice', 'age' => 30]],
            'config' => ['debug' => false, 'version' => '1.0.0'],
            'items' => [1, 2, 3, 4, 5],
        ]);
    }

    #[Revs(1000), Iterations(5)]
    public function benchGetShallowKey(): void
    {
        $this->accessor->get('config.debug');
    }

    #[Revs(1000), Iterations(5)]
    public function benchGetDeepKey(): void
    {
        $this->accessor->get('user.profile.name');
    }

    #[Revs(1000), Iterations(5)]
    public function benchGetMissingKeyWithDefault(): void
    {
        $this->accessor->get('user.profile.missing', null);
    }

    #[Revs(5000), Iterations(5)]
    public function benchRepeatedPathWithCache(): void
    {
        $this->accessor->get('user.profile.name');
    }
}
