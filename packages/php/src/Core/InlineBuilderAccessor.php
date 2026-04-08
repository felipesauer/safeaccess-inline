<?php

declare(strict_types=1);

namespace SafeAccess\Inline\Core;

use SafeAccess\Inline\Cache\SimplePathCache;
use SafeAccess\Inline\Contracts\ParseIntegrationInterface;
use SafeAccess\Inline\Contracts\PathCacheInterface;
use SafeAccess\Inline\Contracts\SecurityGuardInterface;
use SafeAccess\Inline\Contracts\SecurityParserInterface;
use SafeAccess\Inline\PathQuery\SegmentFilterParser;
use SafeAccess\Inline\PathQuery\SegmentParser;
use SafeAccess\Inline\PathQuery\SegmentPathResolver;
use SafeAccess\Inline\Security\SecurityGuard;
use SafeAccess\Inline\Security\SecurityParser;

/**
 * Builder for configuring and constructing the internal components of SafeAccess\Inline.
 *
 * @internal
 * @phpstan-consistent-constructor
 *
 * @see \SafeAccess\Inline\Inline
 */
class InlineBuilderAccessor
{
    /** @var SecurityGuardInterface|null Custom key-safety guard override. */
    private ?SecurityGuardInterface $securityGuard = null;

    /** @var SecurityParserInterface|null Custom structural security parser override. */
    private ?SecurityParserInterface $securityParser = null;

    /** @var PathCacheInterface|null Custom path-segment cache override. */
    private ?PathCacheInterface $pathCache = null;

    /** @var ParseIntegrationInterface|null Custom format integration for AnyAccessor. */
    private ?ParseIntegrationInterface $parseIntegration = null;

    /** @var bool|null Strict mode override for created accessors. */
    private ?bool $strictMode = null;

    /**
     * Dispatch static calls to a default instance.
     *
     * Allows every protected instance method to be called statically,
     * e.g. {@see \SafeAccess\Inline\Inline::fromArray([...])} or
     * {@see \SafeAccess\Inline\Inline::make(...)}.
     *
     * @param string  $name      Method name.
     * @param mixed[] $arguments Method arguments.
     *
     * @return mixed
     */
    public static function __callStatic(string $name, array $arguments): mixed
    {
        return (new static())->$name(...$arguments);
    }

    /**
     * Dispatch instance calls to protected methods.
     *
     * Allows external code to call protected methods via the magic proxy,
     * enabling both {@see __callStatic()} and direct instance chaining
     * (e.g. `Inline::withSecurityGuard($guard)->fromJson($data)`).
     *
     * @param string  $name      Method name.
     * @param mixed[] $arguments Method arguments.
     *
     * @return mixed
     */
    public function __call(string $name, array $arguments): mixed
    {
        return $this->$name(...$arguments);
    }

    /**
     * Initialize the builder with default or provided components.
     *
     * @return AccessorFactory Configured factory ready to create typed accessors.
     */
    public function builder(): AccessorFactory
    {
        $securityGuard = $this->securityGuard ?? new SecurityGuard();

        $segmentFilterParser = new SegmentFilterParser($securityGuard);
        $segmentParser = new SegmentParser($segmentFilterParser);
        $segmentPathResolver = new SegmentPathResolver($segmentFilterParser);

        $dotNotationParser = new DotNotationParser(
            $securityGuard,
            $this->securityParser ?? new SecurityParser(),
            $this->pathCache ?? new SimplePathCache(),
            $segmentParser,
            $segmentPathResolver,
        );

        return new AccessorFactory($dotNotationParser, $this->parseIntegration, $this->strictMode);
    }

    /**
     * Set a custom parser integration implementation.
     *
     * @param ParseIntegrationInterface $parseIntegration Custom format integration to use.
     *
     * @return static New builder instance with the integration configured.
     */
    protected function withParserIntegration(ParseIntegrationInterface $parseIntegration): static
    {
        $clone = clone $this;
        $clone->parseIntegration = $parseIntegration;
        return $clone;
    }

    /**
     * Set a custom security guard implementation.
     *
     * @param SecurityGuardInterface $securityGuard Custom guard implementation to use.
     *
     * @return static New builder instance with the guard configured.
     */
    protected function withSecurityGuard(SecurityGuardInterface $securityGuard): static
    {
        $clone = clone $this;
        $clone->securityGuard = $securityGuard;
        return $clone;
    }

    /**
     * Set a custom security parser implementation.
     *
     * @param SecurityParserInterface $securityParser Custom parser implementation to use.
     *
     * @return static New builder instance with the parser configured.
     */
    protected function withSecurityParser(SecurityParserInterface $securityParser): static
    {
        $clone = clone $this;
        $clone->securityParser = $securityParser;
        return $clone;
    }

    /**
     * Set a custom path cache implementation.
     *
     * @param PathCacheInterface $pathCache Custom cache implementation to use.
     *
     * @return static New builder instance with the cache configured.
     */
    protected function withPathCache(PathCacheInterface $pathCache): static
    {
        $clone = clone $this;
        $clone->pathCache = $pathCache;
        return $clone;
    }

    /**
     * Set the strict mode for all accessors created by this builder.
     *
     * @param bool $strict Whether to enable strict security validation.
     *
     * @return static New builder instance with the strict mode configured.
     *
     * @security Passing `false` disables all SecurityGuard and SecurityParser
     *           validation (key safety, payload size, depth and key-count limits).
     *           Only use with fully trusted, application-controlled input.
     */
    protected function withStrictMode(bool $strict): static
    {
        $clone = clone $this;
        $clone->strictMode = $strict;
        return $clone;
    }
}
