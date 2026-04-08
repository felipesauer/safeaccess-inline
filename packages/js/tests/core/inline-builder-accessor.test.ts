import { describe, expect, it } from 'vitest';
import { InlineBuilderAccessor } from '../../src/core/inline-builder-accessor.js';
import { AccessorFactory } from '../../src/core/accessor-factory.js';
import { SecurityGuard } from '../../src/security/security-guard.js';
import { SecurityParser } from '../../src/security/security-parser.js';
import { FakeParseIntegration } from '../mocks/fake-parse-integration.js';
import { FakePathCache } from '../mocks/fake-path-cache.js';

describe(InlineBuilderAccessor.name, () => {
    describe('builder', () => {
        it('returns an AccessorFactory', () => {
            const builder = new InlineBuilderAccessor();
            expect(builder.builder()).toBeInstanceOf(AccessorFactory);
        });

        it('creates a working parser that can resolve paths', () => {
            const factory = new InlineBuilderAccessor().builder();
            const accessor = factory.json('{"name":"Alice"}');
            expect(accessor.get('name')).toBe('Alice');
        });
    });

    describe('withSecurityGuard', () => {
        it('returns a new instance with the provided guard', () => {
            const original = new InlineBuilderAccessor();
            const guard = new SecurityGuard();
            const result = original.withSecurityGuard(guard);
            expect(result).not.toBe(original);
            expect(result).toBeInstanceOf(InlineBuilderAccessor);
        });

        it('uses the custom guard in created accessors', () => {
            const guard = new SecurityGuard(5, ['customForbidden']);
            const builder = new InlineBuilderAccessor(guard);
            const factory = builder.builder();
            expect(() => factory.json('{"customForbidden":"x"}')).toThrow();
        });
    });

    describe('withSecurityParser', () => {
        it('returns a new instance with the provided security parser', () => {
            const original = new InlineBuilderAccessor();
            const parser = new SecurityParser();
            const result = original.withSecurityParser(parser);
            expect(result).not.toBe(original);
            expect(result).toBeInstanceOf(InlineBuilderAccessor);
        });

        it('uses the custom security parser in created accessors', () => {
            const tinyParser = new SecurityParser({ maxPayloadBytes: 5 });
            const builder = new InlineBuilderAccessor(undefined, tinyParser);
            const factory = builder.builder();
            expect(() => factory.json('{"name":"Alice"}')).toThrow();
        });
    });

    describe('withParserIntegration', () => {
        it('returns a new instance with the provided integration', () => {
            const original = new InlineBuilderAccessor();
            const integration = new FakeParseIntegration();
            const result = original.withParserIntegration(integration);
            expect(result).not.toBe(original);
            expect(result).toBeInstanceOf(InlineBuilderAccessor);
        });

        it('integration is available in AnyAccessor via builder', () => {
            const integration = new FakeParseIntegration(true, { key: 'val' });
            const factory = new InlineBuilderAccessor()
                .withParserIntegration(integration)
                .builder();
            const accessor = factory.any('raw');
            expect(accessor.get('key')).toBe('val');
        });
    });

    describe('withPathCache', () => {
        it('returns a new instance with the provided cache', () => {
            const original = new InlineBuilderAccessor();
            const cache = new FakePathCache();
            const result = original.withPathCache(cache);
            expect(result).not.toBe(original);
            expect(result).toBeInstanceOf(InlineBuilderAccessor);
        });

        it('uses the custom cache in the parser', () => {
            const cache = new FakePathCache();
            const factory = new InlineBuilderAccessor(undefined, undefined, cache).builder();
            const accessor = factory.json('{"a":1}');
            accessor.get('a');
            accessor.get('a');
            expect(cache.getCallCount).toBeGreaterThanOrEqual(1);
        });
    });

    describe('withStrictMode', () => {
        it('returns a new instance with strict mode set', () => {
            const original = new InlineBuilderAccessor();
            const result = original.withStrictMode(false);
            expect(result).not.toBe(original);
            expect(result).toBeInstanceOf(InlineBuilderAccessor);
        });

        it('strict(false) bypasses security validation', () => {
            const factory = new InlineBuilderAccessor().withStrictMode(false).builder();
            const accessor = factory.json('{"__proto__":"ok"}');
            expect(accessor.get('__proto__')).toBe('ok');
        });

        it('strict(true) enforces security validation', () => {
            const factory = new InlineBuilderAccessor().withStrictMode(true).builder();
            expect(() => factory.json('{"__proto__":"fail"}')).toThrow();
        });
    });
});
