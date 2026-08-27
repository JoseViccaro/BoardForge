# OpenSpec Change Proposal: `schematic-pdf-indexer`

**Change ID:** `schematic-pdf-indexer`  
**Topic:** Vector schematic indexing and cross-probing engine for electronic schematics (PDF/SVG/Vector stream) linking functional blocks, multi-page component symbols (e.g. U2700, PMU A15, Baseband PMIC), net labels (`PP_VDD_MAIN`, `I2C0_SDA`), and pin coordinates directly to BoardView pads and composite nets with Apple iPhone 13 schematic fixtures.  
**Mode:** `hybrid`  
**Date:** 2026-08-27  

---

## 1. Motivation & Context

In microelectronics diagnostics and logic-board repair (such as Apple iPhone 13, iPad, and MacBook platforms), technicians constantly alternate between:
1. **BoardView spatial representations** (physical pad locations, pin layouts, probe points, and interposer solder bridges), and
2. **Multi-page Schematic diagrams** (circuit functional blocks, power trees, voltage regulator configurations, series resistors, and net aliases).

Currently, BoardView net selection requires manually opening a separate PDF reader, executing text searches, flipping through dozens of schematic pages (e.g. 50–120 pages on iPhone 13 820-02106), and manually correlating pin numbers (e.g., `U2700.A12` on page 34 vs physical BGA ball on the top sub-board).

To provide instant, interactive, bidirectional diagnostic workflows, BoardForge requires a dedicated **Schematic Vector Indexer & Cross-Probing Engine** that:
- Ingests and parses vector PDF text and graphics streams,
- Indexes text tokens with high-precision 2D bounding boxes and page coordinates into spatial R-Trees,
- Recognizes component designators (e.g., `U2700`, `R1201`, `C5001`, `PMU_A15`, `PMX60`), pin numbers (e.g., `A1`, `B12`, `1`, `2`), and net labels (e.g., `PP_VDD_MAIN`, `I2C0_SDA`, `BUTTON_TO_PMU_ONOFF_L`) using resilient regex and symbol token extractors,
- Handles multi-page split component symbols (e.g., complex PMIC U2700 spanned across pages 12, 13, 14, 15 as Banks A, B, C, D),
- Establishes a bidirectional index linking Schematic Symbol Pins $\leftrightarrow$ BoardView SubBoard Pads $\leftrightarrow$ Interposer Junctions $\leftrightarrow$ Composite Nets.

---

## 2. Scope & Capabilities

1. **Vector & Text Stream Extraction**:
   - Extraction of text tokens, glyph runs, font metrics, matrix transformations, and bounding boxes (`x0`, `y0`, `x1`, `y1`) per page.
   - Vector path tokenization for bounding boxes of component symbol enclosures, pin terminals, and net label flags.

2. **Spatial R-Tree & Fast Probing**:
   - 2D Bounding Box Spatial Index (R-Tree / 2D bounding hierarchy) for $O(\log N)$ point-in-box and range queries on schematic pages.
   - Page-level and document-level coordinate normalization.

3. **Symbol Designator & Net Extractors**:
   - Designator Regex Extractor supporting microelectronics patterns (`[U|R|C|L|D|Q|FL|TP|J][0-9]{1,5}`, `U_BB_PMU`, `PMU_A15`, etc.).
   - Pin number extractors detecting BGA alphanumeric grid patterns (`[A-Z][0-9]{1,3}`) and numeric lead numbers (`[0-9]{1,4}`).
   - Net label extractors identifying standard Apple/microelectronics naming schemas (`PP_.*`, `PP1V8_.*`, `.*_L`, `.*_CONN`, `I2C.*`, `SPI.*`, `UART.*`).

4. **Multi-Page Symbol Aggregation**:
   - Aggregating multi-bank IC symbols across multiple schematic sheets into a single logical component definition.
   - Mapping each functional bank (e.g., `U2700: GPIO`, `U2700: BUCK_REGULATORS`, `U2700: POWER_IN`) to specific page numbers and bounding boxes.

5. **Bidirectional Cross-Probe Index**:
   - Point-to-Point lookup: Given a physical `PadEntity` / `InterposerJunction`, look up exact schematic page(s), symbol box, and pin coordinates.
   - Schematic-to-BoardView lookup: Given a clicked coordinate or selected symbol pin in the PDF, retrieve physical pad coordinates on Top or Bottom sub-boards and associated net topology.

6. **Apple iPhone 13 Schematic Fixtures**:
   - Realistic multi-page schematic fixtures for Apple iPhone 13 (820-02106) covering PMU A15 (`U2700`), Baseband PMIC (`PMX60`), Charger IC, and key nets (`PP_VDD_MAIN`, `PP1V8_S2`, `PP_VDD_CPU_CORE`, `I2C0_SDA`, `BUTTON_TO_PMU_ONOFF_L`).

---

## 3. Impact on Existing Architecture

- **Domain (`src/domain/schematics`)**:
  - Adds new Value Objects: `SchematicCoordinate`, `BoundingBox2D`, `SchematicPageRef`, `SymbolPinRef`, `NetLabelMatch`.
  - Adds new Entities / Aggregates: `SchematicDocument`, `SchematicPage`, `SchematicSymbol`, `MultiPageSymbolAggregate`, `SchematicPinLocation`.
  - Adds Spatial Indexing & Cross-Probe Services: `SchematicSpatialIndex` (R-Tree wrapper), `SymbolExtractorService`, `SchematicCrossProbeIndex`, `SchematicPdfParser`.
- **Domain (`src/domain/boardview`)**:
  - Seamlessly interoperates with `NetTopology`, `SubBoardEntity`, `PadEntity`, and `InterposerJunction` without breaking existing contracts.
- **Application (`src/application/schematics`)**:
  - Use cases for schematic document ingestion, cross-probe spatial search, component symbol multi-page resolution, and pin navigation.
