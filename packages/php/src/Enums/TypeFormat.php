<?php

declare(strict_types=1);

namespace SafeAccess\Inline\Enums;

/**
 * Enumerate all supported data format types.
 *
 * Used by {@see \SafeAccess\Inline\Inline::from()} to dynamically select the
 * appropriate accessor implementation at runtime via enum dispatch.
 *
 * @api
 *
 * @see \SafeAccess\Inline\Inline::from()                Dispatches accessor creation based on this enum.
 * @see \SafeAccess\Inline\Core\AccessorFactory           Factory that instantiates format-specific accessors.
 */
enum TypeFormat: string
{
    /** PHP native array input. */
    case Array = 'array';

    /** PHP stdClass or custom object input. */
    case Object = 'object';

    /** JSON-encoded string input. */
    case Json = 'json';

    /** XML string or SimpleXMLElement input. */
    case Xml = 'xml';

    /** YAML-encoded string input. */
    case Yaml = 'yaml';

    /** INI-formatted string input. */
    case Ini = 'ini';

    /** ENV (dotenv) formatted string input. */
    case Env = 'env';

    /** Newline-delimited JSON (NDJSON) string input. */
    case Ndjson = 'ndjson';

    /** Auto-detected format via ParseIntegrationInterface. */
    case Any = 'any';
}
