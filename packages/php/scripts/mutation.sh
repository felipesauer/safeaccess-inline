#!/usr/bin/env bash
# scripts/mutation.sh - Run Infection mutation tests with Pest coverage.
#
# Pest uses an internal P\ namespace for test class FQCNs in coverage XML,
# but JUnit XML reports use the file-based Tests\ namespace.
# This script patches the JUnit XML before passing it to Infection so both
# formats are aligned and Infection can map source files to test files.

set -euo pipefail

COVERAGE_DIR="build/coverage"
INFECTION_DIR="build/infection"

mkdir -p "$COVERAGE_DIR" "$INFECTION_DIR"

echo "==> Generating Pest coverage…"
php -d pcov.enabled=1 vendor/bin/pest \
    --coverage-xml="$COVERAGE_DIR/coverage-xml" \
    --log-junit="$COVERAGE_DIR/junit.xml"

echo "==> Patching JUnit class names for Infection compatibility…"
sed -E \
    's/class="Tests\\/class="P\\Tests\\/g;
     s/classname="Tests\./classname="P.Tests./g' \
    "$COVERAGE_DIR/junit.xml" \
    > "$COVERAGE_DIR/junit-patched.xml"

cp "$COVERAGE_DIR/junit-patched.xml" "$COVERAGE_DIR/junit.xml"

echo "==> Running Infection…"
exec php vendor/bin/infection \
    --min-msi=100 \
    --min-covered-msi=100 \
    --threads=max \
    --show-mutations \
    --coverage="$COVERAGE_DIR" \
    --skip-initial-tests \
    "$@"
