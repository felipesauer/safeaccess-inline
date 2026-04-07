<?php

declare(strict_types=1);

namespace SafeAccess\Inline\Accessors;

use SafeAccess\Inline\Contracts\ParseIntegrationInterface;
use SafeAccess\Inline\Contracts\ValidatableParserInterface;

/**
 * Base accessor with custom format integration support.
 *
 * Extends {@see AbstractAccessor} to inject a {@see ParseIntegrationInterface}
 * for user-defined format detection and parsing. Used exclusively by
 * {@see SafeAccess\Inline\Accessors\Formats\AnyAccessor} to handle arbitrary input formats.
 *
 * @internal
 */
abstract class AbstractIntegrationAccessor extends AbstractAccessor
{
    /**
     * Create an accessor with parser and custom integration dependencies.
     *
     * @param ValidatableParserInterface $parser      Dot-notation parser.
     * @param ParseIntegrationInterface  $integration Custom format parser.
     */
    public function __construct(
        ValidatableParserInterface $parser,
        protected readonly ParseIntegrationInterface $integration,
    ) {
        parent::__construct($parser);
    }
}
