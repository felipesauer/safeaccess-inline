<?php

declare(strict_types=1);

use SafeAccess\Inline\Parser\Yaml\YamlParser;

describe(YamlParser::class, function (): void {
    beforeEach(function (): void {
        $this->parser = new YamlParser();
    });

    // parse() - happy path / structure
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

    // parse() - scalar types
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

    // parse() - flow syntax
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

    // parse() - block scalars
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

});
