<?php

declare(strict_types=1);

use SafeAccess\Inline\Exceptions\InvalidFormatException;
use SafeAccess\Inline\Exceptions\SecurityException;
use SafeAccess\Inline\PathQuery\SegmentFilterParser;
use SafeAccess\Inline\Security\SecurityGuard;

describe(SegmentFilterParser::class, function (): void {
    // parse()
    describe(SegmentFilterParser::class . ' > parse', function (): void {
        it('parses a simple greater-than condition', function (): void {
            $parser = new SegmentFilterParser(new SecurityGuard());

            $result = $parser->parse('age>18');

            expect($result['conditions'])->toHaveCount(1);
            expect($result['conditions'][0]['field'])->toBe('age');
            expect($result['conditions'][0]['operator'])->toBe('>');
            expect($result['conditions'][0]['value'])->toBe(18);
            expect($result['logicals'])->toBeEmpty();
        });

        it('parses an equality condition with a string value', function (): void {
            $parser = new SegmentFilterParser(new SecurityGuard());

            $result = $parser->parse("name=='Alice'");

            expect($result['conditions'][0]['field'])->toBe('name');
            expect($result['conditions'][0]['operator'])->toBe('==');
            expect($result['conditions'][0]['value'])->toBe('Alice');
        });

        it('parses a boolean value (true)', function (): void {
            $parser = new SegmentFilterParser(new SecurityGuard());

            $result = $parser->parse('active==true');

            expect($result['conditions'][0]['value'])->toBeTrue();
        });

        it('parses a boolean value (false)', function (): void {
            $parser = new SegmentFilterParser(new SecurityGuard());

            $result = $parser->parse('active==false');

            expect($result['conditions'][0]['value'])->toBeFalse();
        });

        it('parses a null value', function (): void {
            $parser = new SegmentFilterParser(new SecurityGuard());

            $result = $parser->parse('field==null');

            expect($result['conditions'][0]['value'])->toBeNull();
        });

        it('parses a float value', function (): void {
            $parser = new SegmentFilterParser(new SecurityGuard());

            $result = $parser->parse('score>=9.5');

            expect($result['conditions'][0]['value'])->toBe(9.5);
        });

        it('parses two conditions joined by logical AND (&&)', function (): void {
            $parser = new SegmentFilterParser(new SecurityGuard());

            $result = $parser->parse('age>18 && active==true');

            expect($result['conditions'])->toHaveCount(2);
            expect($result['logicals'])->toBe(['&&']);
        });

        it('parses two conditions joined by logical OR (||)', function (): void {
            $parser = new SegmentFilterParser(new SecurityGuard());

            $result = $parser->parse("role=='admin' || role=='moderator'");

            expect($result['logicals'])->toBe(['||']);
        });

        it('parses a starts_with() function call', function (): void {
            $parser = new SegmentFilterParser(new SecurityGuard());

            $result = $parser->parse("starts_with(@.name, 'J')");

            expect($result['conditions'][0]['func'])->toBe('starts_with');
        });

        it('parses a contains() function call', function (): void {
            $parser = new SegmentFilterParser(new SecurityGuard());

            $result = $parser->parse("contains(@.tags, 'php')");

            expect($result['conditions'][0]['func'])->toBe('contains');
        });

        it('parses a values() boolean function call', function (): void {
            $parser = new SegmentFilterParser(new SecurityGuard());

            $result = $parser->parse('values(@.tags)');

            expect($result['conditions'][0]['func'])->toBe('values');
            expect($result['conditions'][0]['operator'])->toBe('==');
            expect($result['conditions'][0]['value'])->toBeTrue();
        });

        it('parses a function with a comparison operator', function (): void {
            $parser = new SegmentFilterParser(new SecurityGuard());

            $result = $parser->parse('values(@.tags)>2');

            expect($result['conditions'][0]['func'])->toBe('values');
            expect($result['conditions'][0]['operator'])->toBe('>');
            expect($result['conditions'][0]['value'])->toBe(2);
        });

        it('throws InvalidFormatException for a condition without an operator', function (): void {
            $parser = new SegmentFilterParser(new SecurityGuard());

            expect(fn () => $parser->parse('invalid_no_operator'))->toThrow(InvalidFormatException::class);
        });
    });

    // evaluate()
    describe(SegmentFilterParser::class . ' > evaluate', function (): void {
        it('returns false when there are no conditions', function (): void {
            $parser = new SegmentFilterParser(new SecurityGuard());

            $result = $parser->evaluate(['age' => 30], ['conditions' => [], 'logicals' => []]);

            expect($result)->toBeFalse();
        });

        it('returns true when the item satisfies a > condition', function (): void {
            $parser = new SegmentFilterParser(new SecurityGuard());
            $expr = $parser->parse('age>18');

            expect($parser->evaluate(['age' => 30], $expr))->toBeTrue();
        });

        it('returns false when the item fails a > condition', function (): void {
            $parser = new SegmentFilterParser(new SecurityGuard());
            $expr = $parser->parse('age>18');

            expect($parser->evaluate(['age' => 10], $expr))->toBeFalse();
        });

        it('returns true for an == condition with string match', function (): void {
            $parser = new SegmentFilterParser(new SecurityGuard());
            $expr = $parser->parse("name=='Alice'");

            expect($parser->evaluate(['name' => 'Alice'], $expr))->toBeTrue();
        });

        it('returns false for a != condition when values are equal', function (): void {
            $parser = new SegmentFilterParser(new SecurityGuard());
            $expr = $parser->parse("status!='open'");

            expect($parser->evaluate(['status' => 'open'], $expr))->toBeFalse();
        });

        it('returns true for a != condition when values differ', function (): void {
            $parser = new SegmentFilterParser(new SecurityGuard());
            $expr = $parser->parse("status!='open'");

            expect($parser->evaluate(['status' => 'closed'], $expr))->toBeTrue();
        });

        it('evaluates logical AND as true only when both conditions pass', function (): void {
            $parser = new SegmentFilterParser(new SecurityGuard());
            $expr = $parser->parse('age>18 && active==true');

            expect($parser->evaluate(['age' => 30, 'active' => true], $expr))->toBeTrue();
            expect($parser->evaluate(['age' => 30, 'active' => false], $expr))->toBeFalse();
            expect($parser->evaluate(['age' => 10, 'active' => true], $expr))->toBeFalse();
        });

        it('evaluates logical OR as true when at least one condition passes', function (): void {
            $parser = new SegmentFilterParser(new SecurityGuard());
            $expr = $parser->parse("role=='admin' || role=='moderator'");

            expect($parser->evaluate(['role' => 'admin'], $expr))->toBeTrue();
            expect($parser->evaluate(['role' => 'moderator'], $expr))->toBeTrue();
            expect($parser->evaluate(['role' => 'guest'], $expr))->toBeFalse();
        });

        it('evaluates starts_with() returning true when the field starts with prefix', function (): void {
            $parser = new SegmentFilterParser(new SecurityGuard());
            $expr = $parser->parse("starts_with(@.name, 'Al')");

            expect($parser->evaluate(['name' => 'Alice'], $expr))->toBeTrue();
            expect($parser->evaluate(['name' => 'Bob'], $expr))->toBeFalse();
        });

        it('evaluates starts_with() as false for non-string field values', function (): void {
            $parser = new SegmentFilterParser(new SecurityGuard());
            $expr = $parser->parse("starts_with(@.score, 'A')");

            expect($parser->evaluate(['score' => 42], $expr))->toBeFalse();
        });

        it('evaluates contains() returning true when string field contains needle', function (): void {
            $parser = new SegmentFilterParser(new SecurityGuard());
            $expr = $parser->parse("contains(@.bio, 'engineer')");

            expect($parser->evaluate(['bio' => 'senior engineer'], $expr))->toBeTrue();
            expect($parser->evaluate(['bio' => 'designer'], $expr))->toBeFalse();
        });

        it('evaluates contains() on an array field', function (): void {
            $parser = new SegmentFilterParser(new SecurityGuard());
            $expr = $parser->parse("contains(@.tags, 'php')");

            expect($parser->evaluate(['tags' => ['php', 'python']], $expr))->toBeTrue();
            expect($parser->evaluate(['tags' => ['ruby']], $expr))->toBeFalse();
        });

        it('evaluates contains() as false for non-string non-array values', function (): void {
            $parser = new SegmentFilterParser(new SecurityGuard());
            $expr = $parser->parse("contains(@.count, 'x')");

            expect($parser->evaluate(['count' => 42], $expr))->toBeFalse();
        });

        it('evaluates values() returning count of array field', function (): void {
            $parser = new SegmentFilterParser(new SecurityGuard());
            $expr = $parser->parse('values(@.tags)>1');

            expect($parser->evaluate(['tags' => ['php', 'js']], $expr))->toBeTrue();
            expect($parser->evaluate(['tags' => ['php']], $expr))->toBeFalse();
        });

        it('evaluates values() returning 0 for non-array fields', function (): void {
            $parser = new SegmentFilterParser(new SecurityGuard());
            $expr = $parser->parse('values(@.name)>0');

            expect($parser->evaluate(['name' => 'Alice'], $expr))->toBeFalse();
        });

        it('evaluates an arithmetic expression in the field', function (): void {
            $parser = new SegmentFilterParser(new SecurityGuard());
            $expr = $parser->parse('@.price * @.qty > 100');

            expect($parser->evaluate(['price' => 25, 'qty' => 5], $expr))->toBeTrue();
            expect($parser->evaluate(['price' => 10, 'qty' => 5], $expr))->toBeFalse();
        });

        it('evaluates <= and >= boundary conditions', function (): void {
            $parser = new SegmentFilterParser(new SecurityGuard());

            $exprLe = $parser->parse('age<=30');
            expect($parser->evaluate(['age' => 30], $exprLe))->toBeTrue();
            expect($parser->evaluate(['age' => 31], $exprLe))->toBeFalse();

            $exprGe = $parser->parse('age>=18');
            expect($parser->evaluate(['age' => 18], $exprGe))->toBeTrue();
        });

        it('throws InvalidFormatException for an unknown function', function (): void {
            $parser = new SegmentFilterParser(new SecurityGuard());
            $expr = $parser->parse('unknown_func(@.name)');

            expect(fn () => $parser->evaluate(['name' => 'Alice'], $expr))
                ->toThrow(InvalidFormatException::class);
        });

        it('throws SecurityException when a field key is forbidden', function (): void {
            $parser = new SegmentFilterParser(new SecurityGuard());
            $expr = $parser->parse('__construct==true');

            expect(fn () => $parser->evaluate(['__construct' => true], $expr))
                ->toThrow(SecurityException::class);
        });

        it('parses an unquoted non-numeric value as a bare string', function (): void {
            // Line 246: parseValueDefault returns $raw when not quoted and not numeric
            $parser = new SegmentFilterParser(new SecurityGuard());
            $expr = $parser->parse('status == active');

            expect($expr['conditions'][0]['value'])->toBe('active');
        });

        it('evaluates a strict less-than condition', function (): void {
            // Line 271: '<' match arm in evaluateCondition
            $parser = new SegmentFilterParser(new SecurityGuard());
            $expr = $parser->parse('age < 18');

            expect($parser->evaluate(['age' => 15], $expr))->toBeTrue();
            expect($parser->evaluate(['age' => 18], $expr))->toBeFalse();
        });

        it('returns null from resolveArithmetic for a multi-operator field expression', function (): void {
            // Line 372: resolveArithmetic preg_match fails → return null
            $parser = new SegmentFilterParser(new SecurityGuard());
            $expr = $parser->parse('@.a + @.b + @.c > 0');

            expect($parser->evaluate(['a' => 1, 'b' => 2, 'c' => 3], $expr))->toBeFalse();
        });

        it('evaluates arithmetic with a float literal on the left side', function (): void {
            // Line 377: numeric token with decimal → (float) $token
            $parser = new SegmentFilterParser(new SecurityGuard());
            $expr = $parser->parse('5.5 * @.qty > 2');

            expect($parser->evaluate(['qty' => 1], $expr))->toBeTrue();
        });

        it('converts a numeric-string field value to a number in arithmetic', function (): void {
            // Lines 386-390: is_numeric($val) true path inside toNumber closure
            $parser = new SegmentFilterParser(new SecurityGuard());
            $expr = $parser->parse('@.price * @.qty > 40');

            expect($parser->evaluate(['price' => '10', 'qty' => '5'], $expr))->toBeTrue();
        });

        it('returns null and evaluates false when an arithmetic field is missing from data', function (): void {
            // Line 397: left or right is null → return null
            $parser = new SegmentFilterParser(new SecurityGuard());
            $expr = $parser->parse('@.missing * @.qty > 0');

            expect($parser->evaluate(['qty' => 5], $expr))->toBeFalse();
        });

        it('evaluates arithmetic addition between two field values', function (): void {
            // Line 401: '+' match arm
            $parser = new SegmentFilterParser(new SecurityGuard());
            $expr = $parser->parse('@.a + @.b > 5');

            expect($parser->evaluate(['a' => 3, 'b' => 4], $expr))->toBeTrue();
        });

        it('evaluates arithmetic subtraction between two field values', function (): void {
            // Line 402: '-' match arm
            $parser = new SegmentFilterParser(new SecurityGuard());
            $expr = $parser->parse('@.a - @.b > 0');

            expect($parser->evaluate(['a' => 5, 'b' => 3], $expr))->toBeTrue();
        });

        it('evaluates contains() with @ referring to the whole item array', function (): void {
            // Line 419: resolveFilterArg returns $item when arg is '@'
            $parser = new SegmentFilterParser(new SecurityGuard());
            $expr = $parser->parse("contains(@, 'x')");

            expect($parser->evaluate(['x', 'y'], $expr))->toBeTrue();
            expect($parser->evaluate(['a', 'b'], $expr))->toBeFalse();
        });

        it('resolves a plain field name (no @. prefix) in an arithmetic expression', function (): void {
            // Line 426: resolveFilterArg falls through to resolveField for plain field
            $parser = new SegmentFilterParser(new SecurityGuard());
            $expr = $parser->parse('price * 2 > 10');

            expect($parser->evaluate(['price' => 6], $expr))->toBeTrue();
        });

        it('resolves a dot-separated field path in a filter condition', function (): void {
            // Lines 442-453: resolveField with str_contains('.') path
            $parser = new SegmentFilterParser(new SecurityGuard());
            $expr = $parser->parse('user.age >= 18');

            expect($parser->evaluate(['user' => ['age' => 20]], $expr))->toBeTrue();
            expect($parser->evaluate(['user' => ['age' => 15]], $expr))->toBeFalse();
        });

        it('returns null for a missing nested field in a dot-separated filter path', function (): void {
            // Lines 442-453: resolveField dot-path with missing intermediate key
            $parser = new SegmentFilterParser(new SecurityGuard());
            $expr = $parser->parse('user.age >= 18');

            expect($parser->evaluate(['other' => 'data'], $expr))->toBeFalse();
        });
    });

    describe(SegmentFilterParser::class . ' > numeric literal coercion', function (): void {
        $value = function (string $expr): mixed {
            $parser = new SegmentFilterParser(new SecurityGuard());
            return $parser->parse($expr)['conditions'][0]['value'];
        };

        it('parses scientific notation as a number (1e3 -> 1000)', function () use ($value): void {
            expect($value('v==1e3'))->toBe(1000);
        });

        it('parses integral scientific notation as an integer (1.5e2 -> 150)', function () use ($value): void {
            expect($value('v==1.5e2'))->toBe(150);
        });

        it('keeps a fractional value as a float (2.5)', function () use ($value): void {
            expect($value('v==2.5'))->toBe(2.5);
        });

        it('keeps a negative-exponent value fractional (1e-3 -> 0.001)', function () use ($value): void {
            expect($value('v==1e-3'))->toBe(0.001);
        });

        it('preserves a leading-zero decimal integer (007 -> 7)', function () use ($value): void {
            expect($value('v==007'))->toBe(7);
        });

        it('leaves a hexadecimal literal as a string (0x1A)', function () use ($value): void {
            expect($value('v==0x1A'))->toBe('0x1A');
        });

        it('leaves a binary literal as a string (0b101)', function () use ($value): void {
            expect($value('v==0b101'))->toBe('0b101');
        });

        it('leaves an octal literal as a string (0o17)', function () use ($value): void {
            expect($value('v==0o17'))->toBe('0o17');
        });

        it('leaves an underscore-grouped literal as a string (1_000)', function () use ($value): void {
            expect($value('v==1_000'))->toBe('1_000');
        });

        it('matches integer data with a scientific-notation literal', function (): void {
            $parser = new SegmentFilterParser(new SecurityGuard());
            expect($parser->evaluate(['v' => 1000], $parser->parse('v==1e3')))->toBeTrue();
        });

        it('uses the same numeric rule inside arithmetic predicates', function (): void {
            $parser = new SegmentFilterParser(new SecurityGuard());
            expect($parser->evaluate(['v' => 1000], $parser->parse('v*1==1e3')))->toBeTrue();
        });
    });

    describe(SegmentFilterParser::class . ' > relational operators require numbers', function (): void {
        $evaluate = function (string $expr, array $item): bool {
            $parser = new SegmentFilterParser(new SecurityGuard());
            return $parser->evaluate($item, $parser->parse($expr));
        };

        it('returns false comparing a non-numeric string with > to a number', function () use ($evaluate): void {
            expect($evaluate('v>5', ['v' => 'abc']))->toBeFalse();
        });

        it('returns false comparing an empty string with >= to zero', function () use ($evaluate): void {
            expect($evaluate('v>=0', ['v' => '']))->toBeFalse();
        });

        it('returns false comparing a numeric string with > to a number', function () use ($evaluate): void {
            expect($evaluate('v>5', ['v' => '10']))->toBeFalse();
        });

        it('returns false comparing null with > to a number', function () use ($evaluate): void {
            expect($evaluate('v>0', ['v' => null]))->toBeFalse();
        });

        it('returns false comparing an array with > to a number', function () use ($evaluate): void {
            expect($evaluate('v>1', ['v' => [1, 2]]))->toBeFalse();
        });

        it('still compares two numbers with > (regression)', function () use ($evaluate): void {
            expect($evaluate('age>18', ['age' => 30]))->toBeTrue();
        });

        it('still compares two numbers with <= (regression)', function () use ($evaluate): void {
            expect($evaluate('age<=30', ['age' => 30]))->toBeTrue();
        });

        it('still compares two floats with >= (regression)', function () use ($evaluate): void {
            expect($evaluate('s>=9.5', ['s' => 9.5]))->toBeTrue();
        });
    });
});
