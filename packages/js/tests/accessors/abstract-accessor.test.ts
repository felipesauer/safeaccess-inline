import { describe, expect, it } from 'vitest';
import { AbstractAccessor } from '../../src/accessors/abstract-accessor.js';
import { JsonAccessor } from '../../src/accessors/formats/json-accessor.js';
import { DotNotationParser } from '../../src/core/dot-notation-parser.js';
import { SecurityGuard } from '../../src/security/security-guard.js';
import { SecurityParser } from '../../src/security/security-parser.js';
import { SecurityException } from '../../src/exceptions/security-exception.js';
import { ReadonlyViolationException } from '../../src/exceptions/readonly-violation-exception.js';
import { PathNotFoundException } from '../../src/exceptions/path-not-found-exception.js';

function makeParser(secParser?: SecurityParser): DotNotationParser {
    return new DotNotationParser(new SecurityGuard(), secParser ?? new SecurityParser());
}

describe(AbstractAccessor.name, () => {
    it('strict mode default is enabled - validates on ingest', () => {
        expect(() => new JsonAccessor(makeParser()).from('{"__proto__": "bad"}')).toThrow(
            SecurityException,
        );
    });

    it('strict(false) disables validation', () => {
        const a = new JsonAccessor(makeParser()).strict(false).from('{"__proto__": "ok"}');
        expect(a.get('__proto__')).toBe('ok');
    });

    it('strict(true) re-enables validation', () => {
        const accessor = new JsonAccessor(makeParser()).strict(false);
        const strictAgain = accessor.strict(true);
        expect(() => strictAgain.from('{"__proto__": "bad"}')).toThrow(SecurityException);
    });

    it('readonly(true) blocks set()', () => {
        const a = new JsonAccessor(makeParser()).from('{"x":1}').readonly(true);
        expect(() => a.set('x', 2)).toThrow(ReadonlyViolationException);
    });

    it('readonly(true) blocks remove()', () => {
        const a = new JsonAccessor(makeParser()).from('{"x":1}').readonly(true);
        expect(() => a.remove('x')).toThrow(ReadonlyViolationException);
    });

    it('readonly(false) allows mutation after readonly(true)', () => {
        const a = new JsonAccessor(makeParser()).from('{"x":1}').readonly(true).readonly(false);
        expect(() => a.set('x', 2)).not.toThrow();
    });

    it('merge() combines two objects at root level', () => {
        const a = new JsonAccessor(makeParser()).from('{"a":1}');
        const merged = a.merge('', { b: 2 });
        expect(merged.get('a')).toBe(1);
        expect(merged.get('b')).toBe(2);
    });

    it('merge() at a nested path', () => {
        const a = new JsonAccessor(makeParser()).from('{"user":{"name":"Alice"}}');
        const merged = a.merge('user', { role: 'admin' });
        expect(merged.get('user.name')).toBe('Alice');
        expect(merged.get('user.role')).toBe('admin');
    });

    it('all() returns all parsed data', () => {
        const a = new JsonAccessor(makeParser()).from('{"a":1,"b":2}');
        expect(a.all()).toEqual({ a: 1, b: 2 });
    });

    it('keys() returns root-level keys', () => {
        const a = new JsonAccessor(makeParser()).from('{"a":1,"b":2}');
        expect(a.keys()).toEqual(['a', 'b']);
    });

    it('count() returns number of root keys', () => {
        const a = new JsonAccessor(makeParser()).from('{"a":1,"b":2,"c":3}');
        expect(a.count()).toBe(3);
    });

    it('getRaw() returns original input', () => {
        const json = '{"name":"Alice"}';
        expect(new JsonAccessor(makeParser()).from(json).getRaw()).toBe(json);
    });

    it('getOrFail() throws PathNotFoundException for missing path', () => {
        const a = new JsonAccessor(makeParser()).from('{}');
        expect(() => a.getOrFail('missing')).toThrow(PathNotFoundException);
    });

    it('readonly() with no argument defaults to true (blocks mutations)', () => {
        const a = new JsonAccessor(makeParser()).from('{"x":1}').readonly();
        expect(() => a.set('x', 2)).toThrow(ReadonlyViolationException);
    });

    it('strict() with no argument defaults to true (enables validation)', () => {
        const accessor = new JsonAccessor(makeParser()).strict(false);
        const strictAgain = accessor.strict();
        expect(() => strictAgain.from('{"__proto__": "bad"}')).toThrow(SecurityException);
    });

    it('getAt() returns null when path does not exist (default is null)', () => {
        const a = new JsonAccessor(makeParser()).from('{"a":1}');
        expect(a.getAt(['missing'])).toBeNull();
    });

    it('getAt() resolves a value using pre-parsed segments', () => {
        const a = new JsonAccessor(makeParser()).from('{"user":{"name":"Alice"}}');
        expect(a.getAt(['user', 'name'])).toBe('Alice');
    });

    it('hasAt() returns true when segments resolve to a value', () => {
        const a = new JsonAccessor(makeParser()).from('{"a":{"b":1}}');
        expect(a.hasAt(['a', 'b'])).toBe(true);
    });

    it('hasAt() returns false when segments do not resolve', () => {
        const a = new JsonAccessor(makeParser()).from('{"a":1}');
        expect(a.hasAt(['missing'])).toBe(false);
    });

    it('setAt() sets a value using pre-parsed segments', () => {
        const a = new JsonAccessor(makeParser()).from('{}');
        const updated = a.setAt(['user', 'name'], 'Alice');
        expect(updated.get('user.name')).toBe('Alice');
    });

    it('setAt() throws ReadonlyViolationException when readonly', () => {
        const a = new JsonAccessor(makeParser()).from('{"x":1}').readonly(true);
        expect(() => a.setAt(['x'], 2)).toThrow(ReadonlyViolationException);
    });

    it('removeAt() removes a value using pre-parsed segments', () => {
        const a = new JsonAccessor(makeParser()).from('{"a":1,"b":2}');
        const updated = a.removeAt(['a']);
        expect(updated.has('a')).toBe(false);
        expect(updated.has('b')).toBe(true);
    });

    it('removeAt() throws ReadonlyViolationException when readonly', () => {
        const a = new JsonAccessor(makeParser()).from('{"x":1}').readonly(true);
        expect(() => a.removeAt(['x'])).toThrow(ReadonlyViolationException);
    });

    it('getMany() returns map of paths to their values', () => {
        const a = new JsonAccessor(makeParser()).from('{"a":1,"b":2}');
        expect(a.getMany({ a: 0, b: 0, missing: 'fallback' })).toEqual({
            a: 1,
            b: 2,
            missing: 'fallback',
        });
    });

    it('count(path) returns number of keys at a nested path', () => {
        const a = new JsonAccessor(makeParser()).from('{"user":{"name":"Alice","age":30}}');
        expect(a.count('user')).toBe(2);
    });

    it('count(path) returns 0 when path resolves to a non-object', () => {
        const a = new JsonAccessor(makeParser()).from('{"a":"string"}');
        expect(a.count('a')).toBe(0);
    });

    it('keys(path) returns keys at a nested path', () => {
        const a = new JsonAccessor(makeParser()).from('{"user":{"name":"Alice","role":"admin"}}');
        expect(a.keys('user')).toEqual(['name', 'role']);
    });

    it('keys(path) returns empty array when path resolves to a non-object', () => {
        const a = new JsonAccessor(makeParser()).from('{"a":42}');
        expect(a.keys('a')).toEqual([]);
    });

    it('mergeAll() deep-merges into root', () => {
        const a = new JsonAccessor(makeParser()).from('{"a":1}');
        const merged = a.mergeAll({ b: 2, c: 3 });
        expect(merged.get('a')).toBe(1);
        expect(merged.get('b')).toBe(2);
        expect(merged.get('c')).toBe(3);
    });

    it('mergeAll() throws ReadonlyViolationException when readonly', () => {
        const a = new JsonAccessor(makeParser()).from('{"a":1}').readonly(true);
        expect(() => a.mergeAll({ b: 2 })).toThrow(ReadonlyViolationException);
    });

    it('set() clone preserves readonly state', () => {
        const a = new JsonAccessor(makeParser()).from('{"x":1}').readonly(true);
        const b = a.readonly(false).set('x', 2);
        expect(b.get('x')).toBe(2);
    });

    it('set() clone inherits strict mode - security validation still enforced', () => {
        const a = new JsonAccessor(makeParser()).from('{"x":1}');
        const b = a.set('x', 2);
        expect(() => b.from('{"__proto__":"bad"}')).toThrow(SecurityException);
    });

    it('keys() returns [] when path resolves to null (typeof null is object in JS)', () => {
        const a = new JsonAccessor(makeParser()).from('{"a":null}');
        expect(a.keys('a')).toEqual([]);
    });

    it('count() returns 0 when path resolves to null (typeof null is object in JS)', () => {
        const a = new JsonAccessor(makeParser()).from('{"a":null}');
        expect(a.count('a')).toBe(0);
    });

    it('strict(false) bypasses payload size validation', () => {
        const tinyParser = new SecurityParser({ maxPayloadBytes: 5 });
        const parser = new DotNotationParser(new SecurityGuard(), tinyParser);
        const a = new JsonAccessor(parser).strict(false).from('{"name":"Alice"}');
        expect(a.get('name')).toBe('Alice');
    });

    it('strict(true) enforces payload size validation', () => {
        const tinyParser = new SecurityParser({ maxPayloadBytes: 5 });
        const parser = new DotNotationParser(new SecurityGuard(), tinyParser);
        expect(() => new JsonAccessor(parser).from('{"name":"Alice"}')).toThrow(SecurityException);
    });
});
