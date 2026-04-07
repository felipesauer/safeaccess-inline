<?php

declare(strict_types=1);

namespace SafeAccess\Inline\Contracts;

/**
 * Unified contract combining read, write, and factory capabilities.
 *
 * Marker interface that aggregates all accessor responsibilities into
 * a single type, used as the base contract for {@see SafeAccess\Inline\Accessors\AbstractAccessor}.
 *
 * @api
 */
interface AccessorsInterface extends
    ReadableAccessorsInterface,
    WritableAccessorsInterface,
    FactoryAccessorsInterface
{
}
