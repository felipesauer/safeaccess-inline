import { describe, expect, it } from 'vitest';
import { ObjectAccessor } from '../../../src/accessors/formats/object-accessor.js';
import { DotNotationParser } from '../../../src/core/dot-notation-parser.js';
import { SecurityGuard } from '../../../src/security/security-guard.js';
import { SecurityParser } from '../../../src/security/security-parser.js';
import { InvalidFormatException } from '../../../src/exceptions/invalid-format-exception.js';
import { SecurityException } from '../../../src/exceptions/security-exception.js';

function makeParser(secParser?: SecurityParser): DotNotationParser {
    return new DotNotationParser(new SecurityGuard(), secParser ?? new SecurityParser());
}

describe(ObjectAccessor.name, () => {
    it('accepts a plain object', () => {
        const a = new ObjectAccessor(makeParser()).from({ name: 'Alice' });
        expect(a.get('name')).toBe('Alice');
    });

    it('throws InvalidFormatException for string input', () => {
        expect(() => new ObjectAccessor(makeParser()).from('string')).toThrow(
            InvalidFormatException,
        );
    });

    it('throws InvalidFormatException for null input', () => {
        expect(() => new ObjectAccessor(makeParser()).from(null)).toThrow(InvalidFormatException);
    });

    it('throws InvalidFormatException for array input', () => {
        expect(() => new ObjectAccessor(makeParser()).from([1, 2, 3])).toThrow(
            InvalidFormatException,
        );
    });

    it('throws InvalidFormatException with "array" in message for array input', () => {
        expect(() => new ObjectAccessor(makeParser()).from([])).toThrow(/array/);
    });

    it('resolves nested paths', () => {
        const a = new ObjectAccessor(makeParser()).from({ user: { name: 'Bob' } });
        expect(a.get('user.name')).toBe('Bob');
    });

    it('handles nested arrays of objects', () => {
        const a = new ObjectAccessor(makeParser()).from({ items: [{ id: 1 }, { id: 2 }] });
        expect(a.get('items')).toEqual([{ id: 1 }, { id: 2 }]);
    });

    it('throws SecurityException when depth exceeds the limit', () => {
        const secParser = new SecurityParser({ maxDepth: 1 });
        const parser = makeParser(secParser);
        expect(() => new ObjectAccessor(parser).from({ a: { b: { c: 1 } } })).toThrow(
            SecurityException,
        );
    });

    it('does not throw for objects within the depth limit', () => {
        const secParser = new SecurityParser({ maxDepth: 5 });
        const parser = makeParser(secParser);
        expect(() => new ObjectAccessor(parser).from({ a: { b: { c: 1 } } })).not.toThrow();
    });

    it('throws SecurityException for deeply nested arrays exceeding depth', () => {
        const secParser = new SecurityParser({ maxDepth: 0 });
        const parser = makeParser(secParser);
        expect(() => new ObjectAccessor(parser).from({ items: [{ id: 1 }] })).toThrow(
            SecurityException,
        );
    });

    it('handles nested arrays of primitives without throwing', () => {
        const a = new ObjectAccessor(makeParser()).from({ tags: ['a', 'b', 'c'] });
        expect(a.get('tags')).toEqual(['a', 'b', 'c']);
    });

    it('preserves null values in object', () => {
        const a = new ObjectAccessor(makeParser()).from({ key: null });
        expect(a.get('key')).toBeNull();
    });

    it('handles array of objects at root level', () => {
        const a = new ObjectAccessor(makeParser()).from({ list: [{ x: 1 }, { x: 2 }] });
        expect(a.get('list')).toEqual([{ x: 1 }, { x: 2 }]);
    });

    it('handles nested array of arrays', () => {
        const a = new ObjectAccessor(makeParser()).from({
            matrix: [
                [1, 2],
                [3, 4],
            ],
        });
        expect(a.get('matrix')).toEqual([
            [1, 2],
            [3, 4],
        ]);
    });

    it('throws SecurityException at exactly maxDepth+1 nesting (strict=false so objectToRecord guard fires)', () => {
        const secParser = new SecurityParser({ maxDepth: 2 });
        const parser = makeParser(secParser);
        expect(() =>
            new ObjectAccessor(parser).strict(false).from({ a: { b: { c: { d: 1 } } } }),
        ).toThrow(SecurityException);
    });

    it('does not throw at exactly maxDepth nesting (strict=false)', () => {
        const secParser = new SecurityParser({ maxDepth: 2 });
        const parser = makeParser(secParser);
        expect(() =>
            new ObjectAccessor(parser).strict(false).from({ a: { b: { c: 1 } } }),
        ).not.toThrow();
    });

    it('throws SecurityException at exactly maxDepth+1 in nested array-of-objects (strict=false)', () => {
        const secParser = new SecurityParser({ maxDepth: 1 });
        const parser = makeParser(secParser);
        expect(() => new ObjectAccessor(parser).strict(false).from({ items: [{ id: 1 }] })).toThrow(
            SecurityException,
        );
    });

    it('throws SecurityException when nested array of arrays exceeds depth (strict=false)', () => {
        const secParser = new SecurityParser({ maxDepth: 0 });
        const parser = makeParser(secParser);
        expect(() => new ObjectAccessor(parser).strict(false).from({ matrix: [[1, 2]] })).toThrow(
            SecurityException,
        );
    });

    it('security exception message contains depth value', () => {
        const secParser = new SecurityParser({ maxDepth: 0 });
        const parser = makeParser(secParser);
        expect(() => new ObjectAccessor(parser).from({ a: { b: 1 } })).toThrow(/depth/i);
    });

    it('does not throw convertArrayValues at exactly maxDepth (> not >=)', () => {
        const secParser = new SecurityParser({ maxDepth: 1 });
        const parser = makeParser(secParser);
        expect(() =>
            new ObjectAccessor(parser).strict(false).from({ items: [1, 2, 3] }),
        ).not.toThrow();
    });

    it('handles null values inside an array correctly', () => {
        const a = new ObjectAccessor(makeParser()).from({ items: [null, 1, 'text'] });
        const items = a.get('items') as unknown[];
        expect(items[0]).toBeNull();
        expect(items[1]).toBe(1);
        expect(items[2]).toBe('text');
    });

    it('handles array-of-arrays with primitives and does not throw at valid depth', () => {
        const a = new ObjectAccessor(makeParser()).from({
            matrix: [
                [1, 2],
                [3, 4],
            ],
        });
        const matrix = a.get('matrix') as unknown[][];
        expect(matrix[0]).toEqual([1, 2]);
        expect(matrix[1]).toEqual([3, 4]);
    });

    it('throws when deeply nested arrays exceed maxDepth in convertArrayValues', () => {
        const secParser = new SecurityParser({ maxDepth: 1 });
        const parser = makeParser(secParser);
        expect(() => new ObjectAccessor(parser).strict(false).from({ items: [[1, 2]] })).toThrow(
            SecurityException,
        );
    });
});
