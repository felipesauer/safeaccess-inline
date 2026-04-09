<?php

declare(strict_types=1);

namespace SafeAccess\Inline\Accessors;

use SafeAccess\Inline\Contracts\AccessorsInterface;
use SafeAccess\Inline\Contracts\ValidatableParserInterface;
use SafeAccess\Inline\Exceptions\PathNotFoundException;
use SafeAccess\Inline\Exceptions\ReadonlyViolationException;

/**
 * Base accessor providing read, write, and lifecycle operations.
 *
 * Implements all {@see AccessorsInterface} methods with immutable clone
 * semantics for writes, optional readonly enforcement, and strict mode
 * for security validation on data ingestion.
 *
 * Subclasses must implement {@see parse()} to convert raw input into
 * a normalized associative array.
 *
 * @api
 */
abstract class AbstractAccessor implements AccessorsInterface
{
    /** @var array<string, mixed> Parsed internal data store. */
    private array $data = [];

    /** @var bool Whether mutation operations are blocked. */
    private bool $readonly = false;

    /** @var bool Whether security validation runs on data ingestion. */
    private bool $strict = true;

    /** @var mixed Original raw input before parsing. */
    private mixed $raw = null;

    /**
     * Create an accessor with its dot-notation parser dependency.
     *
     * @param ValidatableParserInterface $dotNotationParser Parser for path operations.
     */
    public function __construct(
        protected readonly ValidatableParserInterface $dotNotationParser
    ) {
    }

    /**
     * Convert raw input data into a normalized associative array.
     *
     * @param mixed $raw Raw input in the format expected by the accessor.
     *
     * @return array<string, mixed> Parsed data structure.
     *
     * @throws \SafeAccess\Inline\Exceptions\InvalidFormatException When the input is malformed.
     */
    abstract protected function parse(mixed $raw): array;

    /** {@inheritDoc} */
    abstract public function from(mixed $data): static;

    /**
     * Ingest raw data, optionally validating via strict mode.
     *
     * When strict mode is enabled (default), validates payload size for string
     * inputs and runs structural/key-safety validation on parsed data.
     *
     * @param mixed $raw Raw input data.
     *
     * @return static Same instance with data populated.
     *
     * @throws \SafeAccess\Inline\Exceptions\InvalidFormatException When the raw data cannot be parsed.
     * @throws \SafeAccess\Inline\Exceptions\SecurityException      When payload exceeds size limit, data contains forbidden keys, or violates structural limits.
     */
    protected function raw(mixed $raw): static
    {
        $this->raw = $raw;
        if ($this->strict && is_string($raw)) {
            $this->dotNotationParser->assertPayload($raw);
        }
        $parsed = $this->parse($raw);
        if ($this->strict) {
            $this->dotNotationParser->validate($parsed);
        }
        $this->data = $parsed;
        return $this;
    }

    /** {@inheritDoc} */
    public function getRaw(): mixed
    {
        return $this->raw;
    }

    /**
     * Return a clone with the given readonly state.
     *
     * @param bool $readonly Whether the clone should block mutations.
     *
     * @return static New accessor instance with the readonly state applied.
     */
    public function readonly(bool $readonly = true): static
    {
        $clone = clone $this;
        $clone->readonly = $readonly;
        return $clone;
    }

    /**
     * Return a clone with the given strict mode state.
     *
     * @param bool $strict Whether to enable strict validation.
     *
     * @return static New accessor instance with the strict mode applied.
     *
     * @security Passing `false` disables **all** {@see SecurityGuard} and
     *           {@see SecurityParser} validation (key safety, payload size,
     *           depth and key-count limits). Only call this with fully
     *           trusted, application-controlled input. Never pass untrusted
     *           external data to an accessor with strict mode disabled.
     *
     * @example
     * // Trust the input - skip all security checks
     * $accessor = (new JsonAccessor($parser))->strict(false)->from($trustedPayload);
     */
    public function strict(bool $strict = true): static
    {
        $clone = clone $this;
        $clone->strict = $strict;
        return $clone;
    }

    /**
     * Assert that the accessor is not in readonly mode.
     *
     * @throws \SafeAccess\Inline\Exceptions\ReadonlyViolationException When the accessor is readonly.
     */
    private function assertNotReadOnly(): void
    {
        if ($this->readonly) {
            throw new ReadonlyViolationException();
        }
    }

    /**
     * Create a clone with new internal data.
     *
     * @param array<string, mixed> $data New data for the clone.
     *
     * @return static Cloned accessor with updated data.
     */
    private function mutate(array $data): static
    {
        $clone = clone $this;
        $clone->data = $data;

        return $clone;
    }

    /** {@inheritDoc} */
    public function get(string $path, mixed $default = null): mixed
    {
        return $this->dotNotationParser->get($this->data, $path, $default);
    }

    /**
     * Retrieve a value or throw when the path does not exist.
     *
     * @param string $path Dot-notation path.
     *
     * @return mixed Resolved value.
     *
     * @throws \SafeAccess\Inline\Exceptions\PathNotFoundException When the path is missing.
     */
    public function getOrFail(string $path): mixed
    {
        $sentinel = new \stdClass();
        $result = $this->dotNotationParser->get($this->data, $path, $sentinel);

        if ($result === $sentinel) {
            throw new PathNotFoundException("Path '{$path}' not found.");
        }

        return $result;
    }

    /** {@inheritDoc} */
    public function getAt(array $segments, mixed $default = null): mixed
    {
        return $this->dotNotationParser->getAt($this->data, $segments, $default);
    }

    /** {@inheritDoc} */
    public function has(string $path): bool
    {
        return $this->dotNotationParser->has($this->data, $path);
    }

    /** {@inheritDoc} */
    public function hasAt(array $segments): bool
    {
        $sentinel = new \stdClass();
        return $this->dotNotationParser->getAt($this->data, $segments, $sentinel) !== $sentinel;
    }

    /** {@inheritDoc} */
    public function set(string $path, mixed $value): static
    {
        $this->assertNotReadOnly();
        return $this->mutate(
            $this->dotNotationParser->set($this->data, $path, $value)
        );
    }

    /** {@inheritDoc} */
    public function setAt(array $segments, mixed $value): static
    {
        $this->assertNotReadOnly();
        return $this->mutate(
            $this->dotNotationParser->setAt($this->data, $segments, $value)
        );
    }

    /** {@inheritDoc} */
    public function remove(string $path): static
    {
        $this->assertNotReadOnly();
        return $this->mutate(
            $this->dotNotationParser->remove($this->data, $path)
        );
    }

    /** {@inheritDoc} */
    public function removeAt(array $segments): static
    {
        $this->assertNotReadOnly();
        return $this->mutate(
            $this->dotNotationParser->removeAt($this->data, $segments)
        );
    }

    /** {@inheritDoc} */
    public function getMany(array $paths): array
    {
        $results = [];
        foreach ($paths as $path => $default) {
            $results[$path] = $this->get($path, $default);
        }

        return $results;
    }

    /** {@inheritDoc} */
    public function count(?string $path = null): int
    {
        $target = $path !== null ? $this->get($path, []) : $this->data;
        return is_array($target) || is_countable($target) ? count($target) : 0;
    }

    /** {@inheritDoc} */
    public function keys(?string $path = null): array
    {
        $target = $path !== null ? $this->get($path, []) : $this->data;
        return is_array($target) ? array_map('strval', array_keys($target)) : [];
    }

    /** {@inheritDoc} */
    public function all(): array
    {
        return $this->data;
    }

    /** {@inheritDoc} */
    public function merge(string $path, array $value): static
    {
        $this->assertNotReadOnly();
        $newData = $this->dotNotationParser->merge($this->data, $path, $value);

        return $this->mutate($newData);
    }

    /** {@inheritDoc} */
    public function mergeAll(array $value): static
    {
        $this->assertNotReadOnly();
        $newData = $this->dotNotationParser->merge($this->data, '', $value);

        return $this->mutate($newData);
    }
}
