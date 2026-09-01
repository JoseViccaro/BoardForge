# Delta for schematic-import (New Domain — Full Spec)

## Purpose

Parser infrastructure, CLI importer, and catalog service for ingesting vector-PDF schematics into `SchematicDocument` bundles with a JSON manifest keyed by `boardModel + boardRevision`.

---

## Requirements

### Requirement R1.1: Format Sniffing

The sniffer SHALL inspect the leading bytes of an input stream to identify its schematic format without relying on file extension.

#### Scenario: Sniff vector PDF

- GIVEN a PDF buffer with `%PDF-1.x` magic and text token streams
- WHEN the sniffer inspects the first 1024 bytes
- THEN it returns format `VECTOR_PDF` with confidence `EXACT_MAGIC`

#### Scenario: Sniff unknown format

- GIVEN a buffer starting with bytes that match no known schematic format
- WHEN the sniffer inspects it
- THEN it returns format `UNKNOWN` with a `UNRECOGNIZED_FORMAT` diagnostic

### Requirement R1.2: PDF Vector-Text Parser

The system SHALL parse vector-PDF files and extract `VectorToken` entries (text, bounds, page, fontSize) per page using `pdfjs-dist`.

#### Scenario: Parse text tokens with bounds

- GIVEN a single-page vector PDF containing text tokens `U2700` and `PP_VDD_MAIN` with font metadata
- WHEN the parser extracts tokens
- THEN each token has non-empty `text`, valid `BoundingBox2D`, and correct `pageNumber`

#### Scenario: PDF with no text tokens

- GIVEN a PDF where every page renders only raster images (no font/text operators)
- WHEN the parser runs
- THEN it returns a result with zero tokens and a `NO_TEXT_TOKENS` diagnostic code

### Requirement R1.3: Raw-to-SchematicDocument Assembler

The assembler SHALL transform a `RawSchematicTokenSet` into a `SchematicDocument` aggregate, validating per spec R2.10 (page limit, file size).

#### Scenario: Assemble valid document

- GIVEN a raw token set with 3 pages and valid token bounds
- WHEN the assembler runs
- THEN the result is a `SchematicDocument` with 3 `SchematicPage` entries each containing a spatial index

#### Scenario: Reject document exceeding page limit

- GIVEN a raw token set with 600 pages (above the 500-page R2.10 limit)
- WHEN the assembler validates
- THEN it returns an error with code `PAGE_LIMIT_EXCEEDED`

### Requirement R1.4: CLI Importer — Folder Scan and Bundle Emission

A CLI script SHALL recursively scan a directory for supported schematic files, parse each, and emit `SchematicDocumentBundle` JSON files plus a manifest under `public/`.

#### Scenario: Import a folder with two PDFs

- GIVEN a directory containing `iphone13_top.pdf` and `iphone13_bottom.pdf` (vector-PDF)
- WHEN the CLI runs against that directory
- THEN two bundle JSON files are written under `public/schematics/`
- AND a `manifest.json` maps `boardModel → bundle path` for each

#### Scenario: CLI skip on parse failure

- GIVEN a folder with one valid PDF and one corrupt PDF
- WHEN the CLI importer runs
- THEN the valid PDF is emitted as a bundle
- AND the corrupt PDF is skipped with a warning logged
- AND the manifest contains only the valid entry

### Requirement R1.5: Manifest Catalog — Board Resolution

A catalog service SHALL resolve a `boardModel + boardRevision` key to the corresponding `SchematicDocumentBundle` and hydrate it to a `SchematicDocument`.

#### Scenario: Resolve with exact revision

- GIVEN a manifest with entry `iPhone13_SCH / REV-C1`
- WHEN the catalog resolves `boardModel=iPhone13_SCH, boardRevision=REV-C1`
- THEN it returns the exact bundle and hydrates it

#### Scenario: Revision fallback to latest

- GIVEN a manifest with entries for `REV-A1` and `REV-C1` (latest) for model `iPhone13_SCH`
- WHEN the catalog resolves `boardModel=iPhone13_SCH` with no revision
- THEN it returns the `REV-C1` bundle (latest by timestamp)

#### Scenario: Bundle missing for requested board

- GIVEN a manifest with no entry for model `iPhone15_SCH`
- WHEN the catalog resolves `iPhone15_SCH`
- THEN it returns a `NO_BUNDLE_FOUND` result with no error thrown

### Requirement R1.6: Manifest Update Idempotence

Re-running the CLI importer SHALL update the manifest incrementally without duplicating entries for unchanged files.

#### Scenario: Re-scan with no new files

- GIVEN an existing manifest with entry for `iphone13_top.pdf`
- WHEN the CLI re-scans the same directory
- THEN the manifest entry is unchanged (no duplicate, no overwrite)

#### Scenario: Re-scan adds new file only

- GIVEN an existing manifest with `iphone13_top.pdf`
- WHEN the CLI scans the directory which now also contains `iphone13_bottom.pdf`
- THEN the manifest gains exactly one new entry for `iphone13_bottom.pdf`
- AND the existing entry is preserved unchanged

### Requirement R1.7: ISchematicParser Port

The domain port `ISchematicParser` SHALL accept raw bytes and return a `SchematicDocument` or an error result, enabling future parser implementations (e.g., SVG, image-based) without modifying domain code.

#### Scenario: Parser factory resolves to PDF parser

- GIVEN a sniffed format `VECTOR_PDF`
- WHEN the parser factory creates a parser
- THEN it returns a `PdfSchematicParser` implementing `ISchematicParser`

#### Scenario: Parser factory rejects unknown format

- GIVEN a sniffed format `UNKNOWN`
- WHEN the parser factory creates a parser
- THEN it returns a `NO_PARSER_FOR_FORMAT` error
