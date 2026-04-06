# Security Policy

## Supported Versions

Only the latest release of each package receives security updates.

| Package                                       | Version | Supported |
| --------------------------------------------  | ------- | :-------: |
| `safe-access/inline` (PHP)                    | 0.x     | ✅        |
| `@safe-access/inline` (JS/TS)          | 0.x     | ✅        |

## Reporting a Vulnerability

If you discover a security vulnerability, please report it responsibly using GitHub's **private vulnerability reporting**.

### How to report

1. Go to the [**Security** tab → **Report a vulnerability**](https://github.com/felipesauer/safe-access-inline/security/advisories/new).
2. Fill in the form with:
   - Clear description of the vulnerability
   - Steps to reproduce
   - Affected package(s) and version(s)
   - Potential impact

**Do not** open a public issue for security problems.

### What to expect

- **Acknowledgment**: within 48 hours
- **Initial assessment**: within 7 days
- **Fix target**: within 90 days (when applicable)

We follow **coordinated disclosure**: we ask that you do not publicly disclose the vulnerability until a fix is released or the 90-day period has passed.

## Scope

**In scope** (considered security issues):
- Injection attacks (code execution during parsing/transformation)
- Denial of Service (excessive resource usage or crashes)
- Unintended data exposure/leakage
- Vulnerabilities in direct dependencies

**Out of scope**:
- Non-security bugs (incorrect output without security impact)
- Feature requests or usability issues
- Issues in `devDependencies` / `require-dev`

---

**Thank you** for helping keep `safe-access-inline` secure!
