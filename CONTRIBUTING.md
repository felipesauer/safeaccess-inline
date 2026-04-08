# Contributing

Contributions are welcome. This document describes how to set up, develop, and submit changes.

## Prerequisites

- PHP 8.2+
- [Composer](https://getcomposer.org/)
- Node.js 22+
- npm 10+ (bundled with Node 22)

## Quick Start

```bash
git clone https://github.com/felipesauer/safeaccess-inline.git
cd safeaccess-inline
```

## PHP Development

```bash
cd packages/php
composer install
```

Run the full test suite with [Pest](https://pestphp.com/):

```bash
composer test
```

## JavaScript / TypeScript Development

Install all workspace dependencies from the repo root:

```bash
npm install
```

Work in the `packages/js` workspace:

```bash
cd packages/js
```

Available scripts:

| Script              | Purpose                 |
| ------------------- | ----------------------- |
| `npm run build`     | Compile TypeScript      |
| `npm test`          | Run tests               |
| `npm run typecheck` | Type-check without emit |
| `npm run lint`      | Run ESLint              |

## Commit Messages

This repo enforces [Conventional Commits](https://www.conventionalcommits.org/) with commitlint. Every commit must include a scope from the allowed list:

```
<type>(<scope>): <description>
```

Allowed scopes: `js`, `php`, `docs`, `ci`, `deps`

Examples:

```
feat(php): implement safe_access() function
fix(js): handle null root object
docs: update quickstart commands
ci: add matrix build for PHP 8.3
deps: bump eslint to v10
```

## Pull Request Workflow

1. Fork the repository
2. Create a feature branch: `git checkout -b feat/my-feature`
3. Make your changes
4. Ensure all tests pass
5. Open a Pull Request against `main`

## Security

For security issues, please follow our [Security Policy](SECURITY.md).
