<?php

declare(strict_types=1);

use SafeAccess\Inline\Exceptions\InvalidFormatException;
use SafeAccess\Inline\Inline;
use SafeAccess\Inline\Tests\Mocks\FakeParseIntegration;

describe(Inline::class . ' > fromAny (parity)', function (): void {
    beforeEach(function (): void {
        $this->inline = new Inline();
    });

    it('throws InvalidFormatException when integration rejects the input', function (): void {
        $integration = new FakeParseIntegration(accepts: false, parsed: []);

        expect(fn () => $this->inline->fromAny('bad-input', $integration))
            ->toThrow(InvalidFormatException::class);
    });

    it('inline integration override takes precedence over builder integration', function (): void {
        $builderIntegration = new FakeParseIntegration(accepts: true, parsed: ['from' => 'builder']);
        $overrideIntegration = new FakeParseIntegration(accepts: true, parsed: ['from' => 'override']);

        $accessor = $this->inline
            ->withParserIntegration($builderIntegration)
            ->fromAny('raw', $overrideIntegration);

        expect($accessor->get('from'))->toBe('override');
    });

    it('resolves nested path through AnyAccessor', function (): void {
        $integration = new FakeParseIntegration(accepts: true, parsed: ['user' => ['name' => 'Alice']]);

        $accessor = $this->inline->fromAny('raw', $integration);

        expect($accessor->get('user.name'))->toBe('Alice');
    });

    it('throws InvalidFormatException when no integration is available', function (): void {
        expect(fn () => $this->inline->fromAny('data'))
            ->toThrow(InvalidFormatException::class);
    });

    it('throws InvalidFormatException with guidance message when no integration is set', function (): void {
        expect(fn () => $this->inline->fromAny('data'))
            ->toThrow('AnyAccessor requires a ParseIntegrationInterface');
    });
});

describe(Inline::class . ' > withStrictMode (parity)', function (): void {
    beforeEach(function (): void {
        $this->inline = new Inline();
    });

    it('withStrictMode(false) bypasses payload size validation for JSON', function (): void {
        $tinyParser = new \SafeAccess\Inline\Security\SecurityParser(maxPayloadBytes: 5);

        $accessor = $this->inline
            ->withSecurityParser($tinyParser)
            ->withStrictMode(false)
            ->fromJson('{"name":"Alice"}');

        expect($accessor->get('name'))->toBe('Alice');
    });

    it('withStrictMode(false) bypasses forbidden key validation for JSON', function (): void {
        $accessor = $this->inline
            ->withStrictMode(false)
            ->fromJson('{"__construct":"injected"}');

        expect($accessor->get('__construct'))->toBe('injected');
    });

    it('withStrictMode(true) enforces forbidden key validation for JSON', function (): void {
        expect(
            fn () => $this->inline
            ->withStrictMode(true)
            ->fromJson('{"__construct":"injected"}')
        )->toThrow(\SafeAccess\Inline\Exceptions\SecurityException::class);
    });

    it('strict(false) bypasses payload size validation for JSON', function (): void {
        $tinyParser = new \SafeAccess\Inline\Security\SecurityParser(maxPayloadBytes: 5);
        $parser = new \SafeAccess\Inline\Core\DotNotationParser(
            new \SafeAccess\Inline\Security\SecurityGuard(),
            $tinyParser,
            new \SafeAccess\Inline\Cache\SimplePathCache(),
            new \SafeAccess\Inline\PathQuery\SegmentParser(
                new \SafeAccess\Inline\PathQuery\SegmentFilterParser(new \SafeAccess\Inline\Security\SecurityGuard())
            ),
            new \SafeAccess\Inline\PathQuery\SegmentPathResolver(
                new \SafeAccess\Inline\PathQuery\SegmentFilterParser(new \SafeAccess\Inline\Security\SecurityGuard())
            ),
        );

        $accessor = (new \SafeAccess\Inline\Accessors\Formats\JsonAccessor($parser))
            ->strict(false)
            ->from('{"name":"Alice"}');

        expect($accessor->get('name'))->toBe('Alice');
    });

    it('strict(false) bypasses forbidden key validation for JSON', function (): void {
        $parser = new \SafeAccess\Inline\Core\DotNotationParser(
            new \SafeAccess\Inline\Security\SecurityGuard(),
            new \SafeAccess\Inline\Security\SecurityParser(),
            new \SafeAccess\Inline\Cache\SimplePathCache(),
            new \SafeAccess\Inline\PathQuery\SegmentParser(
                new \SafeAccess\Inline\PathQuery\SegmentFilterParser(new \SafeAccess\Inline\Security\SecurityGuard())
            ),
            new \SafeAccess\Inline\PathQuery\SegmentPathResolver(
                new \SafeAccess\Inline\PathQuery\SegmentFilterParser(new \SafeAccess\Inline\Security\SecurityGuard())
            ),
        );

        $accessor = (new \SafeAccess\Inline\Accessors\Formats\JsonAccessor($parser))
            ->strict(false)
            ->from('{"__construct":"injected"}');

        expect($accessor->get('__construct'))->toBe('injected');
    });
});

describe(Inline::class . ' > withStrictMode + make (parity)', function (): void {
    beforeEach(function (): void {
        $this->inline = new Inline();
    });

    it('withStrictMode(false) bypasses forbidden key validation through make()', function (): void {
        $accessor = $this->inline
            ->withStrictMode(false)
            ->make(\SafeAccess\Inline\Accessors\Formats\JsonAccessor::class, '{"__construct":"ok"}');

        expect($accessor->get('__construct'))->toBe('ok');
    });

    it('withStrictMode(true) enforces forbidden key validation through make()', function (): void {
        expect(
            fn () => $this->inline
            ->withStrictMode(true)
            ->make(\SafeAccess\Inline\Accessors\Formats\JsonAccessor::class, '{"__construct":"injected"}')
        )->toThrow(\SafeAccess\Inline\Exceptions\SecurityException::class);
    });

    it('withStrictMode(false) bypasses payload size validation through make()', function (): void {
        $tinyParser = new \SafeAccess\Inline\Security\SecurityParser(maxPayloadBytes: 5);

        $accessor = $this->inline
            ->withSecurityParser($tinyParser)
            ->withStrictMode(false)
            ->make(\SafeAccess\Inline\Accessors\Formats\JsonAccessor::class, '{"name":"Alice"}');

        expect($accessor->get('name'))->toBe('Alice');
    });

    it('withStrictMode(true) enforces payload size validation through make()', function (): void {
        $tinyParser = new \SafeAccess\Inline\Security\SecurityParser(maxPayloadBytes: 5);

        expect(
            fn () => $this->inline
            ->withSecurityParser($tinyParser)
            ->withStrictMode(true)
            ->make(\SafeAccess\Inline\Accessors\Formats\JsonAccessor::class, '{"name":"Alice"}')
        )->toThrow(\SafeAccess\Inline\Exceptions\SecurityException::class);
    });
});
