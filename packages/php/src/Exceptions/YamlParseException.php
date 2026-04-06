<?php

declare(strict_types=1);

namespace SafeAccess\Inline\Exceptions;

/**
 * Thrown when the internal YAML parser encounters a syntax or safety error.
 *
 * Specialized subclass of {@see InvalidFormatException} for YAML-specific
 * errors such as unsupported tags, anchors, aliases, or merge keys.
 *
 * @api
 *
 * @see \SafeAccess\Inline\Parser\Yaml\YamlParser   Internal parser that throws this exception.
 * @see InvalidFormatException  Parent exception class.
 */
class YamlParseException extends InvalidFormatException
{
    /**
     * Create a new YAML parse exception.
     *
     * @param string          $message  Description of the YAML parsing error.
     * @param int             $code     Application-specific error code.
     * @param \Throwable|null $previous Previous exception for chaining.
     */
    public function __construct(string $message, int $code = 0, ?\Throwable $previous = null)
    {
        parent::__construct($message, $code, $previous);
    }
}
