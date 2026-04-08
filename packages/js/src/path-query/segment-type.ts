/**
 * Enumerate all segment types produced by the path parser.
 *
 * Each case represents a distinct addressing mode within a dot-notation
 * path expression. The {@link SegmentPathResolver} dispatches resolution
 * logic based on the segment type.
 *
 * @internal
 *
 * @see SegmentParser        Parses path strings into typed segment arrays.
 * @see SegmentPathResolver  Resolves data values from typed segments.
 */
export enum SegmentType {
    /** Simple key or index access (e.g. `foo`, `0`). */
    Key = 'key',

    /** Numeric index access (e.g. `[0]`). */
    Index = 'index',

    /** Wildcard expansion over all children (e.g. `*`, `[*]`). */
    Wildcard = 'wildcard',

    /** Recursive descent into a single key (e.g. `..name`). */
    Descent = 'descent',

    /** Recursive descent into multiple keys (e.g. `..["a","b"]`). */
    DescentMulti = 'descent-multi',

    /** Multi-index selection (e.g. `[0,1,2]`). */
    MultiIndex = 'multi-index',

    /** Multi-key selection (e.g. `['a','b']`). */
    MultiKey = 'multi-key',

    /** Filter predicate expression (e.g. `[?age>18]`). */
    Filter = 'filter',

    /** Array slice notation (e.g. `[0:5]`, `[::2]`). */
    Slice = 'slice',

    /** Field projection (e.g. `.{name, age}`). */
    Projection = 'projection',
}

/** Parsed filter expression structure. */
export interface FilterExpression {
    readonly conditions: ReadonlyArray<FilterCondition>;
    readonly logicals: ReadonlyArray<string>;
}

/** A single parsed filter condition. */
export interface FilterCondition {
    readonly field: string;
    readonly operator: string;
    readonly value: boolean | null | number | string;
    readonly func?: string;
    readonly funcArgs?: ReadonlyArray<string>;
}

/** Projection field mapping. */
export interface ProjectionField {
    readonly alias: string;
    readonly source: string;
}

/** Discriminated union of all possible segment shapes. */
export type Segment =
    | { readonly type: SegmentType.Key; readonly value: string }
    | { readonly type: SegmentType.Index; readonly value: string }
    | { readonly type: SegmentType.Wildcard }
    | { readonly type: SegmentType.Descent; readonly key: string }
    | { readonly type: SegmentType.DescentMulti; readonly keys: ReadonlyArray<string> }
    | { readonly type: SegmentType.MultiIndex; readonly indices: ReadonlyArray<number> }
    | { readonly type: SegmentType.MultiKey; readonly keys: ReadonlyArray<string> }
    | { readonly type: SegmentType.Filter; readonly expression: FilterExpression }
    | {
          readonly type: SegmentType.Slice;
          readonly start: number | null;
          readonly end: number | null;
          readonly step: number | null;
      }
    | { readonly type: SegmentType.Projection; readonly fields: ReadonlyArray<ProjectionField> };
