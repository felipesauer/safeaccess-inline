import { describe, expect, it } from 'vitest';
import { SecurityParser } from '../../src/security/security-parser.js';
import { SecurityException } from '../../src/exceptions/security-exception.js';

describe(SecurityParser.name, () => {
    it('creates instance with default values', () => {
        const parser = new SecurityParser();
        expect(parser.maxDepth).toBe(512);
        expect(parser.maxPayloadBytes).toBe(10 * 1024 * 1024);
        expect(parser.maxKeys).toBe(10_000);
        expect(parser.maxCountRecursiveDepth).toBe(100);
        expect(parser.maxResolveDepth).toBe(100);
    });

    it('accepts custom options', () => {
        const parser = new SecurityParser({
            maxDepth: 5,
            maxPayloadBytes: 100,
            maxKeys: 10,
            maxCountRecursiveDepth: 3,
            maxResolveDepth: 4,
        });
        expect(parser.maxDepth).toBe(5);
        expect(parser.maxPayloadBytes).toBe(100);
        expect(parser.maxKeys).toBe(10);
        expect(parser.maxCountRecursiveDepth).toBe(3);
        expect(parser.maxResolveDepth).toBe(4);
    });

    it('uses default when option is undefined (nullish coalescing)', () => {
        const parser = new SecurityParser({ maxDepth: undefined });
        expect(parser.maxDepth).toBe(512);
    });

    it('uses 0 when option is explicitly 0 (nullish coalescing — not falsy)', () => {
        const parser = new SecurityParser({ maxDepth: 0 });
        expect(parser.maxDepth).toBe(0);
    });
});

describe(`${SecurityParser.name} > constructor — NaN/Infinity clamping (SEC-020)`, () => {
    it('clamps NaN maxDepth to default 512', () => {
        const parser = new SecurityParser({ maxDepth: NaN });
        expect(parser.maxDepth).toBe(512);
    });

    it('clamps Infinity maxDepth to default 512', () => {
        const parser = new SecurityParser({ maxDepth: Infinity });
        expect(parser.maxDepth).toBe(512);
    });

    it('clamps NaN maxPayloadBytes to default', () => {
        const parser = new SecurityParser({ maxPayloadBytes: NaN });
        expect(parser.maxPayloadBytes).toBe(10 * 1024 * 1024);
    });

    it('clamps NaN maxKeys to default 10 000', () => {
        const parser = new SecurityParser({ maxKeys: NaN });
        expect(parser.maxKeys).toBe(10_000);
    });

    it('clamps Infinity maxKeys to default 10 000', () => {
        const parser = new SecurityParser({ maxKeys: Infinity });
        expect(parser.maxKeys).toBe(10_000);
    });

    it('clamps NaN maxCountRecursiveDepth to default 100', () => {
        const parser = new SecurityParser({ maxCountRecursiveDepth: NaN });
        expect(parser.maxCountRecursiveDepth).toBe(100);
    });

    it('clamps NaN maxResolveDepth to default 100', () => {
        const parser = new SecurityParser({ maxResolveDepth: NaN });
        expect(parser.maxResolveDepth).toBe(100);
    });

    it('assertPayloadSize still fires when maxPayloadBytes was clamped from NaN', () => {
        const parser = new SecurityParser({ maxPayloadBytes: NaN });
        const large = 'x'.repeat(10 * 1024 * 1024 + 1);
        expect(() => parser.assertPayloadSize(large)).toThrow(SecurityException);
    });

    it('assertMaxKeys still fires when maxKeys was clamped from NaN', () => {
        const parser = new SecurityParser({ maxKeys: NaN });
        const data: Record<string, unknown> = {};
        for (let i = 0; i < 10_001; i++) {
            data[`k${i}`] = i;
        }
        expect(() => parser.assertMaxKeys(data)).toThrow(SecurityException);
    });
});

describe(`${SecurityParser.name} > getMaxDepth`, () => {
    it('returns the configured max depth', () => {
        const parser = new SecurityParser({ maxDepth: 42 });
        expect(parser.getMaxDepth()).toBe(42);
    });

    it('returns the default max depth when not overridden', () => {
        const parser = new SecurityParser();
        expect(parser.getMaxDepth()).toBe(512);
    });
});

describe(`${SecurityParser.name} > getMaxResolveDepth`, () => {
    it('returns the configured max resolve depth', () => {
        const parser = new SecurityParser({ maxResolveDepth: 7 });
        expect(parser.getMaxResolveDepth()).toBe(7);
    });

    it('returns the default max resolve depth when not overridden', () => {
        const parser = new SecurityParser();
        expect(parser.getMaxResolveDepth()).toBe(100);
    });
});

describe(`${SecurityParser.name} > getMaxKeys`, () => {
    it('returns the configured max key count', () => {
        const parser = new SecurityParser({ maxKeys: 500 });
        expect(parser.getMaxKeys()).toBe(500);
    });

    it('returns the default max key count when not overridden', () => {
        const parser = new SecurityParser();
        expect(parser.getMaxKeys()).toBe(10_000);
    });
});

describe(`${SecurityParser.name} > assertPayloadSize`, () => {
    it('does not throw for a small payload', () => {
        const parser = new SecurityParser({ maxPayloadBytes: 100 });
        expect(() => parser.assertPayloadSize('small')).not.toThrow();
    });

    it('throws SecurityException when payload exceeds the limit', () => {
        const parser = new SecurityParser({ maxPayloadBytes: 5 });
        expect(() => parser.assertPayloadSize('123456')).toThrow(SecurityException);
    });

    it('throws SecurityException at exactly limit + 1 byte', () => {
        const parser = new SecurityParser({ maxPayloadBytes: 4 });
        expect(() => parser.assertPayloadSize('12345')).toThrow(SecurityException);
    });

    it('does not throw at exactly the limit', () => {
        const parser = new SecurityParser({ maxPayloadBytes: 5 });
        expect(() => parser.assertPayloadSize('12345')).not.toThrow();
    });

    it('uses the override maxBytes when provided', () => {
        const parser = new SecurityParser({ maxPayloadBytes: 1000 });
        expect(() => parser.assertPayloadSize('123456', 3)).toThrow(SecurityException);
    });

    it('uses the default limit when maxBytes override is not provided', () => {
        const parser = new SecurityParser({ maxPayloadBytes: 3 });
        expect(() => parser.assertPayloadSize('1234')).toThrow(SecurityException);
    });

    it('error message contains byte size and limit', () => {
        const parser = new SecurityParser({ maxPayloadBytes: 3 });
        expect(() => parser.assertPayloadSize('1234')).toThrow(
            /Payload size \d+ bytes exceeds maximum of 3 bytes/,
        );
    });
});

describe(`${SecurityParser.name} > assertMaxResolveDepth`, () => {
    it('does not throw for depth below the limit', () => {
        const parser = new SecurityParser({ maxResolveDepth: 10 });
        expect(() => parser.assertMaxResolveDepth(5)).not.toThrow();
    });

    it('does not throw for depth equal to the limit', () => {
        const parser = new SecurityParser({ maxResolveDepth: 10 });
        expect(() => parser.assertMaxResolveDepth(10)).not.toThrow();
    });

    it('throws SecurityException for depth above the limit', () => {
        const parser = new SecurityParser({ maxResolveDepth: 10 });
        expect(() => parser.assertMaxResolveDepth(11)).toThrow(SecurityException);
    });

    it('throws SecurityException at depth = limit + 1', () => {
        const parser = new SecurityParser({ maxResolveDepth: 3 });
        expect(() => parser.assertMaxResolveDepth(4)).toThrow(SecurityException);
    });

    it('error message contains the max resolve depth', () => {
        const parser = new SecurityParser({ maxResolveDepth: 3 });
        expect(() => parser.assertMaxResolveDepth(4)).toThrow(
            'Deep merge exceeded maximum depth of 3',
        );
    });
});

describe(`${SecurityParser.name} > assertMaxKeys`, () => {
    it('does not throw for data with few keys', () => {
        const parser = new SecurityParser({ maxKeys: 10 });
        expect(() => parser.assertMaxKeys({ a: 1, b: 2 })).not.toThrow();
    });

    it('throws SecurityException when total key count exceeds limit', () => {
        const parser = new SecurityParser({ maxKeys: 2 });
        expect(() => parser.assertMaxKeys({ a: 1, b: 2, c: 3 })).toThrow(SecurityException);
    });

    it('counts nested keys recursively', () => {
        const parser = new SecurityParser({ maxKeys: 3 });
        expect(() => parser.assertMaxKeys({ a: { b: { c: 1 } } })).not.toThrow();
    });

    it('throws when nested key count exceeds limit', () => {
        const parser = new SecurityParser({ maxKeys: 2 });
        expect(() => parser.assertMaxKeys({ a: { b: { c: 1 } } })).toThrow(SecurityException);
    });

    it('uses the override maxKeys when provided', () => {
        const parser = new SecurityParser({ maxKeys: 100 });
        expect(() => parser.assertMaxKeys({ a: 1, b: 2 }, 1)).toThrow(SecurityException);
    });

    it('error message contains count and limit', () => {
        const parser = new SecurityParser({ maxKeys: 2 });
        expect(() => parser.assertMaxKeys({ a: 1, b: 2, c: 3 })).toThrow(
            /Data contains \d+ keys, exceeding maximum of 2/,
        );
    });

    it('does not count past maxCountDepth', () => {
        // With very low recursion depth, deeply nested keys don't get counted
        const parser = new SecurityParser({ maxKeys: 1, maxCountRecursiveDepth: 0 });
        // Root has 1 key 'a'. With depth 0, we don't recurse into value.
        // count = 1 (not > 1), should pass.
        expect(() => parser.assertMaxKeys({ a: { b: 1 } })).not.toThrow();
    });

    it('counts correctly at the boundary', () => {
        const parser = new SecurityParser({ maxKeys: 3 });
        expect(() => parser.assertMaxKeys({ a: 1, b: 2, c: 3 })).not.toThrow();
    });

    it('does not throw for empty object', () => {
        const parser = new SecurityParser({ maxKeys: 0 });
        expect(() => parser.assertMaxKeys({})).not.toThrow();
    });

    it('does not count non-object leaf values', () => {
        const parser = new SecurityParser({ maxKeys: 3 });
        // a, b, c are 3 keys; b's value is a string (not counted recursively)
        expect(() => parser.assertMaxKeys({ a: 1, b: 'hello', c: true })).not.toThrow();
    });

    // Kills line 164 `depth > maxDepth` — distinguishes `>` from `>=`:
    // with maxCountRecursiveDepth=1, depth=1 should still recurse (1 > 1 is false),
    // so the child object's key gets counted.
    it('counts keys at exactly maxCountRecursiveDepth level (boundary — > not >=)', () => {
        // maxCountRecursiveDepth=1: at depth 0, recurse into 'a' (depth becomes 1).
        // At depth 1 (= maxDepth), guard is 1 > 1 = false → still counts keys.
        // At depth 2 (> maxDepth), guard is 2 > 1 = true → stops.
        // Data { a: { b: 1 } } → total keys: 2 (a + b)
        const parser = new SecurityParser({ maxKeys: 1, maxCountRecursiveDepth: 1 });
        expect(() => parser.assertMaxKeys({ a: { b: 1 } })).toThrow(SecurityException);
    });
});

describe(`${SecurityParser.name} > assertMaxDepth`, () => {
    it('does not throw for depth below the limit', () => {
        const parser = new SecurityParser({ maxDepth: 10 });
        expect(() => parser.assertMaxDepth(5)).not.toThrow();
    });

    it('does not throw for depth equal to the limit', () => {
        const parser = new SecurityParser({ maxDepth: 10 });
        expect(() => parser.assertMaxDepth(10)).not.toThrow();
    });

    it('throws SecurityException for depth above the limit', () => {
        const parser = new SecurityParser({ maxDepth: 10 });
        expect(() => parser.assertMaxDepth(11)).toThrow(SecurityException);
    });

    it('uses the override maxDepth when provided', () => {
        const parser = new SecurityParser({ maxDepth: 100 });
        expect(() => parser.assertMaxDepth(5, 3)).toThrow(SecurityException);
    });

    it('uses the default maxDepth when override is not provided', () => {
        const parser = new SecurityParser({ maxDepth: 3 });
        expect(() => parser.assertMaxDepth(4)).toThrow(SecurityException);
    });

    it('error message contains depth and limit', () => {
        const parser = new SecurityParser({ maxDepth: 3 });
        expect(() => parser.assertMaxDepth(4)).toThrow('Recursion depth 4 exceeds maximum of 3.');
    });

    it('uses 0 as limit override correctly', () => {
        const parser = new SecurityParser({ maxDepth: 100 });
        expect(() => parser.assertMaxDepth(1, 0)).toThrow(SecurityException);
    });
});

describe(`${SecurityParser.name} > assertMaxStructuralDepth`, () => {
    it('does not throw for flat data', () => {
        const parser = new SecurityParser();
        expect(() => parser.assertMaxStructuralDepth({ a: 1, b: 2 }, 5)).not.toThrow();
    });

    it('does not throw for 2-level nesting within limit', () => {
        const parser = new SecurityParser();
        expect(() => parser.assertMaxStructuralDepth({ a: { b: 1 } }, 5)).not.toThrow();
    });

    it('throws SecurityException for data that exceeds maxDepth', () => {
        const parser = new SecurityParser();
        expect(() => parser.assertMaxStructuralDepth({ a: { b: { c: { d: 1 } } } }, 2)).toThrow(
            SecurityException,
        );
    });

    it('throws SecurityException at exactly maxDepth + 1 levels', () => {
        // data is 1 level deep; maxDepth = 0 → depth 1 > 0 → throws
        const parser = new SecurityParser();
        expect(() => parser.assertMaxStructuralDepth({ a: 1 }, 0)).toThrow(SecurityException);
    });

    it('does not throw for empty object at any limit', () => {
        const parser = new SecurityParser();
        expect(() => parser.assertMaxStructuralDepth({}, 0)).not.toThrow();
    });

    it('does not throw for null-valued keys', () => {
        const parser = new SecurityParser();
        expect(() => parser.assertMaxStructuralDepth({ a: null }, 1)).not.toThrow();
    });

    it('error message contains depth and policy maximum', () => {
        const parser = new SecurityParser();
        expect(() => parser.assertMaxStructuralDepth({ a: { b: { c: 1 } } }, 1)).toThrow(
            /Data structural depth \d+ exceeds policy maximum of 1/,
        );
    });

    it('correctly measures depth for multi-branch trees', () => {
        const parser = new SecurityParser();
        const data = { a: { x: 1, y: 2 }, b: { z: { w: 3 } } };
        // b.z.w is depth 3; maxDepth=2 → throws
        expect(() => parser.assertMaxStructuralDepth(data, 2)).toThrow(SecurityException);
    });

    it('does not throw at exactly maxDepth levels', () => {
        const parser = new SecurityParser();
        // { a: { b: 1 } } is 2 levels deep; maxDepth=2 → OK
        expect(() => parser.assertMaxStructuralDepth({ a: { b: 1 } }, 2)).not.toThrow();
    });

    // Kills line 183 `current >= maxDepth` in measureDepth — distinguishes `>=` from `>`:
    // measureDepth is called with maxDepth = policy_limit + 1 (early termination ceiling).
    // At current == maxDepth-1 (still below ceiling), we must still recurse measuring children.
    it('measures depth correctly at ceiling - 1 (>= vs > boundary)', () => {
        const parser = new SecurityParser();
        // Policy maxDepth=3. measureDepth passes maxDepth+1=4 as ceiling.
        // { a: { b: { c: { d: 1 } } } } is depth 4.
        // If `>=` mutated to `>`, current=4 would NOT trigger early return at ceiling 4 → wrong depth.
        expect(() => parser.assertMaxStructuralDepth({ a: { b: { c: { d: 1 } } } }, 3)).toThrow(SecurityException);
    });

    // Kills line 191 `d > max` in measureDepth — distinguishes `>` from `>=`:
    // sibling branches: one shallower, one equal depth — max must NOT be updated on equal (no regression).
    it('does not update max when sibling branch depth equals current max (> not >=)', () => {
        const parser = new SecurityParser();
        // { a: 1, b: 1 } — both branches have same depth (1). Result should be 1, not 2.
        expect(() => parser.assertMaxStructuralDepth({ a: 1, b: 1 }, 1)).not.toThrow();
    });

    // Deep tree — ensures the deepest branch wins
    it('picks the deepest branch in an asymmetric tree', () => {
        const parser = new SecurityParser();
        // { a: 1, b: { c: { d: 1 } } } — branch b is deepest (depth 3).
        // maxDepth=2 → depth 3 > 2 → throws.
        expect(() => parser.assertMaxStructuralDepth({ a: 1, b: { c: { d: 1 } } }, 2)).toThrow(SecurityException);
    });

    // Shallow sibling — the max is NOT increased by a shallower second branch
    it('does not throw when the deepest branch exactly meets maxDepth', () => {
        const parser = new SecurityParser();
        // { a: 1, b: { c: 1 } } — deepest is b.c at depth 2. maxDepth=2 → OK.
        expect(() => parser.assertMaxStructuralDepth({ a: 1, b: { c: 1 } }, 2)).not.toThrow();
    });
});
