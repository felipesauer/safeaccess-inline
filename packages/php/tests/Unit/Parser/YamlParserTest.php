<?php

declare(strict_types=1);

use SafeAccess\Inline\Exceptions\YamlParseException;
use SafeAccess\Inline\Parser\Yaml\YamlParser;

describe(YamlParser::class, function (): void {
    beforeEach(function (): void {
        $this->parser = new YamlParser();
    });

    // parse() — happy path / structure
    describe(YamlParser::class . ' > parse basics', function (): void {
        it('parses a flat key-value map', function (): void {
            $yaml = "name: Alice\nage: 30";

            $result = $this->parser->parse($yaml);

            expect($result)->toBe(['name' => 'Alice', 'age' => 30]);
        });

        it('parses nested map', function (): void {
            $yaml = "user:\n  name: Alice\n  age: 30";

            $result = $this->parser->parse($yaml);

            expect($result['user'])->toBe(['name' => 'Alice', 'age' => 30]);
        });

        it('parses a three-level nested map', function (): void {
            $yaml = "a:\n  b:\n    c: deep";

            $result = $this->parser->parse($yaml);

            expect($result['a']['b']['c'])->toBe('deep');
        });

        it('parses a top-level sequence', function (): void {
            $yaml = "- Alice\n- Bob\n- Carol";

            $result = $this->parser->parse($yaml);

            expect($result)->toBe(['Alice', 'Bob', 'Carol']);
        });

        it('parses a sequence of maps', function (): void {
            $yaml = "- name: Alice\n  age: 30\n- name: Bob\n  age: 25";

            $result = $this->parser->parse($yaml);

            expect($result)->toHaveCount(2);
            expect($result[0]['name'])->toBe('Alice');
            expect($result[1]['age'])->toBe(25);
        });

        it('returns an empty array for an empty string', function (): void {
            $result = $this->parser->parse('');

            expect($result)->toBe([]);
        });

        it('returns an empty array for a comment-only document', function (): void {
            $result = $this->parser->parse("# just a comment\n# another comment");

            expect($result)->toBe([]);
        });

        it('ignores inline comments after values', function (): void {
            $yaml = "name: Alice # this is Alice\nage: 30 # thirty";

            $result = $this->parser->parse($yaml);

            expect($result['name'])->toBe('Alice');
            expect($result['age'])->toBe(30);
        });
    });

    // parse() — scalar types
    describe(YamlParser::class . ' > parse scalar types', function (): void {
        it('parses boolean true values', function (): void {
            $yaml = "a: true\nb: yes\nc: on";

            $result = $this->parser->parse($yaml);

            expect($result['a'])->toBeTrue();
            expect($result['b'])->toBeTrue();
            expect($result['c'])->toBeTrue();
        });

        it('parses boolean false values', function (): void {
            $yaml = "a: false\nb: no\nc: off";

            $result = $this->parser->parse($yaml);

            expect($result['a'])->toBeFalse();
            expect($result['b'])->toBeFalse();
            expect($result['c'])->toBeFalse();
        });

        it('parses null values', function (): void {
            $yaml = "a: null\nb: ~\nc: Null";

            $result = $this->parser->parse($yaml);

            expect($result['a'])->toBeNull();
            expect($result['b'])->toBeNull();
            expect($result['c'])->toBeNull();
        });

        it('parses integer values', function (): void {
            $yaml = "positive: 42\nnegative: -10\nzero: 0";

            $result = $this->parser->parse($yaml);

            expect($result['positive'])->toBe(42);
            expect($result['negative'])->toBe(-10);
            expect($result['zero'])->toBe(0);
        });

        it('parses float values', function (): void {
            $yaml = "pi: 3.14\nsci: 1.5e2";

            $result = $this->parser->parse($yaml);

            expect($result['pi'])->toBe(3.14);
            expect($result['sci'])->toBe(1.5e2);
        });

        it('parses double-quoted strings preserving content', function (): void {
            $yaml = 'greeting: "Hello, World!"';

            $result = $this->parser->parse($yaml);

            expect($result['greeting'])->toBe('Hello, World!');
        });

        it('parses single-quoted strings verbatim', function (): void {
            $yaml = "msg: 'it''s alive'";

            $result = $this->parser->parse($yaml);

            expect($result['msg'])->toBe("it's alive");
        });
    });

    // parse() — flow syntax
    describe(YamlParser::class . ' > parse flow syntax', function (): void {
        it('parses an inline flow sequence', function (): void {
            $yaml = "items: [a, b, c]";

            $result = $this->parser->parse($yaml);

            expect($result['items'])->toBe(['a', 'b', 'c']);
        });

        it('parses an inline flow map', function (): void {
            $yaml = "coord: {x: 1, y: 2}";

            $result = $this->parser->parse($yaml);

            expect($result['coord'])->toBe(['x' => 1, 'y' => 2]);
        });
    });

    // parse() — block scalars
    describe(YamlParser::class . ' > parse block scalars', function (): void {
        it('parses a literal block scalar with pipe (|)', function (): void {
            $yaml = "text: |\n  line one\n  line two";

            $result = $this->parser->parse($yaml);

            expect($result['text'])->toContain('line one');
            expect($result['text'])->toContain('line two');
        });

        it('parses a folded block scalar with (>)', function (): void {
            $yaml = "text: >\n  folded line one\n  folded line two";

            $result = $this->parser->parse($yaml);

            expect($result['text'])->toContain('folded line one');
        });

        it('parses a literal block scalar with chomping strip (|-)', function (): void {
            $yaml = "text: |-\n  no trailing newline";

            $result = $this->parser->parse($yaml);

            expect($result['text'])->toBe('no trailing newline');
        });
    });

    // parse() — unsafe constructs → exceptions
    describe(YamlParser::class . ' > parse unsafe constructs', function (): void {
        it('throws YamlParseException for a YAML tag (!! syntax)', function (): void {
            $yaml = "name: !!str Alice";

            expect(fn () => $this->parser->parse($yaml))
                ->toThrow(YamlParseException::class);
        });
        it('throws YamlParseException for a single-! custom YAML tag', function (): void {
            $yaml = "value: !customType Alice";

            expect(fn () => $this->parser->parse($yaml))
                ->toThrow(YamlParseException::class);
        });

        it('throws YamlParseException for a single-! tag:yaml.org URI', function (): void {
            $yaml = "value: !<tag:yaml.org,2002:int> 42";

            expect(fn () => $this->parser->parse($yaml))
                ->toThrow(YamlParseException::class);
        });

        it('throws YamlParseException with the expected error message for single-! tag', function (): void {
            $yaml = "value: !php/object 'O:8:\"stdClass\":0:{}'";

            expect(fn () => $this->parser->parse($yaml))
                ->toThrow(YamlParseException::class, 'tags (! and !! syntax) are not supported');
        });

        it('throws YamlParseException with the expected error message for !! tag', function (): void {
            $yaml = "name: !!str Alice";

            expect(fn () => $this->parser->parse($yaml))
                ->toThrow(YamlParseException::class, 'tags (! and !! syntax) are not supported');
        });

        it('throws YamlParseException for a ! tag in a sequence item', function (): void {
            $yaml = "- !tag value";

            expect(fn () => $this->parser->parse($yaml))
                ->toThrow(YamlParseException::class);
        });

        it('throws YamlParseException for a ! tag in a flow map value', function (): void {
            $yaml = "{key: !tag value}";

            expect(fn () => $this->parser->parse($yaml))
                ->toThrow(YamlParseException::class);
        });

        it('does not throw for a quoted string containing a trailing exclamation mark', function (): void {
            $yaml = "priority: 'important!'";

            $result = $this->parser->parse($yaml);

            expect($result)->toBe(['priority' => "important!"]);
        });

        it('throws YamlParseException for a YAML anchor (&)', function (): void {
            $yaml = "base: &anchor\n  name: Alice";

            expect(fn () => $this->parser->parse($yaml))
                ->toThrow(YamlParseException::class);
        });

        it('throws YamlParseException for a YAML alias (*)', function (): void {
            $yaml = "copy: *anchor";

            expect(fn () => $this->parser->parse($yaml))
                ->toThrow(YamlParseException::class);
        });

        it('throws YamlParseException for a merge key (<<:)', function (): void {
            $yaml = "<<: {name: Alice}";

            expect(fn () => $this->parser->parse($yaml))
                ->toThrow(YamlParseException::class);
        });
    });

    // parse() — coverage-gap scenarios
    describe(YamlParser::class . ' > parse edge cases', function (): void {
        it('skips an over-indented continuation line inside a sequence block', function (): void {
            // Lines 122-123: currentIndent > baseIndent inside sequence parsing
            $yaml = "list:\n  - item1\n    extra_continuation\n  - item2";

            $result = $this->parser->parse($yaml);

            expect($result['list'])->toContain('item1');
            expect($result['list'])->toContain('item2');
        });

        it('skips a comment line inside a sequence item submap', function (): void {
            // Lines 146-147: comment within sequence item map child loop
            $yaml = "- name: Alice\n  # a comment here\n  age: 30";

            $result = $this->parser->parse($yaml);

            expect($result[0]['name'])->toBe('Alice');
            expect($result[0]['age'])->toBe(30);
        });

        it('increments position for a non-key-value child in a sequence submap', function (): void {
            // Line 161: else branch ($ci++) — child line not matching key:value
            $yaml = "- name: Alice\n  continuation_value\n  age: 30";

            $result = $this->parser->parse($yaml);

            expect($result[0]['name'])->toBe('Alice');
        });

        it('parses a bare dash sequence item as null when no child content follows', function (): void {
            // Lines 174-175: itemContent is '' and no child block → null
            $yaml = "-";

            $result = $this->parser->parse($yaml);

            expect($result[0])->toBeNull();
        });

        it('parses a bare dash sequence item with nested map content', function (): void {
            // Lines 170-172: itemContent is '' and child block exists → parseLines
            $yaml = "-\n  name: Bob\n  age: 25";

            $result = $this->parser->parse($yaml);

            expect($result[0]['name'])->toBe('Bob');
            expect($result[0]['age'])->toBe(25);
        });

        it('advances past an unrecognized non-key-value line at map level', function (): void {
            // Line 198: $i++ fallback — line is neither sequence nor map key
            $yaml = "key: Alice\n0123\nnext: Bob";

            $result = $this->parser->parse($yaml);

            expect($result['key'])->toBe('Alice');
            expect($result['next'])->toBe('Bob');
        });

        it('returns null for a key whose value is empty with no child block', function (): void {
            // Line 240: rawValue empty + childEnd == currentLine+1 → return null
            $yaml = "empty_key:\nnext: val";

            $result = $this->parser->parse($yaml);

            expect($result['empty_key'])->toBeNull();
            expect($result['next'])->toBe('val');
        });

        it('preserves blank lines inside a literal block scalar', function (): void {
            // Lines 277-278: blank line inside parseBlockScalar → $blockLines[] = ''
            $yaml = "text: |\n  line one\n\n  line three";

            $result = $this->parser->parse($yaml);

            expect($result['text'])->toContain('line one');
            expect($result['text'])->toContain('line three');
            expect($result['text'])->toContain("\n\n");
        });

        it('strips text after the first over-dedented line in a block scalar', function (): void {
            // Line 287: break when lineIndent < actualIndent inside parseBlockScalar
            $yaml = "text: |\n      deeply_indented\n  back_to_normal";

            $result = $this->parser->parse($yaml);

            expect($result['text'])->toContain('deeply_indented');
        });

        it('strips trailing blank lines from a block scalar with chomping strip', function (): void {
            // Line 296: strip chomping removes trailing blank lines
            $yaml = "text: |-\n  content\n\n  ";

            $result = $this->parser->parse($yaml);

            expect($result['text'])->toBe('content');
        });

        it('folds a folded block scalar with an internal blank line into a newline', function (): void {
            // Lines 308-309: folded block scalar, blank line becomes "\n"
            $yaml = "text: >\n  first line\n\n  second line";

            $result = $this->parser->parse($yaml);

            expect($result['text'])->toContain('first line');
            expect($result['text'])->toContain('second line');
            expect($result['text'])->toContain("\n");
        });

        it('strips an inline comment from a value', function (): void {
            // Line 390: trimInlineComment enters the double-quote tracking branch
            $yaml = "msg: \"hello\" # comment\nkey: world # ignored";

            $result = $this->parser->parse($yaml);

            expect($result['msg'])->toBe('hello');
            expect($result['key'])->toBe('world');
        });

        it('casts an octal integer value', function (): void {
            // Line 442: octal integer (0o prefix)
            $yaml = "val: 0o17";

            $result = $this->parser->parse($yaml);

            expect($result['val'])->toBe(15);
        });

        it('casts a hexadecimal integer value', function (): void {
            // Line 445: hex integer (0x prefix)
            $yaml = "val: 0xFF";

            $result = $this->parser->parse($yaml);

            expect($result['val'])->toBe(255);
        });

        it('casts .inf to PHP INF', function (): void {
            // Line 453: positive infinity
            $yaml = "val: .inf";

            $result = $this->parser->parse($yaml);

            expect($result['val'])->toBe(INF);
        });

        it('casts -.inf to PHP negative INF', function (): void {
            // Line 456: negative infinity
            $yaml = "val: -.inf";

            $result = $this->parser->parse($yaml);

            expect($result['val'])->toBe(-INF);
        });

        it('casts .nan to PHP NAN', function (): void {
            // Line 459: NaN
            $yaml = "val: .nan";

            $result = $this->parser->parse($yaml);

            expect(is_nan($result['val']))->toBeTrue();
        });

        it('parses an empty inline flow sequence as an empty array', function (): void {
            // Line 499: parseFlowSequence returns [] when inner is empty
            $yaml = "items: []";

            $result = $this->parser->parse($yaml);

            expect($result['items'])->toBe([]);
        });

        it('parses an empty inline flow map as an empty array', function (): void {
            // Line 517: parseFlowMap returns [] when inner is empty
            $yaml = "coord: {}";

            $result = $this->parser->parse($yaml);

            expect($result['coord'])->toBe([]);
        });

        it('skips a flow map item that contains no colon', function (): void {
            // Line 526: flow map item without ':' is skipped
            $yaml = "meta: {valid: 1, bad_no_colon, other: 2}";

            $result = $this->parser->parse($yaml);

            expect($result['meta']['valid'])->toBe(1);
            expect($result['meta']['other'])->toBe(2);
        });

        it('handles quoted strings inside a flow sequence', function (): void {
            // Lines 556-567: splitFlowItems — quoted string tracking
            $yaml = 'items: [a, "b,c", d]';

            $result = $this->parser->parse($yaml);

            expect($result['items'])->toHaveCount(3);
            expect($result['items'][1])->toBe('b,c');
        });

        it('handles nested brackets inside a flow sequence', function (): void {
            // Lines 570-579: splitFlowItems — depth tracking for nested brackets
            $yaml = "matrix: [[1,2],[3,4]]";

            $result = $this->parser->parse($yaml);

            expect($result['matrix'])->toHaveCount(2);
        });
    });
});
