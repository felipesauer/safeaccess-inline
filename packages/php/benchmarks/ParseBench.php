<?php

declare(strict_types=1);

namespace SafeAccess\Inline\Benchmarks;

use PhpBench\Attributes\BeforeMethods;
use PhpBench\Attributes\Iterations;
use PhpBench\Attributes\Revs;
use SafeAccess\Inline\Inline;

#[BeforeMethods('setUp')]
class ParseBench
{
    private Inline $inline;
    private string $jsonPayload;
    private string $yamlPayload;
    private string $iniPayload;

    /** @var array<string, mixed> */
    private array $arrayPayload;

    public function setUp(): void
    {
        $this->inline = new Inline();

        $this->arrayPayload = [
            'user' => ['profile' => ['name' => 'Alice', 'age' => 30]],
            'config' => ['debug' => false, 'version' => '1.0.0'],
        ];

        $this->jsonPayload = json_encode($this->arrayPayload, JSON_THROW_ON_ERROR);

        $this->yamlPayload = "user:\n  profile:\n    name: Alice\n    age: 30\nconfig:\n  debug: false\n  version: '1.0.0'\n";

        $this->iniPayload = "[config]\ndebug=false\nversion=1.0.0\n";
    }

    #[Revs(1000), Iterations(5)]
    public function benchFromArray(): void
    {
        $this->inline->fromArray($this->arrayPayload);
    }

    #[Revs(1000), Iterations(5)]
    public function benchFromJson(): void
    {
        $this->inline->fromJson($this->jsonPayload);
    }

    #[Revs(1000), Iterations(5)]
    public function benchFromYaml(): void
    {
        $this->inline->fromYaml($this->yamlPayload);
    }

    #[Revs(1000), Iterations(5)]
    public function benchFromIni(): void
    {
        $this->inline->fromIni($this->iniPayload);
    }
}
