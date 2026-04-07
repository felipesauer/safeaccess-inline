<?php

declare(strict_types=1);

namespace SafeAccess\Inline\PathQuery\Enums;

/**
 * Enumerate all segment types produced by the path parser.
 *
 * Each case represents a distinct addressing mode within a dot-notation
 * path expression. The {@see SegmentPathResolver} dispatches resolution
 * logic based on the segment type.
 *
 * @internal
 *
 * @see SegmentParser        Parses path strings into typed segment arrays.
 * @see SegmentPathResolver  Resolves data values from typed segments.
 */
enum SegmentType: string
{
    /** Simple key or index access (e.g. `foo`, `0`). */
    case Key = 'key';

    /** Numeric index access (e.g. `[0]`). */
    case Index = 'index';

    /** Wildcard expansion over all children (e.g. `*`, `[*]`). */
    case Wildcard = 'wildcard';

    /** Recursive descent into a single key (e.g. `..name`). */
    case Descent = 'descent';

    /** Recursive descent into multiple keys (e.g. `..["a","b"]`). */
    case DescentMulti = 'descent-multi';

    /** Multi-index selection (e.g. `[0,1,2]`). */
    case MultiIndex = 'multi-index';

    /** Multi-key selection (e.g. `['a','b']`). */
    case MultiKey = 'multi-key';

    /** Filter predicate expression (e.g. `[?age>18]`). */
    case Filter = 'filter';

    /** Array slice notation (e.g. `[0:5]`, `[::2]`). */
    case Slice = 'slice';

    /** Field projection (e.g. `.{name, age}`). */
    case Projection = 'projection';
}
