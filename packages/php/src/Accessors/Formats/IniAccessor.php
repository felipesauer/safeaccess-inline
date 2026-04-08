<?php

declare(strict_types=1);

namespace SafeAccess\Inline\Accessors\Formats;

use SafeAccess\Inline\Accessors\AbstractAccessor;
use SafeAccess\Inline\Exceptions\InvalidFormatException;

/**
 * Accessor for INI-formatted strings.
 *
 * Uses PHP's `parse_ini_string()` with `INI_SCANNER_TYPED` for type
 * inference. Converts "none" values to `false` for consistency.
 *
 * @api
 *
 * @example
 * $accessor = Inline::fromIni("[db]\nhost=localhost\nport=5432");
 * $accessor->get('db.host'); // 'localhost'
 */
final class IniAccessor extends AbstractAccessor
{
    /**
     * Hydrate from an INI-formatted string.
     *
     * @param mixed $data INI string input.
     *
     * @return static Populated accessor instance.
     *
     * @throws \SafeAccess\Inline\Exceptions\InvalidFormatException When input is not a string.
     * @throws \SafeAccess\Inline\Exceptions\SecurityException      When security constraints are violated.
     *
     * @example
     * $accessor = (new IniAccessor($parser))->from("key=value\n[section]\nname=Alice");
     */
    public function from(mixed $data): static
    {
        if (!is_string($data)) {
            throw new InvalidFormatException(
                'IniAccessor expects an INI string, got ' . gettype($data)
            );
        }

        return $this->raw($data);
    }

    /** {@inheritDoc} */
    protected function parse(mixed $raw): array
    {
        assert(is_string($raw));
        set_error_handler(fn () => true);

        $parsed = parse_ini_string($raw, true, INI_SCANNER_TYPED);

        restore_error_handler();
        if ($parsed === false) {
            throw new InvalidFormatException('IniAccessor failed to parse INI string.');
        }

        // INI_SCANNER_TYPED already converts "none"/"off"/"no" to false,
        // including values inside sections - no extra processing needed.
        return $parsed;
    }
}
