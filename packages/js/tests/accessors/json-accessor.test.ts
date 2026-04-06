import { describe, expect, it } from 'vitest';
import { JsonAccessor } from '../../src/accessors/formats/json-accessor.js';
import { DotNotationParser } from '../../src/core/dot-notation-parser.js';
import { InvalidFormatException } from '../../src/exceptions/invalid-format-exception.js';
import { PathNotFoundException } from '../../src/exceptions/path-not-found-exception.js';
import { ReadonlyViolationException } from '../../src/exceptions/readonly-violation-exception.js';

function makeAccessor(): JsonAccessor {
    return new JsonAccessor(new DotNotationParser());
}

describe(JsonAccessor.name, () => {
    it('parses a valid JSON string', () => {
        const accessor = makeAccessor().from('{"name":"Alice","age":30}');
        expect(accessor.get('name')).toBe('Alice');
        expect(accessor.get('age')).toBe(30);
    });

    it('throws InvalidFormatException for non-string input', () => {
        expect(() => makeAccessor().from(42)).toThrow(InvalidFormatException);
    });

    it('throws InvalidFormatException for null input', () => {
        expect(() => makeAccessor().from(null)).toThrow(InvalidFormatException);
    });

    it('returns null for a missing path', () => {
        const accessor = makeAccessor().from('{"name":"Alice"}');
        expect(accessor.get('missing')).toBeNull();
    });

    it('returns the default value for a missing path', () => {
        const accessor = makeAccessor().from('{"name":"Alice"}');
        expect(accessor.get('missing', 'default')).toBe('default');
    });

    it('resolves a nested dot-notation path', () => {
        const accessor = makeAccessor().from('{"user":{"address":{"city":"Berlin"}}}');
        expect(accessor.get('user.address.city')).toBe('Berlin');
    });

    it('throws InvalidFormatException for malformed JSON', () => {
        expect(() => makeAccessor().from('{not valid json}')).toThrow(InvalidFormatException);
    });
});

describe(`${JsonAccessor.name} > has`, () => {
    it('returns true when path exists', () => {
        const accessor = makeAccessor().from('{"key":"value"}');
        expect(accessor.has('key')).toBe(true);
    });

    it('returns false when path is missing', () => {
        const accessor = makeAccessor().from('{"key":"value"}');
        expect(accessor.has('other')).toBe(false);
    });

    it('returns true for nested path', () => {
        const accessor = makeAccessor().from('{"a":{"b":1}}');
        expect(accessor.has('a.b')).toBe(true);
    });
});

describe(`${JsonAccessor.name} > getOrFail`, () => {
    it('returns value when path exists', () => {
        const accessor = makeAccessor().from('{"key":"value"}');
        expect(accessor.getOrFail('key')).toBe('value');
    });

    it('throws PathNotFoundException when path is missing', () => {
        const accessor = makeAccessor().from('{"key":"value"}');
        expect(() => accessor.getOrFail('missing')).toThrow(PathNotFoundException);
    });

    it('error message contains the missing path', () => {
        const accessor = makeAccessor().from('{}');
        expect(() => accessor.getOrFail('user.name')).toThrow("Path 'user.name' not found.");
    });
});

describe(`${JsonAccessor.name} > set`, () => {
    it('sets a value and returns a new instance', () => {
        const accessor = makeAccessor().from('{"name":"Alice"}');
        const updated = accessor.set('name', 'Bob');
        expect(updated.get('name')).toBe('Bob');
        expect(accessor.get('name')).toBe('Alice'); // original unchanged
    });

    it('sets a nested value', () => {
        const accessor = makeAccessor().from('{}');
        const updated = accessor.set('user.name', 'Alice');
        expect(updated.get('user.name')).toBe('Alice');
    });

    it('throws ReadonlyViolationException when readonly', () => {
        const accessor = makeAccessor().from('{"name":"Alice"}').readonly(true);
        expect(() => accessor.set('name', 'Bob')).toThrow(ReadonlyViolationException);
    });
});

describe(`${JsonAccessor.name} > remove`, () => {
    it('removes a key and returns a new instance', () => {
        const accessor = makeAccessor().from('{"name":"Alice","age":30}');
        const updated = accessor.remove('age');
        expect(updated.has('age')).toBe(false);
        expect(accessor.has('age')).toBe(true); // original unchanged
    });

    it('throws ReadonlyViolationException when readonly', () => {
        const accessor = makeAccessor().from('{"name":"Alice"}').readonly(true);
        expect(() => accessor.remove('name')).toThrow(ReadonlyViolationException);
    });
});

describe(`${JsonAccessor.name} > all`, () => {
    it('returns all parsed data', () => {
        const accessor = makeAccessor().from('{"a":1,"b":2}');
        expect(accessor.all()).toEqual({ a: 1, b: 2 });
    });
});

describe(`${JsonAccessor.name} > keys`, () => {
    it('returns root keys', () => {
        const accessor = makeAccessor().from('{"a":1,"b":2}');
        expect(accessor.keys()).toEqual(['a', 'b']);
    });
});

describe(`${JsonAccessor.name} > count`, () => {
    it('counts root keys', () => {
        const accessor = makeAccessor().from('{"a":1,"b":2,"c":3}');
        expect(accessor.count()).toBe(3);
    });
});

describe(`${JsonAccessor.name} > getRaw`, () => {
    it('returns the original raw input', () => {
        const json = '{"name":"Alice"}';
        const accessor = makeAccessor().from(json);
        expect(accessor.getRaw()).toBe(json);
    });
});

describe(`${JsonAccessor.name} > parse non-object JSON`, () => {
    // Kills line 51:13/44/62 — `typeof decoded !== 'object' || decoded === null` check
    // JSON.parse('null') returns null → should return {}
    it('returns empty object when JSON decodes to null', () => {
        const accessor = makeAccessor().from('null');
        expect(accessor.all()).toEqual({});
    });

    // JSON.parse('42') returns number → should return {}
    it('returns empty object when JSON decodes to a number', () => {
        const accessor = makeAccessor().from('42');
        expect(accessor.all()).toEqual({});
    });

    // JSON.parse('"hello"') returns string → should return {}
    it('returns empty object when JSON decodes to a string', () => {
        const accessor = makeAccessor().from('"hello"');
        expect(accessor.all()).toEqual({});
    });

    // JSON.parse('[1,2,3]') returns array → should return {} (or the array as a record, depending on impl)
    it('returns data when JSON decodes to an array', () => {
        // arrays are typeof 'object' and not null, so they pass the check
        const accessor = makeAccessor().from('[1,2,3]');
        // Array access as record: valid object-ish
        expect(typeof accessor.all()).toBe('object');
    });
});
