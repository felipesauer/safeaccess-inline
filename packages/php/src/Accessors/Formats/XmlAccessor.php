<?php

declare(strict_types=1);

namespace SafeAccess\Inline\Accessors\Formats;

use SafeAccess\Inline\Accessors\AbstractAccessor;
use SafeAccess\Inline\Exceptions\InvalidFormatException;
use SafeAccess\Inline\Exceptions\SecurityException;

/**
 * Accessor for XML strings and SimpleXMLElement instances.
 *
 * Parses XML using `simplexml_load_string()` with security flags
 * `LIBXML_NONET | LIBXML_NOCDATA` to prevent XXE attacks and
 * external entity loading. Converts to array via JSON roundtrip.
 *
 * @api
 */
final class XmlAccessor extends AbstractAccessor
{
    /**
     * Hydrate from an XML string or SimpleXMLElement.
     *
     * @param mixed $data XML string or SimpleXMLElement.
     *
     * @return static Populated accessor instance.
     *
     * @throws \SafeAccess\Inline\Exceptions\InvalidFormatException When input is neither string nor SimpleXMLElement.
     * @throws \SafeAccess\Inline\Exceptions\SecurityException          When payload size exceeds limit or DOCTYPE is present.
     */
    public function from(mixed $data): static
    {
        if (!is_string($data) && !$data instanceof \SimpleXMLElement) {
            throw new InvalidFormatException(
                'XmlAccessor expects a string or SimpleXMLElement, got ' . gettype($data)
            );
        }

        return $this->raw($data);
    }

    /** {@inheritDoc} */
    protected function parse(mixed $raw): array
    {
        assert(is_string($raw) || $raw instanceof \SimpleXMLElement);

        if (is_string($raw)) {
            // Explicitly reject DOCTYPE declarations to prevent XXE even on
            // future PHP or libxml2 versions that may re-enable entity loading.
            if (stripos($raw, '<!DOCTYPE') !== false) {
                throw new SecurityException('XML DOCTYPE declarations are not allowed.');
            }

            $previous = libxml_use_internal_errors(true);
            try {
                $xml = simplexml_load_string($raw, options: LIBXML_NONET | LIBXML_NOCDATA);
                if ($xml === false) {
                    $errors = libxml_get_errors();
                    $message = $errors !== [] ? $errors[0]->message : 'Unknown XML error';
                    throw new InvalidFormatException('XmlAccessor failed to parse XML string: ' . trim($message));
                }
            } finally {
                libxml_clear_errors();
                libxml_use_internal_errors($previous);
            }
        } else {
            $xml = $raw;
        }

        $json = json_encode($xml, JSON_THROW_ON_ERROR);
        // getMaxKeys() is intentionally not consulted here: PHP delegates XML parsing to
        // libxml2 via simplexml_load_string(LIBXML_NONET), which handles element-count
        // limits natively. The JS counterpart passes getMaxKeys() to its manual
        // regex-based parser as a ReDoS guard.
        // Use the configured max depth instead of the hardcoded 512
        // so that a custom SecurityParser with a tighter limit is respected.
        $maxDepth = max(1, $this->dotNotationParser->getMaxDepth());
        try {
            /** @var array<mixed> $parsed */
            $parsed = json_decode($json, true, $maxDepth, JSON_THROW_ON_ERROR);
        } catch (\JsonException) {
            throw new SecurityException(
                "XML structural depth exceeds maximum of {$maxDepth}."
            );
        }

        return $parsed;
    }
}
