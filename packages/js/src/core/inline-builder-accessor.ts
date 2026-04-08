import type { SecurityGuardInterface } from '../contracts/security-guard-interface.js';
import type { SecurityParserInterface } from '../contracts/security-parser-interface.js';
import type { ParseIntegrationInterface } from '../contracts/parse-integration-interface.js';
import type { PathCacheInterface } from '../contracts/path-cache-interface.js';
import { SecurityGuard } from '../security/security-guard.js';
import { SecurityParser } from '../security/security-parser.js';
import { SimplePathCache } from '../cache/simple-path-cache.js';
import { DotNotationParser } from './dot-notation-parser.js';
import { AccessorFactory } from './accessor-factory.js';
import { SegmentFilterParser } from '../path-query/segment-filter-parser.js';
import { SegmentParser } from '../path-query/segment-parser.js';
import { SegmentPathResolver } from '../path-query/segment-path-resolver.js';

/**
 * Builder for configuring and constructing the internal components of SafeAccess Inline.
 *
 * Provides an immutable builder API: each `withXxx()` method returns a new
 * instance with the specified override, leaving the original unchanged.
 *
 * Note: PHP's equivalent uses `__callStatic`/`__call` magic to expose
 * protected methods publicly. TypeScript has no equivalent mechanism, so
 * builder methods are public directly and static forwarding is explicit
 * in the {@link Inline} subclass.
 *
 * @internal
 *
 * @see Inline
 */
export class InlineBuilderAccessor {
    protected readonly _guard: SecurityGuardInterface;
    protected readonly _secParser: SecurityParserInterface;
    protected readonly _pathCache: PathCacheInterface | null;
    protected readonly _integration: ParseIntegrationInterface | null;
    protected readonly _strictMode: boolean | null;

    /**
     * Create a builder with optional component overrides.
     *
     * @param guard - Custom security guard, or undefined for default.
     * @param secParser - Custom security parser, or undefined for default.
     * @param pathCache - Custom path cache, or null/undefined for default.
     * @param integration - Custom format integration, or null/undefined for none.
     * @param strictMode - Strict mode override, or null/undefined for accessor default.
     */
    constructor(
        guard?: SecurityGuardInterface,
        secParser?: SecurityParserInterface,
        pathCache?: PathCacheInterface | null,
        integration?: ParseIntegrationInterface | null,
        strictMode?: boolean | null,
    ) {
        this._guard = guard ?? new SecurityGuard();
        this._secParser = secParser ?? new SecurityParser();
        this._pathCache = pathCache ?? null;
        this._integration = integration ?? null;
        this._strictMode = strictMode ?? null;
    }

    /**
     * Initialize the builder with default or provided components.
     *
     * @returns Configured factory ready to create typed accessors.
     */
    builder(): AccessorFactory {
        const filterParser = new SegmentFilterParser(this._guard);
        const segmentParser = new SegmentParser(filterParser);
        const segmentPathResolver = new SegmentPathResolver(filterParser);

        const dotNotationParser = new DotNotationParser(
            this._guard,
            this._secParser,
            this._pathCache ?? new SimplePathCache(),
            segmentParser,
            segmentPathResolver,
        );

        return new AccessorFactory(dotNotationParser, this._integration, this._strictMode);
    }

    /**
     * Set a custom parser integration implementation.
     *
     * @param integration - Custom format integration to use.
     * @returns New builder instance with the integration configured.
     */
    withParserIntegration(integration: ParseIntegrationInterface): this {
        return new (this.constructor as new (
            guard: SecurityGuardInterface,
            secParser: SecurityParserInterface,
            pathCache: PathCacheInterface | null,
            integration: ParseIntegrationInterface | null,
            strictMode: boolean | null,
        ) => this)(this._guard, this._secParser, this._pathCache, integration, this._strictMode);
    }

    /**
     * Set a custom security guard implementation.
     *
     * @param guard - Custom guard implementation to use.
     * @returns New builder instance with the guard configured.
     */
    withSecurityGuard(guard: SecurityGuardInterface): this {
        return new (this.constructor as new (
            guard: SecurityGuardInterface,
            secParser: SecurityParserInterface,
            pathCache: PathCacheInterface | null,
            integration: ParseIntegrationInterface | null,
            strictMode: boolean | null,
        ) => this)(guard, this._secParser, this._pathCache, this._integration, this._strictMode);
    }

    /**
     * Set a custom security parser implementation.
     *
     * @param parser - Custom parser implementation to use.
     * @returns New builder instance with the parser configured.
     */
    withSecurityParser(parser: SecurityParserInterface): this {
        return new (this.constructor as new (
            guard: SecurityGuardInterface,
            secParser: SecurityParserInterface,
            pathCache: PathCacheInterface | null,
            integration: ParseIntegrationInterface | null,
            strictMode: boolean | null,
        ) => this)(this._guard, parser, this._pathCache, this._integration, this._strictMode);
    }

    /**
     * Set a custom path cache implementation.
     *
     * @param cache - Custom cache implementation to use.
     * @returns New builder instance with the cache configured.
     */
    withPathCache(cache: PathCacheInterface): this {
        return new (this.constructor as new (
            guard: SecurityGuardInterface,
            secParser: SecurityParserInterface,
            pathCache: PathCacheInterface | null,
            integration: ParseIntegrationInterface | null,
            strictMode: boolean | null,
        ) => this)(this._guard, this._secParser, cache, this._integration, this._strictMode);
    }

    /**
     * Set the strict mode for all accessors created by this builder.
     *
     * @param strict - Whether to enable strict security validation.
     * @returns New builder instance with the strict mode configured.
     *
     * @security Passing `false` disables all SecurityGuard and SecurityParser
     *           validation (key safety, payload size, depth and key-count limits).
     *           Only use with fully trusted, application-controlled input.
     */
    withStrictMode(strict: boolean): this {
        return new (this.constructor as new (
            guard: SecurityGuardInterface,
            secParser: SecurityParserInterface,
            pathCache: PathCacheInterface | null,
            integration: ParseIntegrationInterface | null,
            strictMode: boolean | null,
        ) => this)(this._guard, this._secParser, this._pathCache, this._integration, strict);
    }
}
