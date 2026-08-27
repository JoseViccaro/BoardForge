# Implementation Tasks: `boardview-parser-engine`

**Change ID:** `boardview-parser-engine`  
**Development Methodology:** Strict TDD (Red -> Green -> Refactor)  

---

## Phase 1: Core Value Objects, Safety Boundaries & Sniffer

- [x] **Task 1.1: Core Enums, Diagnostic VO & AST Types** (TDD)
  - Define `BoardViewFormat` enum and `ParseDiagnostic` interface with severity levels in `src/domain/boardview/value-objects/`.
  - Define `RawBoardViewDocument`, `RawPin`, `RawComponent`, `RawNail`, `RawBoardOutline` intermediate AST types in `src/domain/boardview/intermediate/`.
  - Define `IBoardViewParser` and `IBoardViewParserFactory` interfaces in `src/domain/boardview/ports/`.

- [x] **Task 1.2: SafeBinaryReader & Buffer Boundary Guardrails** (TDD)
  - Unit Test (`tests/unit/domain/boardview/SafeBinaryReader.spec.ts`):
    - Red: Test reading beyond EOF throws `PrematureEndOfStreamError`.
    - Red: Test fixed string truncation and `readNullTerminatedString` max limit of 2048 chars.
    - Red: Test allocation cap rejection on > 128 MB inputs.
  - Implement `SafeBinaryReader` in `src/infrastructure/boardview/io/SafeBinaryReader.ts`.
  - Green: Verify all boundary safety and primitive LE/BE reading tests pass.

- [x] **Task 1.3: BoardViewFormatSniffer** (TDD)
  - Unit Test (`tests/unit/domain/boardview/BoardViewFormatSniffer.spec.ts`):
    - Red: Test magic byte detection for Landrex BRD, GenCAD `$HEADER`, FZZ zip signature, BDV tokens, and TopView header.
    - Red: Test fallback to `BoardViewFormat.UNKNOWN` for unrecognized files.
  - Implement `BoardViewFormatSniffer` in `src/domain/boardview/services/BoardViewFormatSniffer.ts`.
  - Green: Verify sniffer accuracy across all sample payloads.

---

## Phase 2: Format Parsers Implementation

- [x] **Task 2.1: GenCAD 1.4 Parser (`GenCadParser`)** (TDD)
  - Unit Test (`tests/unit/domain/boardview/GenCadParser.spec.ts`):
    - Red: Test parsing of `$HEADER`, `$BOARD`, `$COMPONENTS`, `$PINS`, `$SIGNALS` sections.
    - Red: Test tolerance to unknown sections with diagnostic warnings.
  - Implement `GenCadParser` in `src/infrastructure/boardview/parsers/GenCadParser.ts`.
  - Green & Refactor.

- [x] **Task 2.2: Landrex BRD Parser (`LandrexBrdParser`)** (TDD)
  - Unit Test (`tests/unit/domain/boardview/LandrexBrdParser.spec.ts`):
    - Red: Test decoding binary Landrex record tables (components, pins, nails, traces).
    - Red: Test integer coordinate conversion to millimeters.
  - Implement `LandrexBrdParser` in `src/infrastructure/boardview/parsers/LandrexBrdParser.ts`.
  - Green & Refactor.

- [x] **Task 2.3: FZZ Archive Parser with Zip Bomb Protection (`FzzArchiveParser`)** (TDD)
  - Unit Test (`tests/unit/domain/boardview/FzzArchiveParser.spec.ts`):
    - Red: Test decompression ratio cutoff (> 10:1 ratio triggers `DECOMPRESSION_BOMB_DETECTED`).
    - Red: Test XML parsing of parts and connector pin definitions.
  - Implement `SafeZipExtractor` in `src/infrastructure/boardview/io/SafeZipExtractor.ts`.
  - Implement `FzzArchiveParser` in `src/infrastructure/boardview/parsers/FzzArchiveParser.ts`.
  - Green & Refactor.

- [x] **Task 2.4: BDV & TopView Parsers (`BdvParser`, `TopViewParser`)** (TDD)
  - Unit Test (`tests/unit/domain/boardview/BdvParser.spec.ts` & `TopViewParser.spec.ts`):
    - Red: Test column-delimited text extraction in BDV.
    - Red: Test binary TVW block unpack.
  - Implement `BdvParser` and `TopViewParser` in `src/infrastructure/boardview/parsers/`.
  - Green & Refactor.

- [x] **Task 2.5: BoardViewParserFactory** (TDD)
  - Unit Test (`tests/unit/domain/boardview/BoardViewParserFactory.spec.ts`):
    - Red: Test resolution of registered parsers by enum and auto-detection from raw buffer.
  - Implement `BoardViewParserFactory` in `src/infrastructure/boardview/parsers/BoardViewParserFactory.ts`.
  - Green & Refactor.

---

## Phase 3: Canonical Transformation & Sandwich Integration

- [x] **Task 3.1: BoardViewToCanonicalTransformer (Single Board)** (TDD)
  - Unit Test (`tests/unit/domain/boardview/BoardViewToCanonicalTransformer.spec.ts`):
    - Red: Test transformation of `RawBoardViewDocument` to `SubBoardEntity`, `PadEntity`, `ComponentEntity`, and `CompositeBoard`.
    - Red: Test generation of `NetTopology` with single-board local pins.
  - Implement `BoardViewToCanonicalTransformer` in `src/domain/boardview/services/BoardViewToCanonicalTransformer.ts`.
  - Green & Refactor.

- [x] **Task 3.2: Multi-Board & Sandwich Interposer Pairing** (TDD)
  - Unit Test (`tests/unit/domain/boardview/BoardViewToCanonicalTransformerSandwich.spec.ts`):
    - Red: Test combining Top logic and Bottom RF sub-boards into `BoardStackType.SANDWICH_INTERPOSER`.
    - Red: Test linking interposer pads into `InterposerJunction` instances across top and bottom sub-boards.
  - Implement sandwich transformation logic in `BoardViewToCanonicalTransformer`.
  - Green & Refactor.

---

## Phase 4: End-to-End Ingestion Integration & Verification

- [x] **Task 4.1: End-to-End Parser Engine Ingestion Pipeline Tests**
  - Verify complete ingestion flow from raw multi-format files to `CompositeBoard` queries and `BidirectionalNetResolver` queries.
  - Verify zero memory leaks and complete ASVS Level 2 compliance on malicious inputs.
