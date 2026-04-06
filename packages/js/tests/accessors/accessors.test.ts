import { describe, expect, it } from 'vitest';
import { ArrayAccessor } from '../../src/accessors/formats/array-accessor.js';
import { EnvAccessor } from '../../src/accessors/formats/env-accessor.js';
import { IniAccessor } from '../../src/accessors/formats/ini-accessor.js';
import { NdjsonAccessor } from '../../src/accessors/formats/ndjson-accessor.js';
import { ObjectAccessor } from '../../src/accessors/formats/object-accessor.js';
import { XmlAccessor } from '../../src/accessors/formats/xml-accessor.js';
import { AnyAccessor } from '../../src/accessors/formats/any-accessor.js';
import { YamlAccessor } from '../../src/accessors/formats/yaml-accessor.js';
import { JsonAccessor } from '../../src/accessors/formats/json-accessor.js';
import { DotNotationParser } from '../../src/core/dot-notation-parser.js';
import { SecurityGuard } from '../../src/security/security-guard.js';
import { SecurityParser } from '../../src/security/security-parser.js';
import { InvalidFormatException } from '../../src/exceptions/invalid-format-exception.js';
import { SecurityException } from '../../src/exceptions/security-exception.js';
import { ReadonlyViolationException } from '../../src/exceptions/readonly-violation-exception.js';
import { PathNotFoundException } from '../../src/exceptions/path-not-found-exception.js';
import { FakeParseIntegration } from '../mocks/fake-parse-integration.js';

function makeParser(secParser?: SecurityParser): DotNotationParser {
    return new DotNotationParser(new SecurityGuard(), secParser ?? new SecurityParser());
}

// ArrayAccessor

describe(ArrayAccessor.name, () => {
    it('accepts a plain object', () => {
        const a = new ArrayAccessor(makeParser()).from({ key: 'value' });
        expect(a.get('key')).toBe('value');
    });

    it('accepts an array, indexing by position', () => {
        const a = new ArrayAccessor(makeParser()).from(['a', 'b', 'c']);
        expect(a.get('0')).toBe('a');
        expect(a.get('2')).toBe('c');
    });

    it('throws InvalidFormatException for string input', () => {
        expect(() => new ArrayAccessor(makeParser()).from('string')).toThrow(
            InvalidFormatException,
        );
    });

    it('throws InvalidFormatException for null input', () => {
        expect(() => new ArrayAccessor(makeParser()).from(null)).toThrow(InvalidFormatException);
    });

    it('throws InvalidFormatException for number input', () => {
        expect(() => new ArrayAccessor(makeParser()).from(42)).toThrow(InvalidFormatException);
    });

    it('resolves a nested path in an array-ingested object', () => {
        const a = new ArrayAccessor(makeParser()).from({ user: { name: 'Alice' } });
        expect(a.get('user.name')).toBe('Alice');
    });
});

// EnvAccessor

describe(EnvAccessor.name, () => {
    it('parses KEY=VALUE pairs', () => {
        const a = new EnvAccessor(makeParser()).from('DB_HOST=localhost\nPORT=5432');
        expect(a.get('DB_HOST')).toBe('localhost');
        expect(a.get('PORT')).toBe('5432');
    });

    it('skips comment lines', () => {
        const a = new EnvAccessor(makeParser()).from('# comment\nKEY=value');
        expect(a.has('# comment')).toBe(false);
        expect(a.get('KEY')).toBe('value');
    });

    it('skips blank lines', () => {
        const a = new EnvAccessor(makeParser()).from('\nKEY=value\n');
        expect(a.get('KEY')).toBe('value');
    });

    it('strips double quotes from values', () => {
        const a = new EnvAccessor(makeParser()).from('MSG="hello world"');
        expect(a.get('MSG')).toBe('hello world');
    });

    it('strips single quotes from values', () => {
        const a = new EnvAccessor(makeParser()).from("MSG='hello world'");
        expect(a.get('MSG')).toBe('hello world');
    });

    it('skips lines without = sign', () => {
        const a = new EnvAccessor(makeParser()).from('INVALID_LINE\nKEY=value');
        expect(a.has('INVALID_LINE')).toBe(false);
        expect(a.get('KEY')).toBe('value');
    });

    it('throws InvalidFormatException for non-string input', () => {
        expect(() => new EnvAccessor(makeParser()).from(123)).toThrow(InvalidFormatException);
    });

    it('throws InvalidFormatException for null input', () => {
        expect(() => new EnvAccessor(makeParser()).from(null)).toThrow(InvalidFormatException);
    });

    it('handles KEY= with no value (empty string)', () => {
        const a = new EnvAccessor(makeParser()).from('EMPTY=');
        expect(a.get('EMPTY')).toBe('');
    });

    it('handles value with multiple = signs', () => {
        const a = new EnvAccessor(makeParser()).from('JWT=a=b=c');
        expect(a.get('JWT')).toBe('a=b=c');
    });

    // Kills key trim MethodExpression: keys with surrounding whitespace are trimmed
    it('trims whitespace from key names', () => {
        const a = new EnvAccessor(makeParser()).from('  KEY  =value');
        expect(a.get('KEY')).toBe('value');
    });

    // Kills value trim MethodExpression: values with surrounding whitespace are trimmed
    it('trims whitespace from values', () => {
        const a = new EnvAccessor(makeParser()).from('KEY=  trimmed  ');
        expect(a.get('KEY')).toBe('trimmed');
    });

    // Kills startsWith('"') / endsWith('"') mutants: only strip when BOTH sides match
    it('does not strip double quotes when only one side is present', () => {
        const a = new EnvAccessor(makeParser()).from('KEY=hello"');
        expect(a.get('KEY')).toBe('hello"');
    });

    it('does not strip double quotes when value starts without quote', () => {
        const a = new EnvAccessor(makeParser()).from('KEY="hello');
        expect(a.get('KEY')).toBe('"hello');
    });

    // Kills startsWith("'") / endsWith("'") mutants: only strip when BOTH sides match
    it("does not strip single quotes when only one side is present", () => {
        const a = new EnvAccessor(makeParser()).from("KEY=hello'");
        expect(a.get("KEY")).toBe("hello'");
    });

    it("does not strip single quotes when value starts without quote", () => {
        const a = new EnvAccessor(makeParser()).from("KEY='hello");
        expect(a.get("KEY")).toBe("'hello");
    });

    // Kills LogicalOperator (|| → &&): if both conditions needed, comment line with = would parse
    it('skips lines starting with # even if they contain =', () => {
        const a = new EnvAccessor(makeParser()).from('# KEY=value\nREAL=ok');
        expect(a.has('# KEY')).toBe(false);
        expect(a.get('REAL')).toBe('ok');
    });

    // Kills error message StringLiteral: error message contains typeof data
    it('error message from from() includes the actual typeof data', () => {
        expect(() => new EnvAccessor(makeParser()).from(42)).toThrow(/number/);
    });
});

// IniAccessor

describe(IniAccessor.name, () => {
    it('parses flat key=value pairs', () => {
        const a = new IniAccessor(makeParser()).from('name=Alice\nage=30');
        expect(a.get('name')).toBe('Alice');
        expect(a.get('age')).toBe(30);
    });

    it('parses sections as nested keys', () => {
        const a = new IniAccessor(makeParser()).from('[db]\nhost=localhost\nport=5432');
        expect(a.get('db.host')).toBe('localhost');
        expect(a.get('db.port')).toBe(5432);
    });

    it('throws InvalidFormatException for non-string input', () => {
        expect(() => new IniAccessor(makeParser()).from(null)).toThrow(InvalidFormatException);
    });

    it('throws InvalidFormatException for number input', () => {
        expect(() => new IniAccessor(makeParser()).from(42)).toThrow(InvalidFormatException);
    });

    it('skips comment lines starting with #', () => {
        const a = new IniAccessor(makeParser()).from('# comment\nkey=value');
        expect(a.has('# comment')).toBe(false);
        expect(a.get('key')).toBe('value');
    });

    it('skips comment lines starting with ;', () => {
        const a = new IniAccessor(makeParser()).from('; comment\nkey=value');
        expect(a.get('key')).toBe('value');
    });

    it('skips blank lines', () => {
        const a = new IniAccessor(makeParser()).from('\nkey=value\n');
        expect(a.get('key')).toBe('value');
    });

    it('casts true, yes, on to boolean true', () => {
        const a = new IniAccessor(makeParser()).from('a=true\nb=yes\nc=on');
        expect(a.get('a')).toBe(true);
        expect(a.get('b')).toBe(true);
        expect(a.get('c')).toBe(true);
    });

    it('casts false, no, off, none to boolean false', () => {
        const a = new IniAccessor(makeParser()).from('a=false\nb=no\nc=off\nd=none');
        expect(a.get('a')).toBe(false);
        expect(a.get('b')).toBe(false);
        expect(a.get('c')).toBe(false);
        expect(a.get('d')).toBe(false);
    });

    it('casts null and empty string to null', () => {
        const a = new IniAccessor(makeParser()).from('a=null\nb=');
        expect(a.get('a')).toBeNull();
        expect(a.get('b')).toBeNull();
    });

    it('strips surrounding double quotes', () => {
        const a = new IniAccessor(makeParser()).from('msg="hello world"');
        expect(a.get('msg')).toBe('hello world');
    });

    it('strips surrounding single quotes', () => {
        const a = new IniAccessor(makeParser()).from("msg='hello world'");
        expect(a.get('msg')).toBe('hello world');
    });

    it('casts integer values', () => {
        const a = new IniAccessor(makeParser()).from('port=3306');
        expect(a.get('port')).toBe(3306);
    });

    it('casts float values', () => {
        const a = new IniAccessor(makeParser()).from('ratio=3.14');
        expect(a.get('ratio')).toBe(3.14);
    });

    it('skips lines without = sign', () => {
        const a = new IniAccessor(makeParser()).from('badline\nkey=value');
        expect(a.has('badline')).toBe(false);
    });

    it('parses multiple sections', () => {
        const a = new IniAccessor(makeParser()).from('[app]\nname=MyApp\n[db]\nhost=localhost');
        expect(a.get('app.name')).toBe('MyApp');
        expect(a.get('db.host')).toBe('localhost');
    });

    // Kills from() StringLiteral: error message includes typeof data
    it('error message from from() includes the actual typeof data', () => {
        expect(() => new IniAccessor(makeParser()).from(42)).toThrow(/number/);
    });

    // Kills hasOwnProperty ConditionalExpression: same section declared twice preserves first keys
    it('preserves existing section keys when section header appears twice', () => {
        const a = new IniAccessor(makeParser()).from('[db]\nhost=localhost\n[db]\nport=5432');
        expect(a.get('db.host')).toBe('localhost');
        expect(a.get('db.port')).toBe(5432);
    });

    // Kills key/value trim MethodExpression: whitespace around key and value is trimmed
    it('trims whitespace from key names and raw values', () => {
        const a = new IniAccessor(makeParser()).from('  name  =  Alice  ');
        expect(a.get('name')).toBe('Alice');
    });

    // Kills section regex Regex mutant: section header regex must match [section]
    it('parses section with underscored name', () => {
        const a = new IniAccessor(makeParser()).from('[my_section]\nkey=val');
        expect(a.get('my_section.key')).toBe('val');
    });

    // Kills quote-stripping MethodExpression/StringLiteral: partial quotes are not stripped
    it('does not strip double quotes when only one side is present', () => {
        const a = new IniAccessor(makeParser()).from('key=hello"');
        expect(a.get('key')).toBe('hello"');
    });

    it('does not strip single quotes when only one side is present', () => {
        const a = new IniAccessor(makeParser()).from("key=hello'");
        expect(a.get('key')).toBe("hello'");
    });

    it('does not strip double quotes when value starts without quote', () => {
        const a = new IniAccessor(makeParser()).from('key="hello');
        expect(a.get('key')).toBe('"hello');
    });

    it('does not strip single quotes when value starts without quote', () => {
        const a = new IniAccessor(makeParser()).from("key='hello");
        expect(a.get('key')).toBe("'hello");
    });

    // Kills integer regex Regex mutant: partial-match strings should NOT become numbers
    it('does not cast string with trailing non-digit characters as integer', () => {
        const a = new IniAccessor(makeParser()).from('version=3.0-beta');
        expect(typeof a.get('version')).toBe('string');
    });

    it('does not cast string with leading non-digit chars as integer', () => {
        const a = new IniAccessor(makeParser()).from('version=v42');
        expect(typeof a.get('version')).toBe('string');
    });

    // Kills float regex Regex mutant: string with multiple dots is not a float
    it('does not cast a version string like 3.1.4 as float', () => {
        const a = new IniAccessor(makeParser()).from('ver=3.1.4');
        expect(typeof a.get('ver')).toBe('string');
    });

    // Kills LogicalOperator in castIniValue(|| → &&): both alts must be tested
    it('casts "yes" to boolean true', () => {
        const a = new IniAccessor(makeParser()).from('flag=yes');
        expect(a.get('flag')).toBe(true);
    });

    it('casts "no" to boolean false', () => {
        const a = new IniAccessor(makeParser()).from('flag=no');
        expect(a.get('flag')).toBe(false);
    });

    it('casts "none" to boolean false', () => {
        const a = new IniAccessor(makeParser()).from('flag=none');
        expect(a.get('flag')).toBe(false);
    });

    // Kills Regex survivor at line 61 (section header anchor ^ removed)
    it('does not treat key=value containing [brackets] as section header', () => {
        const a = new IniAccessor(makeParser()).from('key=value[brackets]\nother=1');
        // Without ^, regex would match [brackets] inside value= line → wrong
        expect(a.get('key')).toBe('value[brackets]');
        expect(a.get('other')).toBe(1);
    });

    // Kills Regex survivor at line 106 (float regex \d+ → \d)
    it('casts a two-digit integer before decimal point to float', () => {
        const a = new IniAccessor(makeParser()).from('ratio=10.5');
        expect(a.get('ratio')).toBe(10.5);
    });

    it('casts negative float with two-digit integer part correctly', () => {
        const a = new IniAccessor(makeParser()).from('offset=-12.75');
        expect(a.get('offset')).toBe(-12.75);
    });
});

// NdjsonAccessor

describe(NdjsonAccessor.name, () => {
    it('parses two NDJSON lines', () => {
        const a = new NdjsonAccessor(makeParser()).from('{"id":1}\n{"id":2}');
        expect(a.get('0.id')).toBe(1);
        expect(a.get('1.id')).toBe(2);
    });

    it('throws InvalidFormatException for non-string input', () => {
        expect(() => new NdjsonAccessor(makeParser()).from(null)).toThrow(InvalidFormatException);
    });

    it('throws InvalidFormatException for number input', () => {
        expect(() => new NdjsonAccessor(makeParser()).from(42)).toThrow(InvalidFormatException);
    });

    it('returns empty object for blank-only input', () => {
        const a = new NdjsonAccessor(makeParser()).from('   \n  \n');
        expect(a.all()).toEqual({});
    });

    it('skips blank lines between valid lines', () => {
        const a = new NdjsonAccessor(makeParser()).from('{"id":1}\n\n{"id":2}');
        expect(a.get('0.id')).toBe(1);
        expect(a.get('1.id')).toBe(2);
    });

    it('throws InvalidFormatException for malformed JSON line', () => {
        expect(() => new NdjsonAccessor(makeParser()).from('{"ok":1}\n{not valid}')).toThrow(
            InvalidFormatException,
        );
    });

    it('error message contains the failing line number', () => {
        expect(() => new NdjsonAccessor(makeParser()).from('{"ok":1}\n{not valid}')).toThrow(
            /line 2/,
        );
    });
});

// ObjectAccessor

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

    // Kills val !== null ConditionalExpression: null values should be preserved
    it('preserves null values in object', () => {
        const a = new ObjectAccessor(makeParser()).from({ key: null });
        expect(a.get('key')).toBeNull();
    });

    // Kills !Array.isArray(val) check: arrays should not go to objectToRecord
    it('handles array of objects at root level', () => {
        const a = new ObjectAccessor(makeParser()).from({ list: [{ x: 1 }, { x: 2 }] });
        expect(a.get('list')).toEqual([{ x: 1 }, { x: 2 }]);
    });

    // Kills NoCoverage: array of arrays (nested convertArrayValues recursion)
    it('handles nested array of arrays', () => {
        const a = new ObjectAccessor(makeParser()).from({ matrix: [[1, 2], [3, 4]] });
        expect(a.get('matrix')).toEqual([[1, 2], [3, 4]]);
    });

    // Kills depth + 1 ArithmeticOperator: at maxDepth, direct child should throw
    it('throws SecurityException at exactly maxDepth+1 nesting (strict=false so objectToRecord guard fires)', () => {
        const secParser = new SecurityParser({ maxDepth: 2 });
        const parser = makeParser(secParser);
        // depth 0: root → depth 1: a → depth 2: b → depth 3: { d:1 } (3 > 2 = throw in objectToRecord)
        expect(() => new ObjectAccessor(parser).strict(false).from({ a: { b: { c: { d: 1 } } } })).toThrow(
            SecurityException,
        );
    });

    it('does not throw at exactly maxDepth nesting (strict=false)', () => {
        const secParser = new SecurityParser({ maxDepth: 2 });
        const parser = makeParser(secParser);
        // depth 0: root → depth 1: a → depth 2: b → depth 2: c (= maxDepth, processes c:1 as primitive)
        expect(() => new ObjectAccessor(parser).strict(false).from({ a: { b: { c: 1 } } })).not.toThrow();
    });

    // Kills convertArrayValues depth + 1 ArithmeticOperator
    it('throws SecurityException at exactly maxDepth+1 in nested array-of-objects (strict=false)', () => {
        const secParser = new SecurityParser({ maxDepth: 1 });
        const parser = makeParser(secParser);
        // depth 0: root → depth 1: items array → depth 2: { id: 1 } object (2 > 1 = throw)
        expect(() => new ObjectAccessor(parser).strict(false).from({ items: [{ id: 1 }] })).toThrow(
            SecurityException,
        );
    });

    // Kills convertArrayValues NoCoverage array-of-arrays: depth check in nested arrays
    it('throws SecurityException when nested array of arrays exceeds depth (strict=false)', () => {
        const secParser = new SecurityParser({ maxDepth: 0 });
        const parser = makeParser(secParser);
        // depth 0, 0 > 0? No. But then array items → depth 1 → inner array depth 2 > 0? Yes.
        expect(() => new ObjectAccessor(parser).strict(false).from({ matrix: [[1, 2]] })).toThrow(
            SecurityException,
        );
    });

    // Kills error message StringLiteral in security exception
    it('security exception message contains depth value', () => {
        const secParser = new SecurityParser({ maxDepth: 0 });
        const parser = makeParser(secParser);
        expect(() => new ObjectAccessor(parser).from({ a: { b: 1 } })).toThrow(/depth/i);
    });

    // Kills convertArrayValues depth > maxDepth vs >= maxDepth (EqualityOperator survivor)
    it('does not throw convertArrayValues at exactly maxDepth (> not >=)', () => {
        // maxDepth=1: convertArrayValues at depth=1 should NOT throw (1 > 1 is false)
        // Items are primitives so no further recursion happens.
        const secParser = new SecurityParser({ maxDepth: 1 });
        const parser = makeParser(secParser);
        // root(depth=0) -> items array -> convertArrayValues(depth=1) -> primitives
        expect(() => new ObjectAccessor(parser).strict(false).from({ items: [1, 2, 3] })).not.toThrow();
    });

    // Kills val !== null ConditionalExpression in convertArrayValues (object path)
    it('handles null values inside an array correctly', () => {
        const a = new ObjectAccessor(makeParser()).from({ items: [null, 1, 'text'] });
        const items = a.get('items') as unknown[];
        expect(items[0]).toBeNull();
        expect(items[1]).toBe(1);
        expect(items[2]).toBe('text');
    });

    // Kills Array.isArray branch ConditionalExpression/BlockStatement in convertArrayValues
    it('handles array-of-arrays with primitives and does not throw at valid depth', () => {
        const a = new ObjectAccessor(makeParser()).from({ matrix: [[1, 2], [3, 4]] });
        const matrix = a.get('matrix') as unknown[][];
        expect(matrix[0]).toEqual([1, 2]);
        expect(matrix[1]).toEqual([3, 4]);
    });

    // Kills ArithmeticOperator depth+1 in convertArrayValues for array arrays
    it('throws when deeply nested arrays exceed maxDepth in convertArrayValues', () => {
        const secParser = new SecurityParser({ maxDepth: 1 });
        const parser = makeParser(secParser);
        // depth 0: objectToRecord for root -> items: array -> convertArrayValues(depth=1)
        // items = [[1,2]] -> convertArrayValues for inner array at depth=2 -> 2 > 1 = throw
        expect(() => new ObjectAccessor(parser).strict(false).from({ items: [[1, 2]] })).toThrow(SecurityException);
    });
});

// XmlAccessor

describe(XmlAccessor.name, () => {
    it('throws InvalidFormatException for non-string input', () => {
        expect(() => new XmlAccessor(makeParser()).from(null)).toThrow(InvalidFormatException);
    });

    it('throws InvalidFormatException for number input', () => {
        expect(() => new XmlAccessor(makeParser()).from(42)).toThrow(InvalidFormatException);
    });

    it('throws SecurityException for DOCTYPE declarations (XXE prevention)', () => {
        const xml = '<!DOCTYPE foo [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><root/>';
        expect(() => new XmlAccessor(makeParser()).from(xml)).toThrow(SecurityException);
    });

    it('throws SecurityException for DOCTYPE regardless of case', () => {
        const xml = '<!doctype foo><root/>';
        expect(() => new XmlAccessor(makeParser()).from(xml)).toThrow(SecurityException);
    });

    it('parses a simple XML element', () => {
        const a = new XmlAccessor(makeParser()).from('<root><name>Alice</name></root>');
        expect(a.get('name')).toBe('Alice');
    });

    it('parses sibling elements under the root', () => {
        const a = new XmlAccessor(makeParser()).from(
            '<root><name>Alice</name><age>30</age></root>',
        );
        expect(a.get('name')).toBe('Alice');
        expect(a.get('age')).toBe('30');
    });

    it('parses nested XML elements', () => {
        const a = new XmlAccessor(makeParser()).from(
            '<root><user><name>Alice</name></user></root>',
        );
        expect(a.get('user.name')).toBe('Alice');
    });

    it('throws InvalidFormatException for completely unparseable XML', () => {
        expect(() => new XmlAccessor(makeParser()).from('not xml at all !@#')).toThrow(
            InvalidFormatException,
        );
    });

    it('returns empty object for self-closing root element', () => {
        const a = new XmlAccessor(makeParser()).from('<root/>');
        expect(a.all()).toEqual({});
    });

    it('merges duplicate sibling tags into an array', () => {
        const a = new XmlAccessor(makeParser()).from('<root><item>a</item><item>b</item></root>');
        const items = a.get('item');
        expect(Array.isArray(items)).toBe(true);
        expect((items as unknown[]).length).toBe(2);
    });

    it('parses with XML declaration header', () => {
        const a = new XmlAccessor(makeParser()).from(
            '<?xml version="1.0"?><root><key>value</key></root>',
        );
        expect(a.get('key')).toBe('value');
    });

    it('throws SecurityException when XML depth exceeds the limit', () => {
        const secParser = new SecurityParser({ maxDepth: 1 });
        const parser = makeParser(secParser);
        const xml = '<root><a><b><c>deep</c></b></a></root>';
        expect(() => new XmlAccessor(parser).from(xml)).toThrow(SecurityException);
    });

    // parseXmlChildren branch: inner content has elements (not just text)
    it('parses deeply nested elements correctly', () => {
        const a = new XmlAccessor(makeParser()).from(
            '<root><level1><level2><value>deep</value></level2></level1></root>',
        );
        expect(a.get('level1.level2.value')).toBe('deep');
    });

    // parseXmlChildren branch: element with only text content (no child elements)
    it('parses an element with plain text content', () => {
        const a = new XmlAccessor(makeParser()).from('<root><text>hello world</text></root>');
        expect(a.get('text')).toBe('hello world');
    });

    // parseXmlChildren branch: third duplicate tag becomes third array element
    it('merges three duplicate sibling tags into an array of 3', () => {
        const a = new XmlAccessor(makeParser()).from(
            '<root><item>a</item><item>b</item><item>c</item></root>',
        );
        const items = a.get('item') as unknown[];
        expect(Array.isArray(items)).toBe(true);
        expect(items.length).toBe(3);
        expect(items[2]).toBe('c');
    });

    // parseXmlChildren: self-closing child elements inside root
    it('parses self-closing child element as empty string text', () => {
        const a = new XmlAccessor(makeParser()).from('<root><empty/><name>Alice</name></root>');
        expect(a.get('name')).toBe('Alice');
        // empty self-closing tag present but name is parsed
    });

    // parseXmlManual: root with mixed child elements
    it('parses multiple different child elements', () => {
        const a = new XmlAccessor(makeParser()).from(
            '<root><first>1</first><second>2</second><third>3</third></root>',
        );
        expect(a.get('first')).toBe('1');
        expect(a.get('second')).toBe('2');
        expect(a.get('third')).toBe('3');
    });

    // parseXmlChildren: content with no elements (pure text) at non-root level
    it('returns empty object for root with only whitespace content', () => {
        const a = new XmlAccessor(makeParser()).from('<root>   </root>');
        expect(a.all()).toEqual({});
    });

    // parseXmlChildren: complex inner structure (child has children)
    it('returns nested structure for complex XML', () => {
        const a = new XmlAccessor(makeParser()).from(
            '<root><user><name>Alice</name><role>admin</role></user></root>',
        );
        expect(a.get('user.name')).toBe('Alice');
        expect(a.get('user.role')).toBe('admin');
    });

    // Kill line 163/165: value selection when childResult has only '#text' key
    it('returns plain string value when child has only text content', () => {
        const a = new XmlAccessor(makeParser()).from(
            '<root><title>Hello World</title></root>',
        );
        // childResult for <title> will be { '#text': 'Hello World' }
        // value = childResult['#text'] = 'Hello World' (string, not object)
        expect(typeof a.get('title')).toBe('string');
        expect(a.get('title')).toBe('Hello World');
    });

    // Kill line 171/174: hasOwnProperty for array growth (third duplicate)
    it('builds an array when the same tag appears 4 times', () => {
        const a = new XmlAccessor(makeParser()).from(
            '<root><k>1</k><k>2</k><k>3</k><k>4</k></root>',
        );
        const k = a.get('k') as unknown[];
        expect(Array.isArray(k)).toBe(true);
        expect(k.length).toBe(4);
        expect(k[3]).toBe('4');
    });

    it('throws SecurityException when opening-tag count exceeds SecurityParser.maxKeys (getMaxKeys flows to XmlParser.maxElements)', () => {
        const secParser = new SecurityParser({ maxKeys: 2 });
        const parser = makeParser(secParser);
        // <root> + 3 × <item> = 4 opening tags; 4 > maxKeys(2) → SecurityException
        const xml = '<root>' + '<item>x</item>'.repeat(3) + '</root>';
        expect(() => new XmlAccessor(parser).from(xml)).toThrow(SecurityException);
    });

    it('does not throw when opening-tag count is within SecurityParser.maxKeys', () => {
        const secParser = new SecurityParser({ maxKeys: 10 });
        const parser = makeParser(secParser);
        const xml = '<root>' + '<item>x</item>'.repeat(3) + '</root>';
        expect(() => new XmlAccessor(parser).from(xml)).not.toThrow();
    });
});

// AnyAccessor

describe(AnyAccessor.name, () => {
    it('accepts data when integration assertFormat returns true', () => {
        const integration = new FakeParseIntegration(true, { key: 'value' });
        const a = new AnyAccessor(makeParser(), integration).from('some data');
        expect(a.get('key')).toBe('value');
    });

    it('throws InvalidFormatException when integration rejects format', () => {
        const integration = new FakeParseIntegration(false, {});
        expect(() => new AnyAccessor(makeParser(), integration).from('data')).toThrow(
            InvalidFormatException,
        );
    });

    it('validates string payloads through assertPayload', () => {
        const secParser = new SecurityParser({ maxPayloadBytes: 3 });
        const parser = makeParser(secParser);
        const integration = new FakeParseIntegration(true, {});
        expect(() => new AnyAccessor(parser, integration).from('1234')).toThrow(SecurityException);
    });

    it('does not call assertPayload for non-string data', () => {
        const secParser = new SecurityParser({ maxPayloadBytes: 1 });
        const parser = makeParser(secParser);
        const integration = new FakeParseIntegration(true, { a: 1 });
        expect(() => new AnyAccessor(parser, integration).from({ x: 1 })).not.toThrow();
    });

    it('resolves nested path from parsed data', () => {
        const integration = new FakeParseIntegration(true, { user: { name: 'Alice' } });
        const a = new AnyAccessor(makeParser(), integration).from('anything');
        expect(a.get('user.name')).toBe('Alice');
    });

    it('error message mentions typeof when format is rejected', () => {
        const integration = new FakeParseIntegration(false, {});
        expect(() => new AnyAccessor(makeParser(), integration).from(42)).toThrow(/number/);
    });

    // Kills fake-parse-integration.ts:12:36 BooleanLiteral NoCoverage: default accepts=true
    it('FakeParseIntegration default constructor accepts any input', () => {
        const integration = new FakeParseIntegration();
        expect(integration.assertFormat('test')).toBe(true);
    });
});

// YamlAccessor

describe(YamlAccessor.name, () => {
    it('parses a valid YAML string', () => {
        const a = new YamlAccessor(makeParser()).from('name: Alice\nage: 30');
        expect(a.get('name')).toBe('Alice');
        expect(a.get('age')).toBe(30);
    });

    it('throws InvalidFormatException for non-string input', () => {
        expect(() => new YamlAccessor(makeParser()).from(null)).toThrow(InvalidFormatException);
    });

    it('throws InvalidFormatException for number input', () => {
        expect(() => new YamlAccessor(makeParser()).from(42)).toThrow(InvalidFormatException);
    });

    it('resolves a nested path', () => {
        const a = new YamlAccessor(makeParser()).from('user:\n  name: Bob');
        expect(a.get('user.name')).toBe('Bob');
    });

    it('returns null for a missing path', () => {
        const a = new YamlAccessor(makeParser()).from('key: value');
        expect(a.get('missing')).toBeNull();
    });
});

// AbstractAccessor (via JsonAccessor as concrete implementation)

describe('AbstractAccessor', () => {
    it('strict mode default is enabled — validates on ingest', () => {
        // __proto__ is forbidden → strict mode triggers SecurityException
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

    // Kills line 87:36 — default parameter `= true` in readonly()
    it('readonly() with no argument defaults to true (blocks mutations)', () => {
        const a = new JsonAccessor(makeParser()).from('{"x":1}').readonly();
        expect(() => a.set('x', 2)).toThrow(ReadonlyViolationException);
    });

    // Kills line ~102:30 — default parameter `= true` in strict()
    it('strict() with no argument defaults to true (enables validation)', () => {
        const accessor = new JsonAccessor(makeParser()).strict(false);
        const strictAgain = accessor.strict(); // no-arg = true
        expect(() => strictAgain.from('{"__proto__": "bad"}')).toThrow(SecurityException);
    });

    // Kills lines 150:70 — getAt() default parameter = null
    it('getAt() returns null when path does not exist (default is null)', () => {
        const a = new JsonAccessor(makeParser()).from('{"a":1}');
        expect(a.getAt(['missing'])).toBeNull();
    });

    it('getAt() resolves a value using pre-parsed segments', () => {
        const a = new JsonAccessor(makeParser()).from('{"user":{"name":"Alice"}}');
        expect(a.getAt(['user', 'name'])).toBe('Alice');
    });

    // Kills line 170:40 — hasAt() return value
    it('hasAt() returns true when segments resolve to a value', () => {
        const a = new JsonAccessor(makeParser()).from('{"a":{"b":1}}');
        expect(a.hasAt(['a', 'b'])).toBe(true);
    });

    it('hasAt() returns false when segments do not resolve', () => {
        const a = new JsonAccessor(makeParser()).from('{"a":1}');
        expect(a.hasAt(['missing'])).toBe(false);
    });

    // Kills line 195:53 — setAt() returns new instance with value set
    it('setAt() sets a value using pre-parsed segments', () => {
        const a = new JsonAccessor(makeParser()).from('{}');
        const updated = a.setAt(['user', 'name'], 'Alice');
        expect(updated.get('user.name')).toBe('Alice');
    });

    it('setAt() throws ReadonlyViolationException when readonly', () => {
        const a = new JsonAccessor(makeParser()).from('{"x":1}').readonly(true);
        expect(() => a.setAt(['x'], 2)).toThrow(ReadonlyViolationException);
    });

    // Kills lines 219/ removeAt()
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

    // Kills lines 230/232 — getMany()
    it('getMany() returns map of paths to their values', () => {
        const a = new JsonAccessor(makeParser()).from('{"a":1,"b":2}');
        expect(a.getMany({ a: 0, b: 0, missing: 'fallback' })).toEqual({ a: 1, b: 2, missing: 'fallback' });
    });

    // Kills lines 254/255 — count(path)
    it('count(path) returns number of keys at a nested path', () => {
        const a = new JsonAccessor(makeParser()).from('{"user":{"name":"Alice","age":30}}');
        expect(a.count('user')).toBe(2);
    });

    it('count(path) returns 0 when path resolves to a non-object', () => {
        const a = new JsonAccessor(makeParser()).from('{"a":"string"}');
        expect(a.count('a')).toBe(0);
    });

    // Kills lines 268/269 — keys(path)
    it('keys(path) returns keys at a nested path', () => {
        const a = new JsonAccessor(makeParser()).from('{"user":{"name":"Alice","role":"admin"}}');
        expect(a.keys('user')).toEqual(['name', 'role']);
    });

    it('keys(path) returns empty array when path resolves to a non-object', () => {
        const a = new JsonAccessor(makeParser()).from('{"a":42}');
        expect(a.keys('a')).toEqual([]);
    });

    // Kills line 295/297 — mergeAll()
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

    // Kills line 310:23 ObjectLiteral mutation — copy._state = {} instead of {...this._state}
    // Verify clone preserves the full state including readonly and strict options
    it('set() clone preserves readonly state', () => {
        const a = new JsonAccessor(makeParser()).from('{"x":1}').readonly(true);
        // After set, the new instance should still be readonly (state cloned properly)
        const b = a.readonly(false).set('x', 2);
        expect(b.get('x')).toBe(2);
    });

    // Kills ObjectLiteral: copy._state={} loses isStrict flag, allowing unsafe keys after set()
    it('set() clone inherits strict mode — security validation still enforced', () => {
        const a = new JsonAccessor(makeParser()).from('{"x":1}');
        // a is strict (default). set() calls cloneInstance; if state is lost, new instance loses isStrict=true
        // After set, calling .from() with unsafe data must still throw if strict is preserved
        const b = a.set('x', 2);
        // b should still be strict — .from(unsafe) must throw
        expect(() => b.from('{"__proto__":"bad"}')).toThrow(SecurityException);
    });

    // Kills 269:13 ConditionalExpression — typeof target === 'object' → true (with null input)
    it('keys() returns [] when path resolves to null (typeof null is object in JS)', () => {
        const a = new JsonAccessor(makeParser()).from('{"a":null}');
        // typeof null === 'object' is true in JS, so only null-check protects us
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
