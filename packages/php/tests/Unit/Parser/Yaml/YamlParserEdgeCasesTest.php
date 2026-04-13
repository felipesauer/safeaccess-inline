<?php

declare(strict_types=1);

use SafeAccess\Inline\Exceptions\YamlParseException;
use SafeAccess\Inline\Parser\Yaml\YamlParser;

describe(YamlParser::class, function (): void {
    beforeEach(function (): void {
        $this->parser = new YamlParser();
    });

    // parse() - unsafe constructs → exceptions
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

        it('throws YamlParseException for an anchor with hyphens (&my-anchor)', function (): void {
            $yaml = "base: &my-anchor\n  name: Alice";

            expect(fn () => $this->parser->parse($yaml))
                ->toThrow(YamlParseException::class);
        });

        it('throws YamlParseException for a YAML alias (*)', function (): void {
            $yaml = "copy: *anchor";

            expect(fn () => $this->parser->parse($yaml))
                ->toThrow(YamlParseException::class);
        });

        it('throws YamlParseException for an alias with hyphens (*my-alias)', function (): void {
            $yaml = "copy: *my-alias";

            expect(fn () => $this->parser->parse($yaml))
                ->toThrow(YamlParseException::class);
        });

        it('throws YamlParseException for a merge key (<<:)', function (): void {
            $yaml = "<<: {name: Alice}";

            expect(fn () => $this->parser->parse($yaml))
                ->toThrow(YamlParseException::class);
        });
    });

    // parse() - coverage-gap scenarios
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
            // Line 161: else branch ($ci++) - child line not matching key:value
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
            // Line 198: $i++ fallback - line is neither sequence nor map key
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
            // Lines 556-567: splitFlowItems - quoted string tracking
            $yaml = 'items: [a, "b,c", d]';

            $result = $this->parser->parse($yaml);

            expect($result['items'])->toHaveCount(3);
            expect($result['items'][1])->toBe('b,c');
        });

        it('handles nested brackets inside a flow sequence', function (): void {
            // Lines 570-579: splitFlowItems - depth tracking for nested brackets
            $yaml = "matrix: [[1,2],[3,4]]";

            $result = $this->parser->parse($yaml);

            expect($result['matrix'])->toHaveCount(2);
        });
    });
});

describe(YamlParser::class . ' > nesting depth guard', function (): void {
    it('parses YAML within the default depth limit', function (): void {
        $yaml = "a:\n  b:\n    c:\n      d: value";
        $parser = new YamlParser();
        $result = $parser->parse($yaml);
        expect($result['a']['b']['c']['d'])->toBe('value');
    });

    it('throws YamlParseException when nesting exceeds maxDepth', function (): void {
        $yaml = "a:\n  b:\n    c:\n      d:\n        e: value";
        $parser = new YamlParser(3);
        $parser->parse($yaml);
    })->throws(YamlParseException::class, 'YAML nesting depth 4 exceeds maximum of 3.');

    it('allows nesting exactly at maxDepth boundary', function (): void {
        $yaml = "a:\n  b:\n    c: value";
        $parser = new YamlParser(3);
        $result = $parser->parse($yaml);
        expect($result['a']['b']['c'])->toBe('value');
    });

    it('throws YamlParseException for deep sequence nesting', function (): void {
        $yaml = "-\n  -\n    -\n      - value";
        $parser = new YamlParser(2);
        $parser->parse($yaml);
    })->throws(YamlParseException::class, 'YAML nesting depth 3 exceeds maximum of 2.');

    it('throws YamlParseException for mixed map and sequence depth', function (): void {
        $yaml = "items:\n  -\n    nested:\n      deep: value";
        $parser = new YamlParser(2);
        $parser->parse($yaml);
    })->throws(YamlParseException::class, 'YAML nesting depth 3 exceeds maximum of 2.');

    it('uses the configured maxDepth not the default 512', function (): void {
        $yaml = "a:\n  b: value";
        $parser = new YamlParser(0);
        $parser->parse($yaml);
    })->throws(YamlParseException::class, 'YAML nesting depth 1 exceeds maximum of 0.');

    it('accepts the default 512 maxDepth for normal YAML', function (): void {
        $parser = new YamlParser();
        $result = $parser->parse("root:\n  child: value");
        expect($result['root']['child'])->toBe('value');
    });
});
