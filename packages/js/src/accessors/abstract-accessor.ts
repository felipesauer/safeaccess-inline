import type { AccessorsInterface } from '../contracts/accessors-interface.js';
import { DotNotationParser } from '../core/dot-notation-parser.js';
import { PathNotFoundException } from '../exceptions/path-not-found-exception.js';
import { ReadonlyViolationException } from '../exceptions/readonly-violation-exception.js';

/**
 * Base accessor providing read, write, and lifecycle operations.
 *
 * Implements all AccessorsInterface methods with immutable copy
 * semantics for writes, optional readonly enforcement, and strict mode
 * for security validation on data ingestion.
 *
 * Subclasses must implement `parse()` to convert raw input into
 * a normalized plain object.
 */
interface AccessorState {
    data: Record<string, unknown>;
    isReadonly: boolean;
    isStrict: boolean;
    rawInput: unknown;
}

export abstract class AbstractAccessor implements AccessorsInterface {
    /** @internal Mutable state grouped to allow O(1) shallow clone in mutations. */
    private _state: AccessorState = {
        data: {},
        isReadonly: false,
        isStrict: true,
        rawInput: null,
    };

    /**
     * @param parser - Dot-notation parser for path operations.
     */
    constructor(protected readonly parser: DotNotationParser) {}

    /**
     * Convert raw input data into a normalized plain object.
     *
     * @param raw - Raw input in the format expected by the accessor.
     * @returns Parsed data structure.
     * @throws {InvalidFormatException} When the input is malformed.
     */
    protected abstract parse(raw: unknown): Record<string, unknown>;

    /**
     * Ingest raw data, optionally validating via strict mode.
     *
     * When strict mode is enabled (default), validates payload size for string
     * inputs and runs structural/key-safety validation on parsed data.
     *
     * @param raw - Raw input data.
     * @returns Same instance with data populated.
     * @throws {InvalidFormatException} When the raw data cannot be parsed.
     * @throws {SecurityException} When payload exceeds size limit, data contains forbidden keys, or violates limits.
     */
    protected ingest(raw: unknown): this {
        this._state.rawInput = raw;
        if (this._state.isStrict && typeof raw === 'string') {
            this.parser.assertPayload(raw);
        }
        const parsed = this.parse(raw);
        if (this._state.isStrict) {
            this.parser.validate(parsed);
        }
        this._state.data = parsed;
        return this;
    }

    /**
     * Hydrate the accessor from raw input data.
     *
     * @param data - Raw input in the format expected by the accessor.
     * @returns Populated accessor instance.
     */
    abstract from(data: unknown): this;

    /**
     * Retrieve the original raw input data before parsing.
     *
     * @returns Original input passed to `from()`.
     */
    getRaw(): unknown {
        return this._state.rawInput;
    }

    /**
     * Return a new instance with the given readonly state.
     *
     * @param isReadonly - Whether the new instance should block mutations.
     * @returns New accessor instance with the readonly state applied.
     */
    readonly(isReadonly: boolean = true): this {
        const copy = this.cloneInstance();
        copy._state = { ...copy._state, isReadonly };
        return copy;
    }

    /**
     * Return a new instance with the given strict mode state.
     *
     * @param strict - Whether to enable strict security validation.
     * @returns New accessor instance with the strict mode applied.
     *
     * @security Passing `false` disables all SecurityGuard and SecurityParser
     * validation (key safety, payload size, depth and key-count limits).
     * Only use with fully trusted, application-controlled input.
     *
     * @example
     * // Trust the input — skip all security checks
     * const accessor = new JsonAccessor(parser).strict(false).from(trustedPayload);
     */
    strict(strict: boolean = true): this {
        const copy = this.cloneInstance();
        copy._state = { ...copy._state, isStrict: strict };
        return copy;
    }

    /**
     * Retrieve a value at a dot-notation path.
     *
     * @param path - Dot-notation path (e.g. "user.name").
     * @param defaultValue - Fallback when the path does not exist.
     * @returns Resolved value or the default.
     *
     * @example
     * accessor.get('user.name', 'unknown');
     */
    get(path: string, defaultValue: unknown = null): unknown {
        return this.parser.get(this._state.data, path, defaultValue);
    }

    /**
     * Retrieve a value or throw when the path does not exist.
     *
     * @param path - Dot-notation path.
     * @returns Resolved value.
     * @throws {PathNotFoundException} When the path is missing.
     *
     * @example
     * accessor.getOrFail('user.name'); // throws if not found
     */
    getOrFail(path: string): unknown {
        const sentinel = Object.create(null) as Record<string, never>;
        const result = this.parser.get(this._state.data, path, sentinel);

        if (result === sentinel) {
            throw new PathNotFoundException(`Path '${path}' not found.`);
        }

        return result;
    }

    /**
     * Retrieve a value using pre-parsed key segments.
     *
     * @param segments - Ordered list of keys.
     * @param defaultValue - Fallback when the path does not exist.
     * @returns Resolved value or the default.
     */
    getAt(segments: Array<string | number>, defaultValue: unknown = null): unknown {
        return this.parser.getAt(this._state.data, segments, defaultValue);
    }

    /**
     * Check whether a dot-notation path exists.
     *
     * @param path - Dot-notation path.
     * @returns True if the path resolves to a value.
     */
    has(path: string): boolean {
        return this.parser.has(this._state.data, path);
    }

    /**
     * Check whether a path exists using pre-parsed key segments.
     *
     * @param segments - Ordered list of keys.
     * @returns True if the path resolves to a value.
     */
    hasAt(segments: Array<string | number>): boolean {
        return this.parser.hasAt(this._state.data, segments);
    }

    /**
     * Set a value at a dot-notation path.
     *
     * @param path - Dot-notation path.
     * @param value - Value to assign.
     * @returns New accessor instance with the value set.
     * @throws {ReadonlyViolationException} When the accessor is readonly.
     * @throws {SecurityException} When the path contains forbidden keys.
     */
    set(path: string, value: unknown): this {
        this.assertNotReadOnly();
        return this.mutateTo(this.parser.set(this._state.data, path, value));
    }

    /**
     * Set a value using pre-parsed key segments.
     *
     * @param segments - Ordered list of keys.
     * @param value - Value to assign.
     * @returns New accessor instance with the value set.
     * @throws {ReadonlyViolationException} When the accessor is readonly.
     * @throws {SecurityException} When segments contain forbidden keys.
     */
    setAt(segments: Array<string | number>, value: unknown): this {
        this.assertNotReadOnly();
        return this.mutateTo(this.parser.setAt(this._state.data, segments, value));
    }

    /**
     * Remove a value at a dot-notation path.
     *
     * @param path - Dot-notation path to remove.
     * @returns New accessor instance without the specified path.
     * @throws {ReadonlyViolationException} When the accessor is readonly.
     * @throws {SecurityException} When the path contains forbidden keys.
     */
    remove(path: string): this {
        this.assertNotReadOnly();
        return this.mutateTo(this.parser.remove(this._state.data, path));
    }

    /**
     * Remove a value using pre-parsed key segments.
     *
     * @param segments - Ordered list of keys.
     * @returns New accessor instance without the specified path.
     * @throws {ReadonlyViolationException} When the accessor is readonly.
     * @throws {SecurityException} When segments contain forbidden keys.
     */
    removeAt(segments: Array<string | number>): this {
        this.assertNotReadOnly();
        return this.mutateTo(this.parser.removeAt(this._state.data, segments));
    }

    /**
     * Retrieve multiple values by their paths with individual defaults.
     *
     * @param paths - Map of path to default value.
     * @returns Map of path to resolved value.
     */
    getMany(paths: Record<string, unknown>): Record<string, unknown> {
        const results: Record<string, unknown> = {};
        for (const [path, defaultValue] of Object.entries(paths)) {
            results[path] = this.get(path, defaultValue);
        }
        return results;
    }

    /**
     * Return all parsed data as a plain object.
     *
     * @returns Complete internal data.
     */
    all(): Record<string, unknown> {
        return this._state.data;
    }

    /**
     * Count elements at a path, or the root if undefined.
     *
     * @param path - Dot-notation path, or undefined for root.
     * @returns Number of elements.
     */
    count(path?: string): number {
        const target = path !== undefined ? this.get(path, {}) : this._state.data;
        if (typeof target === 'object' && target !== null) {
            return Object.keys(target).length;
        }
        return 0;
    }

    /**
     * Retrieve array keys at a path, or root keys if undefined.
     *
     * @param path - Dot-notation path, or undefined for root.
     * @returns List of keys.
     */
    keys(path?: string): string[] {
        const target = path !== undefined ? this.get(path, {}) : this._state.data;
        /* Stryker disable next-line ConditionalExpression -- equivalent: get() always returns an object-type value here; typeof check is a type guard only */
        if (typeof target === 'object' && target !== null) {
            return Object.keys(target);
        }
        return [];
    }

    /**
     * Deep-merge an object into the value at a dot-notation path.
     *
     * @param path - Dot-notation path to the merge target.
     * @param value - Object to merge into the existing value.
     * @returns New accessor instance with merged data.
     * @throws {ReadonlyViolationException} When the accessor is readonly.
     * @throws {SecurityException} When the path or values contain forbidden keys.
     */
    merge(path: string, value: Record<string, unknown>): this {
        this.assertNotReadOnly();
        return this.mutateTo(this.parser.merge(this._state.data, path, value));
    }

    /**
     * Deep-merge an object into the root data.
     *
     * @param value - Object to merge into the root.
     * @returns New accessor instance with merged data.
     * @throws {ReadonlyViolationException} When the accessor is readonly.
     * @throws {SecurityException} When values contain forbidden keys.
     */
    mergeAll(value: Record<string, unknown>): this {
        this.assertNotReadOnly();
        return this.mutateTo(this.parser.merge(this._state.data, '', value));
    }

    /**
     * Assert that the accessor is not in readonly mode.
     *
     * @throws {ReadonlyViolationException} When the accessor is readonly.
     */
    private assertNotReadOnly(): void {
        if (this._state.isReadonly) {
            throw new ReadonlyViolationException();
        }
    }

    /**
     * Create a shallow clone of this accessor.
     *
     * @returns Cloned accessor instance.
     */
    private cloneInstance(): this {
        const copy = Object.create(Object.getPrototypeOf(this) as object) as this;
        Object.assign(copy, this);
        // Shallow-clone state so mutations on copy don't affect original
        copy._state = { ...this._state };
        return copy;
    }

    /**
     * Create a clone with new internal data.
     *
     * @param newData - New data for the clone.
     * @returns Cloned accessor with updated data.
     */
    private mutateTo(newData: Record<string, unknown>): this {
        const copy = this.cloneInstance();
        copy._state = { ...copy._state, data: newData };
        return copy;
    }
}
