<?php

declare(strict_types=1);

namespace SafeAccess\Inline\Contracts;

/**
 * Extended parser contract adding security validation capabilities.
 *
 * Adds structural validation and payload size assertion on top of
 * the base {@see ParserInterface} CRUD operations.
 *
 * @internal Not part of the public API — used only by AbstractAccessor internally.
 */
interface ValidatableParserInterface extends ParserInterface
{
    /**
     * Retrieve a value at the given path, throwing when not found.
     *
     * @param array<mixed> $data Source data array.
     * @param string       $path Dot-notation path.
     *
     * @return mixed Resolved value.
     *
     * @throws \SafeAccess\Inline\Exceptions\PathNotFoundException When the path does not exist.
     */
    public function getStrict(array $data, string $path): mixed;

    /**
     * Validate data structure against security constraints.
     *
     * Assert key safety, maximum keys, and structural depth
     * using configured {@see SecurityPolicy} and {@see SecurityOptions}.
     *
     * @param array<mixed> $data Data to validate.
     *
     * @throws \SafeAccess\Inline\Exceptions\SecurityException When any constraint is violated.
     */
    public function validate(array $data): void;

    /**
     * Assert that a raw string payload does not exceed size limits.
     *
     * @param string $input Raw input string to check.
     *
     * @throws \SafeAccess\Inline\Exceptions\SecurityException When the payload exceeds the configured maximum.
     */
    public function assertPayload(string $input): void;

    /**
     * Return the configured maximum structural nesting depth.
     *
     * Used by accessors that perform their own recursive traversal
     * (e.g. {@see \SafeAccess\Inline\Accessors\Formats\ObjectAccessor}) before the
     * post-parse validation step runs.
     *
     * @return int Maximum allowed structural depth.
     */
    public function getMaxDepth(): int;

    /**
     * Return the configured maximum total key count.
     *
     * Used by format parsers that enforce a document element-count limit before
     * structural traversal runs. Accessor implementations that wrap XML parsers
     * can pass this value as an upper bound to prevent document-bombing attacks.
     *
     * @return int Maximum allowed key count.
     */
    public function getMaxKeys(): int;
}
