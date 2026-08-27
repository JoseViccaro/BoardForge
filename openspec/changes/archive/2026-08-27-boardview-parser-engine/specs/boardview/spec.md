# OpenSpec Delta Specification: `boardview` (Parser Engine Extension)

**Change ID:** `boardview-parser-engine`  
**Domain:** `boardview`  
**Standard:** RFC 2119 (MUST, SHALL, SHOULD, MAY)  
**Target Modules & Interfaces:** `BoardViewFormatSniffer`, `IBoardViewParser`, `SafeBinaryReader`, `BoardViewToCanonicalTransformer`, `ParseDiagnostic`  

---

## 1. Scope of Delta Specification

This specification extends the canonical `boardview` domain specification (`openspec/specs/boardview/spec.md`) with explicit technical and security requirements for ingesting, validating, decoding, and translating heterogeneous BoardView file formats into canonical domain structures (`CompositeBoard`, `SubBoardEntity`, `NetTopology`).

---

## 2. Requirements

### Requirement 2.1: Format Sniffing & Identification
* The `BoardViewFormatSniffer` MUST inspect the leading byte sequence (magic bytes) or header tokens of an input stream/buffer without relying exclusively on file extensions.
* Supported format signatures MUST include:
  1. **Landrex / BRD (`.brd`)**: Magic bytes / signature sequences (e.g., `BRD2`, `PCB_CAD_DATABASE`, or Landrex binary headers).
  2. **GenCAD 1.4 (`.cad`)**: Case-insensitive ASCII token `$HEADER` or `$GENCAD` within the first 1024 bytes.
  3. **Fritzing Archive (`.fzz`, `.fz`)**: PK zip header (`0x50 0x4B 0x03 0x04` / `PK\x03\x04`) containing XML manifest/part entries or direct XML `<module>` / `<part>`.
  4. **TopView (`.tvw`)**: TVW binary header or signature token within leading 128 bytes.
  5. **BDV (`.bdv`)**: ASCII headers beginning with `#FORMAT: BDV` or containing distinct `#PINS`, `#COMPONENTS`, `#NETS` section headers.
* If sniffing fails to match any recognized format signature, the system MUST return a `FormatDetectionResult` with `format: BoardViewFormat.UNKNOWN` and an explanatory diagnostic code (`UNRECOGNIZED_FORMAT_SIGNATURE`).

### Requirement 2.2: Defensive Binary & Stream Safety
* All binary parsing MUST execute via `SafeBinaryReader` to prevent buffer overruns and untrusted memory allocation.
* Memory quotas and boundaries MUST be strictly enforced:
  1. **Max Stream / Buffer Size**: Single input files MUST NOT exceed `128 MB`. Files exceeding this threshold MUST be rejected immediately with `PayloadTooLargeError`.
  2. **Bounds Checking**: Every read operation (`readInt32LE`, `readFloatLE`, `readCString`, `readFixedBytes`) MUST verify that `offset + length <= buffer.byteLength`. Attempted reads past EOF MUST raise `PrematureEndOfStreamError` with byte offset diagnostic context.
  3. **String Safety**: Parsers reading null-terminated or length-prefixed strings MUST enforce a max string length of `2048` characters to prevent infinite loops on corrupted memory blocks.
  4. **ZIP Archive Safety (Decompression Bomb Protection)**:
     - The decompression routine for `.fzz` archives MUST enforce a maximum uncompressed size cap of `50 MB`.
     - The decompression ratio MUST NOT exceed `10:1` relative to the compressed entry size.
     - The archive MUST NOT contain more than `100` total entries or recursive nested archives.

### Requirement 2.3: Resilient Parsing & Diagnostics
* Parsers MUST NOT fail completely upon encountering non-critical syntax errors, unknown pin attributes, or unrecognized token blocks.
* Parsers MUST collect and return structured `ParseDiagnostic` objects:
  ```typescript
  export enum DiagnosticSeverity {
    INFO = "INFO",
    WARNING = "WARNING",
    ERROR = "ERROR",
    FATAL = "FATAL"
  }

  export interface ParseDiagnostic {
    severity: DiagnosticSeverity;
    code: string;
    message: string;
    line?: number;
    byteOffset?: number;
    context?: Record<string, unknown>;
  }
  ```
* In the presence of non-fatal warnings or recoverable errors, the parser MUST return a valid `RawBoardViewDocument` containing all recoverable entities alongside the accumulated diagnostics.
* In the presence of a `FATAL` error (e.g. unreadable header, memory violation, decryption failure), the parser MUST return a failed result with diagnostic details without throwing unhandled exceptions.

### Requirement 2.4: Parser Implementations & Ingestion Pipeline
* Every format parser MUST implement the `IBoardViewParser` contract:
  ```typescript
  export interface IBoardViewParser {
    readonly supportedFormat: BoardViewFormat;
    canParse(headerBytes: Uint8Array, filename?: string): boolean;
    parse(content: Uint8Array | string, options?: ParseOptions): Promise<ParsedBoardViewResult>;
  }
  ```
* The parsers MUST extract and normalize:
  1. **Sub-Board Dimensions & Outline**: Bounding box `(width, height)` and polygon vertex arrays.
  2. **Layer Orientation**: `TOP` (A-side) vs `BOTTOM` (B-side) layer assignment.
  3. **Components & Footprints**: Designator (`refDes`, e.g., `U2700`), package/footprint name, center coordinates `(x, y)`, rotation angle $\theta$, side (`TOP` / `BOTTOM`).
  4. **Pads & Pins**: Pin number/name (`pinRef`, e.g. `A12`, `1`), parent component `refDes`, coordinates `(x, y)`, pad shape (round, rectangular, polygonal), electrical net name.
  5. **Nails / Test Points / Vias**: Location coordinates and associated net names.
  6. **Nets & Signals**: Unique canonical net names, power rail classifications, and connected pin lists.

### Requirement 2.5: Canonical Transformation & Sandwich Assembly
* The `BoardViewToCanonicalTransformer` MUST convert intermediate `RawBoardViewDocument` instances into canonical `SubBoardEntity` and `CompositeBoard` aggregates.
* Coordinate systems MUST be normalized to millimeter (`mm`) units with standard right-handed Cartesian coordinates. If input CAD uses mils or internal integer units, the transformer MUST apply exact scaling factors:
  $$\text{mm} = \text{mils} \times 0.0254$$
* For multi-board sandwich configurations (e.g., iPhone Top Logic Board + Bottom RF Board):
  1. The transformer MUST support pairing two parsed documents with an optional `InterposerDefinition`.
  2. Interposer pads with identical or mapped ball IDs MUST be linked into `InterposerJunction` value objects within the resulting `NetTopology` aggregate.

---

## 3. Testable Scenarios (Strict TDD Given / When / Then)

### Scenario 3.1: Format Sniffing of ASCII and Binary Payloads
```gherkin
Given a raw byte buffer starting with "$HEADER\nFORMAT GENCAD 1.4"
When BoardViewFormatSniffer.sniff(buffer) is executed
Then the detected format MUST be "GENCAD"
And confidence MUST be "EXACT_MAGIC".

Given a raw byte buffer starting with Landrex binary signature "BRD2"
When BoardViewFormatSniffer.sniff(buffer) is executed
Then the detected format MUST be "LANDREX_BRD"
And confidence MUST be "EXACT_MAGIC".
```

### Scenario 3.2: Safe Binary Reader Buffer Bounds Protection
```gherkin
Given a malformed binary buffer of length 16 bytes
And a parser attempting to read an Int32 string length of 1000 bytes at offset 12
When SafeBinaryReader.readFixedString(1000) is called
Then the operation MUST throw PrematureEndOfStreamError
And the error context MUST contain currentOffset=12 and requestedLength=1000.
```

### Scenario 3.3: Zip Bomb Defense in FZZ Parser
```gherkin
Given a malicious .fzz archive containing a compressed stream expanding to 500 MB (100:1 ratio)
When FzzArchiveParser.parse(maliciousArchive) is executed
Then the parser MUST abort decompression immediately
And return a FATAL ParseDiagnostic with code "DECOMPRESSION_BOMB_DETECTED".
```

### Scenario 3.4: Complete Ingestion and Canonical Transformation of GenCAD
```gherkin
Given a valid GenCAD 1.4 payload containing:
  - 1 Component "U1" on layer TOP at (10.0, 20.0)
  - 2 Pins ("U1.1" -> Net "PP_VDD_MAIN", "U1.2" -> Net "GND")
When GenCadParser parses the payload and passes it to BoardViewToCanonicalTransformer
Then the generated SubBoardEntity MUST contain 1 ComponentEntity "U1"
And 2 PadEntities with coordinates and net bindings
And the NetTopology aggregate MUST contain nets "PP_VDD_MAIN" and "GND".
```
