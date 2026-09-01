# OpenSpec Requirement Specification: `boardview`

**Change ID:** `iphone13-board-core` / `boardview-parser-engine`  
**Domain:** `boardview`  
**Standard:** RFC 2119 (MUST, SHALL, SHOULD, MAY)  
**Target Entities & Modules:** `InterposerJunction`, `CoordinateTransform`, `LayerOrientation`, `BidirectionalNetResolver`, `BoardViewFormatSniffer`, `IBoardViewParser`, `SafeBinaryReader`, `BoardViewToCanonicalTransformer`, `ParseDiagnostic`

---

## 1. Domain Overview

The `boardview` domain governs 2D/3D spatial geometry, pad/pin/via locations, coordinate system transformations across stacked sub-boards, cross-board electrical net resolution, and defensive ingestion/parsing of industry-standard PCB BoardView CAD formats (`Landrex .brd`, `GenCAD 1.4 .cad`, `Fritzing .fz/.fzz`, `BDV .bdv`, `TopView .tvw`).

---

## 2. Formal Requirements

### Requirement 2.1: Interposer Junction Mapping
* An `InterposerJunction` MUST link a top sub-board pad (`top_pad_id`), an interposer perimeter pad/ball (`interposer_ball_id`), and a bottom sub-board pad (`bottom_pad_id`) to a single canonical `composite_net_id`.
* If a net terminates solely on one sub-board without bridging across the interposer, the junction MAY omit the opposite sub-board pad link (`NULL` / `None`).
* The system MUST enforce referential integrity such that every referenced pad ID exists in its respective `SubBoardEntity`.

### Requirement 2.2: Coordinate Transformations & Layer Flipping
* Each `SubBoardEntity` MUST define its own 2D Cartesian coordinate space in millimeters (`mm`) with origin `(0.0, 0.0)`.
* The domain MUST provide pure `CoordinateTransform` functions for:
  1. `FlipHorizontal(x, y, board_width)`: Translates coordinates when switching between A-side (Top) and B-side (Bottom) of a sub-board.
  2. `TranslateSubBoard(x, y, offset_x, offset_y)`: Offsets sub-board relative to the composite viewport.
  3. `StackTransform(x, y, z_index)`: 3D multi-layer displacement for exploded view rendering.
* Coordinate transformations MUST be deterministic and maintain floating-point precision within $\pm 0.0001\text{ mm}$.

### Requirement 2.3: Bidirectional Netlist Pin-to-Pad Resolution
* Given a component pin on the Top AP board (e.g., `U2700.A12`), the `BidirectionalNetResolver` MUST resolve the full electrical path across:
  1. Local sub-board net alias (`PP_VDD_MAIN`),
  2. The corresponding `InterposerJunction` pad (e.g., `PAD_84`),
  3. The bottom sub-board pad and destination component pin (e.g., `U_BB_PMU.C4` / `PP_VDD_RF_MAIN`).
* Given an Interposer pad ID, the resolver MUST return all connected component pins on both Top and Bottom sub-boards in $O(1)$ or $O(\log N)$ lookup time.

### Requirement 2.4: Format Sniffing & Identification
* The `BoardViewFormatSniffer` MUST inspect the leading byte sequence (magic bytes) or header tokens of an input stream/buffer without relying exclusively on file extensions.
* Supported format signatures MUST include:
  1. **Landrex / BRD (`.brd`)**: Magic bytes / signature sequences (e.g., `BRD2`, `PCB_CAD_DATABASE`, or Landrex binary headers).
  2. **GenCAD 1.4 (`.cad`)**: Case-insensitive ASCII token `$HEADER` or `$GENCAD` within the first 1024 bytes.
  3. **Fritzing Archive (`.fzz`, `.fz`)**: PK zip header (`0x50 0x4B 0x03 0x04` / `PK\x03\x04`) containing XML manifest/part entries or direct XML `<module>` / `<part>`.
  4. **TopView (`.tvw`)**: TVW binary header or signature token within leading 128 bytes.
  5. **BDV (`.bdv`)**: ASCII headers beginning with `#FORMAT: BDV` or containing distinct `#PINS`, `#COMPONENTS`, `#NETS` section headers.
* If sniffing fails to match any recognized format signature, the system MUST return a `FormatDetectionResult` with `format: BoardViewFormat.UNKNOWN` and an explanatory diagnostic code (`UNRECOGNIZED_FORMAT_SIGNATURE`).

### Requirement 2.5: Defensive Binary & Stream Safety
* All binary parsing MUST execute via `SafeBinaryReader` to prevent buffer overruns and untrusted memory allocation.
* Memory quotas and boundaries MUST be strictly enforced:
  1. **Max Stream / Buffer Size**: Single input files MUST NOT exceed `128 MB`. Files exceeding this threshold MUST be rejected immediately with `PayloadTooLargeError`.
  2. **Bounds Checking**: Every read operation (`readInt32LE`, `readFloatLE`, `readCString`, `readFixedBytes`) MUST verify that `offset + length <= buffer.byteLength`. Attempted reads past EOF MUST raise `PrematureEndOfStreamError` with byte offset diagnostic context.
  3. **String Safety**: Parsers reading null-terminated or length-prefixed strings MUST enforce a max string length of `2048` characters to prevent infinite loops on corrupted memory blocks.
  4. **ZIP Archive Safety (Decompression Bomb Protection)**:
     - The decompression routine for `.fzz` archives MUST enforce a maximum uncompressed size cap of `50 MB`.
     - The decompression ratio MUST NOT exceed `10:1` relative to the compressed entry size.
     - The archive MUST NOT contain more than `100` total entries or recursive nested archives.

### Requirement 2.6: Resilient Parsing & Diagnostics
* Parsers MUST NOT fail completely upon encountering non-critical syntax errors, unknown pin attributes, or unrecognized token blocks.
* Parsers MUST collect and return structured `ParseDiagnostic` objects (`INFO`, `WARNING`, `ERROR`, `FATAL`).
* In the presence of non-fatal warnings or recoverable errors, the parser MUST return a valid `RawBoardViewDocument` containing all recoverable entities alongside the accumulated diagnostics.
* In the presence of a `FATAL` error, the parser MUST return a failed result with diagnostic details without throwing unhandled exceptions.

### Requirement 2.7: Parser Implementations & Ingestion Pipeline
* Every format parser MUST implement the `IBoardViewParser` contract returning `ParsedBoardViewResult`.
* The parsers MUST extract and normalize:
  1. **Sub-Board Dimensions & Outline**: Bounding box `(width, height)` and polygon vertex arrays.
  2. **Layer Orientation**: `TOP` (A-side) vs `BOTTOM` (B-side) layer assignment.
  3. **Components & Footprints**: Designator (`refDes`), package/footprint name, center coordinates `(x, y)`, rotation angle $\theta$, side (`TOP` / `BOTTOM`).
  4. **Pads & Pins**: Pin number/name (`pinRef`), parent component `refDes`, coordinates `(x, y)`, pad shape, electrical net name.
  5. **Nails / Test Points / Vias**: Location coordinates and associated net names.
  6. **Nets & Signals**: Unique canonical net names, power rail classifications, and connected pin lists.

### Requirement 2.8: Canonical Transformation & Sandwich Assembly
* The `BoardViewToCanonicalTransformer` MUST convert intermediate `RawBoardViewDocument` instances into canonical `SubBoardEntity` and `CompositeBoard` aggregates.
* Coordinate systems MUST be normalized to millimeter (`mm`) units with standard right-handed Cartesian coordinates ($1\text{ mil} = 0.0254\text{ mm}$).
* For multi-board sandwich configurations:
  1. The transformer MUST support pairing multiple parsed sub-board documents with an optional `InterposerDefinition`.
  2. Interposer pads with identical or mapped ball IDs MUST be linked into `InterposerJunction` value objects within the resulting `NetTopology` aggregate.

### Requirement 2.9: Boardview–Schematic Auto-Pairing
* The system MUST auto-resolve the companion schematic for a boardview by board model and revision, without manual user selection.
* The pairing MUST be deterministic given `(boardModel, boardRevision)` and MUST fail with a resolvable diagnostic when no companion exists.
* #### Scenario: Auto-resolve known companion
  - GIVEN a board opened with model "iPhone 13" and revision "REV1"
  - WHEN the workbench requests its companion schematic
  - THEN the system returns the matching schematic document
  - AND the boardview and schematic render side-by-side without manual action
* #### Scenario: No companion found
  - GIVEN a board with model "iPhone 11 Pro" and revision "REV3"
  - AND no schematic fixture matches that exact revision
  - WHEN the pair resolver runs
  - THEN the system returns a "NO_COMPANION" resolution result
  - AND the boardview still renders while the schematic panel shows an empty/missing state

### Requirement 2.10: Net Highlighting Synchronization
* The boardview panel MUST render net highlighting that reflects the shared workbench selection at sub-second latency.
* The highlight MUST visually distinguish the selected net from non-selected pads/traces per current layer orientation.
* #### Scenario: Selection drives highlight
  - GIVEN a shared net selection active in the workbench
  - WHEN the boardview panel repaints
  - THEN all pads and traces belonging to that net are highlighted
  - AND non-selected components remain visually dimmed but interactive
* #### Scenario: Layer flip preserves highlight
  - GIVEN a highlighted net on the TOP layer
  - WHEN the user flips to the BOTTOM layer view
  - THEN the same net's bottom-side pads/traces remain highlighted

### Requirement 2.11: Pin Hover & Click Reveal
* On pin hover, the boardview MUST reveal net info; on pin click, it MUST reveal linked schematic component details (pages, coordinates, connected nets).
* The reveal data MUST come from the `SchematicCrossProbeIndex` without duplicating domain logic.
* #### Scenario: Hover reveals net info
  - GIVEN a pin rendered in boardview
  - WHEN the user hovers over it
  - THEN a tooltip shows the canonical net name and net classification
* #### Scenario: Click reveals linked schematic
  - GIVEN a pin with a cross-probe mapping (e.g. `TOP_U2700_A12`)
  - WHEN the user clicks it
  - THEN the system reveals linked schematic component `U2700`
  - AND shows pages, pin coordinates, and connected net `PP_VDD_MAIN`

---

## 3. Given / When / Then Testable Scenarios (TDD)

### Scenario 3.1: Interposer Junction Net Resolution
```gherkin
Given a CompositeBoard "BRD_820_02106" with an InterposerJunction:
  | Junction ID | Interposer Pad | Top Pad ID    | Bottom Pad ID | Net Name    |
  | JUNC_084    | INT_PAD_084    | TOP_U2700_A12 | BOT_UBBPMU_C4 | PP_VDD_MAIN |
When resolving the net for Top board pin "TOP_U2700_A12"
Then the resolver returns net "PP_VDD_MAIN"
And the connected interposer pad is "INT_PAD_084"
And the connected bottom board pin is "BOT_UBBPMU_C4".
```

### Scenario 3.2: SubBoard Coordinate Side Flipping
```gherkin
Given a SubBoard with width 60.0 mm and height 120.0 mm
And a component pad located at X=15.25 mm, Y=45.50 mm on the TOP side
When the coordinate transform "FlipHorizontal" is applied for the BOTTOM side view
Then the resulting coordinates MUST be X=44.75 mm (60.0 - 15.25) and Y=45.50 mm.
```

### Scenario 3.3: Bidirectional Cross-Probing from Interposer Pad
```gherkin
Given the registered iPhone 13 interposer layout
When a user clicks on Interposer Pad "INT_PAD_084"
Then the system highlights all connected traces on Top SubBoard (AP)
And highlights all connected traces on Bottom SubBoard (RF)
And returns a unified net classification of "POWER_MAIN".
```

### Scenario 3.4: Format Sniffing of ASCII and Binary Payloads
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

### Scenario 3.5: Safe Binary Reader Buffer Bounds Protection
```gherkin
Given a malformed binary buffer of length 16 bytes
And a parser attempting to read an Int32 string length of 1000 bytes at offset 12
When SafeBinaryReader.readFixedString(1000) is called
Then the operation MUST throw PrematureEndOfStreamError
And the error context MUST contain currentOffset=12 and requestedLength=1000.
```

### Scenario 3.6: Zip Bomb Defense in FZZ Parser
```gherkin
Given a malicious .fzz archive containing a compressed stream expanding to 500 MB (100:1 ratio)
When FzzArchiveParser.parse(maliciousArchive) is executed
Then the parser MUST abort decompression immediately
And return a FATAL ParseDiagnostic with code "DECOMPRESSION_BOMB_DETECTED".
```

### Scenario 3.7: Complete Ingestion and Canonical Transformation of GenCAD
```gherkin
Given a valid GenCAD 1.4 payload containing:
  - 1 Component "U1" on layer TOP at (10.0, 20.0)
  - 2 Pins ("U1.1" -> Net "PP_VDD_MAIN", "U1.2" -> Net "GND")
When GenCadParser parses the payload and passes it to BoardViewToCanonicalTransformer
Then the generated SubBoardEntity MUST contain 1 ComponentEntity "U1"
And 2 PadEntities with coordinates and net bindings
And the NetTopology aggregate MUST contain nets "PP_VDD_MAIN" and "GND".
```
