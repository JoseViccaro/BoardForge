# OpenSpec Proposal: `boardview-parser-engine`

**Change ID:** `boardview-parser-engine`  
**Domain:** `boardview` / `catalog`  
**Status:** `PROPOSED`  
**Mode:** `hybrid`  
**Authors:** BoardForge Core Team / SDD Engine  

---

## 1. Executive Summary & Problem Statement

BoardForge requires ingestion of industry-standard PCB BoardView CAD formats to reconstruct physical layouts, pin coordinates, test points, component footprints, and net connections into canonical domain entities (`CompositeBoard`, `SubBoardEntity`, `NetTopology`, `InterposerJunction`).

Historically, board repair technicians and reverse engineering tooling deal with fragmented, proprietary, legacy, and undocumented binary/ASCII formats:
1. **Landrex / TestVue (`.brd`)**: Proprietary binary/text format encoding pin coordinates, nail numbers, and component geometry.
2. **GenCAD 1.4 (`.cad`)**: ASCII CAD format with structured headers (`$HEADER`, `$SIGNALS`, `$COMPONENTS`, `$TRACKS`, `$PADS`).
3. **Fritzing / FZ / FZZ (`.fz`, `.fzz`)**: XML / Deflate ZIP archives containing board metadata, parts, and connector pin mappings.
4. **TopView / TVW (`.tvw`)**: Binary format specifying board dimensions, net names, and layer pins.
5. **BDV (`.bdv`)**: Text-based boardview format with clear column delimiters for pins, components, and outline coordinates.

### Key Challenges & Vulnerabilities:
- **Security Hazards**: Maliciously crafted archives (Zip bombs in `.fzz`), buffer overflows, unconstrained memory allocations, and infinite loops in malformed CAD headers.
- **Format Ambiguity**: Extensions are frequently misnamed, omitted, or altered across diagnostic dumps.
- **Partial/Corrupted Files**: Parsers must be resilient, providing non-fatal `ParseDiagnostic` warnings/errors while extracting maximum valid geometry.
- **Sandwich & Multi-Board Mapping**: Merging multiple board layers or stacked boards (e.g. iPhone double-decker logic/RF sandwiches) into unified `CompositeBoard` and `NetTopology` models.

---

## 2. Proposed Solution & Scope

We introduce a robust, pluggable, and secure **BoardView Parser Engine** in `src/domain/boardview/parsers/` and `src/infrastructure/boardview/`:

1. **Format Sniffer (`BoardViewFormatSniffer`)**:
   - Magic bytes and ASCII header inspection (MIME/format detection independent of file extensions).
   - Fast fallback heuristic detection.

2. **Parser Architecture & Strategy (`IBoardViewParser`)**:
   - Standard parser interface returning `ParsedBoardViewResult` with parsed entities, format metadata, and diagnostic collections.
   - Dedicated parsers:
     - `LandrexBrdParser` (`.brd`)
     - `GenCadParser` (`.cad`)
     - `FzzArchiveParser` (`.fz`, `.fzz`)
     - `BdvParser` (`.bdv`)
     - `TopViewParser` (`.tvw`)
   - `BoardViewParserFactory`: Resolves appropriate parser based on sniffing or explicit format hint.

3. **Defensive Streaming & Safety (`SafeBinaryReader` / `SafeStreamReader`)**:
   - Strict memory quotas (e.g., maximum memory allocation cap: 128MB per file).
   - Zip bomb decompression ratio protection (max 10x expansion ratio, max extracted size 50MB, max entry count 100).
   - Strict string length, array boundary checks, and recursion limits.

4. **Canonical Transformation Pipeline (`BoardViewToCanonicalTransformer`)**:
   - Maps intermediate parsed structures (`RawBoardViewDocument`) to canonical domain aggregates:
     - `SubBoardEntity` with `PadEntity`, `ComponentEntity`, `Dimensions2D`.
     - `CompositeBoard` (supporting single board or sandwich interposer configurations).
     - `NetTopology` with `InterposerJunction` links.

---

## 3. Impact Analysis & Architecture Alignment

- **Domain Integrity**: Pure domain models (`CompositeBoard`, `NetTopology`) remain isolated from CAD format quirks. Format idiosyncrasies are encapsulated within parser adapters.
- **Strict TDD Compliance**: Every parser format, safety guardrail, and transformer rule is accompanied by dedicated unit tests with synthetic and real CAD fixtures.
- **OWASP ASVS L2 Compliance**: Memory limits, decompression safety checks, and zero unsafe `eval`/native binary execution ensure complete compliance with BoardForge security principles.

---

## 4. Alternatives Considered

1. **C++ Native Addon / WebAssembly Port of OpenBoardView**:
   - *Rejected*: Introduces native build toolchain dependencies, cross-compilation complexity across Windows/Linux/macOS, and potential native memory corruption attack vectors. Pure TypeScript with robust safety limits provides maximum portability, determinism, and safety.
2. **Monolithic Universal Parser**:
   - *Rejected*: Violates Single Responsibility Principle and Open/Closed Principle. Dedicated modular parsers behind `IBoardViewParser` allow independent testing, optimization, and seamless addition of future formats (e.g., `.asc`, `.cadence`, `.kicad_pcb`).
