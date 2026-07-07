<?php

declare(strict_types=1);

namespace SafeAccess\Inline\Parser\Csv;

use SafeAccess\Inline\Exceptions\CsvParseException;

/**
 * Minimal CSV/TSV parser following a safe subset of RFC 4180.
 *
 * The first non-empty logical row is the header; every subsequent row becomes
 * an indexed record whose keys are the header columns. All values are kept as
 * strings — CSV has no type system, so no numeric/boolean coercion is applied.
 *
 * Fields may be quoted with double quotes to embed the delimiter, escaped
 * quotes (`""`), or newlines. Rows whose field count differs from the header,
 * duplicate header columns, and unterminated quotes are rejected.
 *
 * Does not depend on external CSV libraries, making the library portable.
 * Behaviour is mirrored in the JS implementation for parity.
 *
 * @internal
 *
 * @see CsvAccessor       Accessor consuming this parser.
 * @see CsvParseException Thrown on parse errors.
 */
final class CsvParser
{
    /** @var string Field delimiter: `,` for CSV, `\t` for TSV. */
    private readonly string $delimiter;

    /**
     * @param string $delimiter Field delimiter: `,` for CSV, `\t` for TSV.
     */
    public function __construct(string $delimiter = ',')
    {
        $this->delimiter = $delimiter;
    }

    /**
     * Parse a CSV/TSV string into an indexed record of row arrays.
     *
     * @param string $csv Raw CSV/TSV content.
     *
     * @return array<mixed> Parsed rows keyed by zero-based index.
     *
     * @throws \SafeAccess\Inline\Exceptions\CsvParseException When quotes are unterminated, the header has duplicate columns, or a row's field count differs from the header.
     */
    public function parse(string $csv): array
    {
        $normalized = str_replace(["\r\n", "\r"], "\n", $csv);
        $rows = $this->splitRows($normalized);

        // Drop fully-empty rows (a single empty field).
        $dataRows = array_values(array_filter(
            $rows,
            fn (array $row): bool => !(count($row) === 1 && $row[0] === '')
        ));
        if ($dataRows === []) {
            return [];
        }

        $header = $dataRows[0];
        $this->assertUniqueColumns($header);
        $headerCount = count($header);

        $result = [];
        $rowCount = count($dataRows);
        for ($i = 1; $i < $rowCount; $i++) {
            $row = $dataRows[$i];
            $fieldCount = count($row);
            if ($fieldCount !== $headerCount) {
                throw new CsvParseException(
                    "Row " . ($i + 1) . " has {$fieldCount} field(s), expected {$headerCount}."
                );
            }
            $record = [];
            for ($c = 0; $c < $headerCount; $c++) {
                $record[$header[$c]] = $row[$c];
            }
            $result[(string) ($i - 1)] = $record;
        }

        return $result;
    }

    /**
     * Reject a header that repeats a column name (ambiguous access).
     *
     * @param array<int, string> $header Parsed header fields.
     *
     * @throws \SafeAccess\Inline\Exceptions\CsvParseException When a column name appears more than once.
     */
    private function assertUniqueColumns(array $header): void
    {
        $seen = [];
        foreach ($header as $column) {
            if (isset($seen[$column])) {
                throw new CsvParseException("Duplicate header column \"{$column}\".");
            }
            $seen[$column] = true;
        }
    }

    /**
     * Split the document into rows of fields, honouring quoted regions that may
     * span delimiters and newlines.
     *
     * @param string $input Newline-normalized CSV/TSV content.
     *
     * @return array<int, array<int, string>> Rows, each an array of unquoted field strings.
     *
     * @throws \SafeAccess\Inline\Exceptions\CsvParseException When a quoted field is never closed.
     */
    private function splitRows(string $input): array
    {
        $rows = [];
        $field = '';
        $row = [];
        $inQuotes = false;
        $len = strlen($input);

        for ($i = 0; $i < $len; $i++) {
            $ch = $input[$i];

            if ($inQuotes) {
                if ($ch === '"') {
                    if (($input[$i + 1] ?? '') === '"') {
                        // Escaped quote inside a quoted field.
                        $field .= '"';
                        $i++;
                    } else {
                        $inQuotes = false;
                    }
                } else {
                    $field .= $ch;
                }
                continue;
            }

            if ($ch === '"') {
                $inQuotes = true;
                continue;
            }

            if ($ch === $this->delimiter) {
                $row[] = $field;
                $field = '';
                continue;
            }

            if ($ch === "\n") {
                $row[] = $field;
                $rows[] = $row;
                $field = '';
                $row = [];
                continue;
            }

            $field .= $ch;
        }

        if ($inQuotes) {
            throw new CsvParseException('Unterminated quoted field.');
        }

        // Flush the final field/row unless the input ended exactly on a newline.
        if ($field !== '' || $row !== []) {
            $row[] = $field;
            $rows[] = $row;
        }

        return $rows;
    }
}
