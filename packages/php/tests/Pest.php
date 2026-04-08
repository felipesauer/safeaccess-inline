<?php

declare(strict_types=1);

use SafeAccess\Inline\Core\AccessorFactory;
use SafeAccess\Inline\Core\InlineBuilderAccessor;

/*
|--------------------------------------------------------------------------
| Test Case
|--------------------------------------------------------------------------
*/

// uses(Tests\TestCase::class)->in('Feature');

/*
|--------------------------------------------------------------------------
| Shared Helpers
|--------------------------------------------------------------------------
| Functions available to all test files.
*/

/**
 * Build a fresh AccessorFactory for use in format accessor tests.
 */
function factory(): AccessorFactory
{
    return (new InlineBuilderAccessor())->builder();
}

/*
|--------------------------------------------------------------------------
| Global Teardown
|--------------------------------------------------------------------------
| Ensures all singletons and static state are reset between tests.
*/
