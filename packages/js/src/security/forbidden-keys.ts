/**
 * Stream-wrapper and protocol URI schemes blocked by prefix matching in JavaScript environments.
 *
 * Entries include the delimiter (`://` or `:`) so that legitimate keys sharing
 * the same word prefix (e.g. `node_modules`) are not blocked.
 *
 * PHP-specific wrappers (`phar://`, `php://`, `expect://`, `glob://`, `zlib://`,
 * `ogg://`, `rar://`, `zip://`, `ssh2.tunnel://`) are intentionally absent — they
 * have no meaning in a JavaScript/Node.js runtime.
 *
 * `data:` uses a single-colon delimiter (matching the browser RFC 2397 format
 * `data:mimeType,...`) rather than `data://` (which is the PHP stream-wrapper
 * syntax). Using `data:` as the prefix subsumes `data://` and also catches
 * `data:text/html,<script>...</script>` XSS vectors, consistent with how
 * `javascript:` is handled.
 *
 * @internal
 */
export const STREAM_WRAPPER_PREFIXES: readonly string[] = [
    'file://',
    'http://',
    'https://',
    'ftp://',
    'data:',
    'javascript:',
    'blob:',
    'ws://',
    'wss://',
    'node:',
];

/**
 * Default forbidden keys for JavaScript/TypeScript environments.
 *
 * Stored lowercase for case-insensitive `__*` key lookup. Covers:
 * – prototype pollution vectors (`__proto__`, `constructor`, `prototype`)
 * – legacy prototype manipulation methods (`__defineGetter__` family, stored lowercase)
 * – `hasOwnProperty` shadow (overriding it can bypass guard checks)
 * – JS-relevant stream wrapper / protocol scheme strings as exact-match defence-in-depth
 *
 * PHP magic methods and PHP superglobals are deliberately absent — they are not
 * meaningful in a JavaScript runtime and belong in the PHP package's SecurityGuard only.
 *
 * @internal
 */
export const DEFAULT_FORBIDDEN_KEYS: ReadonlySet<string> = new Set([
    // Prototype pollution vectors (stored lowercase; __* keys normalised before lookup)
    '__proto__',
    'constructor',
    'prototype',
    // JavaScript legacy prototype manipulation (stored lowercase)
    '__definegetter__',
    '__definesetter__',
    '__lookupgetter__',
    '__lookupsetter__',
    // Object.prototype shadow key — overriding it can break hasOwnProperty-based guards
    'hasOwnProperty',
    // Node.js module-scope path globals — should never appear as data keys to
    // prevent path-injection risks in code that reads them via dynamic property access
    '__dirname',
    '__filename',
    // Stream wrapper and protocol exact entries — also caught by STREAM_WRAPPER_PREFIXES prefix matching.
    // The Set entries below are intentional defence-in-depth: they allow O(1) exact-key
    // lookup before the O(n) prefix loop runs.
    'file://',
    'http://',
    'https://',
    'ftp://',
    // 'data:' blocks browser RFC 2397 data URIs (data:mimeType,...) which can carry
    // executable HTML/JS payloads (e.g. data:text/html,<script>alert(1)</script>).
    // 'data://' is kept for exact-match parity with the PHP SecurityGuard that uses
    // the PHP stream-wrapper notation; 'data:' prefix in STREAM_WRAPPER_PREFIXES
    // already subsumes it for prefix-based lookups.
    'data:',
    'data://',
    'javascript:',
    'blob:',
    'ws://',
    'wss://',
    'node:',
]);
