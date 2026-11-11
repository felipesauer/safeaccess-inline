<?php

declare(strict_types=1);

/**
 * Packagist reads composer.json from the repository root, while the package is developed in
 * packages/php. This fails when the two files disagree on what the package is.
 */

$root = __DIR__ . '/../..';

/** @return array<string, mixed> */
function load(string $path): array
{
    $data = json_decode((string) file_get_contents($path), true, flags: JSON_THROW_ON_ERROR);
    assert(is_array($data));

    return $data;
}

$package = load($root . '/packages/php/composer.json');
$published = load($root . '/composer.json');
$errors = [];

foreach (['name', 'require', 'suggest'] as $key) {
    if (($package[$key] ?? null) !== ($published[$key] ?? null)) {
        $errors[] = sprintf(
            "\"%s\" differs: packages/php/composer.json has %s, composer.json has %s",
            $key,
            json_encode($package[$key] ?? null),
            json_encode($published[$key] ?? null),
        );
    }
}

$packageAutoload = $package['autoload']['psr-4'] ?? [];
$publishedAutoload = $published['autoload']['psr-4'] ?? [];

foreach ($packageAutoload as $namespace => $directory) {
    $expected = 'packages/php/' . $directory;
    if (($publishedAutoload[$namespace] ?? null) !== $expected) {
        $errors[] = sprintf('autoload psr-4 "%s" must be "%s" in composer.json', $namespace, $expected);
    } elseif (!is_dir($root . '/' . $expected)) {
        $errors[] = sprintf('autoload psr-4 "%s" points at "%s", which is not a directory', $namespace, $expected);
    }
}

foreach (array_diff_key($publishedAutoload, $packageAutoload) as $namespace => $directory) {
    $errors[] = sprintf('composer.json autoloads "%s" but packages/php/composer.json does not', $namespace);
}

if ($errors !== []) {
    fwrite(STDERR, implode("\n", $errors) . "\n");
    exit(1);
}

echo "composer.json and packages/php/composer.json agree on name, require, suggest and autoload.\n";
