<?php

declare(strict_types=1);

use SafeAccess\Inline\Accessors\Formats\XmlAccessor;
use SafeAccess\Inline\Core\InlineBuilderAccessor;
use SafeAccess\Inline\Exceptions\InvalidFormatException;
use SafeAccess\Inline\Exceptions\SecurityException;
use SafeAccess\Inline\Security\SecurityParser;

describe(XmlAccessor::class, function (): void {
    describe(XmlAccessor::class . ' > from', function (): void {
        it('parses an XML string', function (): void {
            $accessor = factory()->xml('<root><name>Alice</name></root>');

            expect($accessor->get('name'))->toBe('Alice');
        });

        it('parses nested XML', function (): void {
            $accessor = factory()->xml('<root><user><city>Porto</city></user></root>');

            expect($accessor->get('user.city'))->toBe('Porto');
        });

        it('accepts a pre-parsed SimpleXMLElement', function (): void {
            $xml = simplexml_load_string('<root><name>Bob</name></root>');

            $accessor = factory()->xml($xml);

            expect($accessor->get('name'))->toBe('Bob');
        });

        it('stores the raw input', function (): void {
            $raw = '<root><n>1</n></root>';
            $accessor = factory()->xml($raw);

            expect($accessor->getRaw())->toBe($raw);
        });

        it('throws InvalidFormatException for a non-string, non-element input', function (): void {
            expect(fn () => factory()->xml(42))
                ->toThrow(InvalidFormatException::class);
        });

        it('throws InvalidFormatException for null input', function (): void {
            expect(fn () => factory()->xml(null))
                ->toThrow(InvalidFormatException::class);
        });

        it('throws InvalidFormatException for malformed XML', function (): void {
            expect(fn () => factory()->xml('<unclosed'))
                ->toThrow(InvalidFormatException::class);
        });

        it('throws SecurityException when the XML string contains a DOCTYPE declaration', function (): void {
            $xml = '<!DOCTYPE foo [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><root><name>&xxe;</name></root>';

            expect(fn () => factory()->xml($xml))->toThrow(SecurityException::class);
        });

        it('throws SecurityException for a DOCTYPE declaration without an entity', function (): void {
            $xml = '<!DOCTYPE root><root><name>Alice</name></root>';

            expect(fn () => factory()->xml($xml))->toThrow(SecurityException::class);
        });

        it('throws SecurityException for a lowercase doctype declaration', function (): void {
            $xml = '<!doctype root><root><name>Alice</name></root>';

            expect(fn () => factory()->xml($xml))->toThrow(SecurityException::class);
        });

        it('does not throw SecurityException for valid XML without DOCTYPE', function (): void {
            $accessor = factory()->xml('<root><name>Alice</name></root>');

            expect($accessor->get('name'))->toBe('Alice');
        });

        it('throws SecurityException when DOCTYPE has leading whitespace', function (): void {
            $xml = '  <!DOCTYPE root><root><name>Alice</name></root>';

            expect(fn () => factory()->xml($xml))->toThrow(SecurityException::class);
        });

        it('throws SecurityException for mixed-case DOCTYPE declaration', function (): void {
            $xml = '<!DoCTyPe root><root><name>Alice</name></root>';

            expect(fn () => factory()->xml($xml))->toThrow(SecurityException::class);
        });

        it('throws SecurityException for DOCTYPE with SYSTEM URI classic XXE vector', function (): void {
            $xml = '<!DOCTYPE foo SYSTEM "file:///etc/passwd"><root><data>x</data></root>';

            expect(fn () => factory()->xml($xml))->toThrow(SecurityException::class);
        });

        it('throws SecurityException when XML nesting exceeds the configured maxDepth', function (): void {
            $builder = (new InlineBuilderAccessor())->withSecurityParser(new SecurityParser(maxDepth: 2));
            $xml = '<root><a><b><c>deep</c></b></a></root>';

            expect(fn () => $builder->builder()->xml($xml))->toThrow(SecurityException::class);
        });

        it('does not throw when XML nesting is within the configured maxDepth', function (): void {
            $builder = (new InlineBuilderAccessor())->withSecurityParser(new SecurityParser(maxDepth: 10));
            $xml = '<root><name>Alice</name></root>';

            $accessor = $builder->builder()->xml($xml);

            expect($accessor->get('name'))->toBe('Alice');
        });

        it('SecurityException message reports the exceeded depth for XML roundtrip', function (): void {
            $builder = (new InlineBuilderAccessor())->withSecurityParser(new SecurityParser(maxDepth: 2));
            $xml = '<root><a><b><c>deep</c></b></a></root>';

            expect(fn () => $builder->builder()->xml($xml))
                ->toThrow(SecurityException::class, 'exceeds maximum');
        });

        it('throws SecurityException for a pre-parsed SimpleXMLElement that exceeds the configured maxDepth', function (): void {
            $builder = (new InlineBuilderAccessor())->withSecurityParser(new SecurityParser(maxDepth: 2));
            $xml = simplexml_load_string('<root><a><b><c>deep</c></b></a></root>');

            expect(fn () => $builder->builder()->xml($xml))->toThrow(SecurityException::class);
        });

        it('does not throw for two-level XML at maxDepth=3 boundary', function (): void {
            $builder = (new InlineBuilderAccessor())->withSecurityParser(new SecurityParser(maxDepth: 3));
            $xml = '<root><a><b>val</b></a></root>';

            $accessor = $builder->builder()->xml($xml);

            expect($accessor->get('a.b'))->toBe('val');
        });

        it('does not throw for XML with default SecurityParser settings', function (): void {
            $xml = '<root><a><b><c><d>deep</d></c></b></a></root>';

            $accessor = factory()->xml($xml);

            expect($accessor->get('a.b.c.d'))->toBe('deep');
        });
    });
});
