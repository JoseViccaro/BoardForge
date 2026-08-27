# OpenSpec Requirement Specification: `schematics`

**Domain:** `schematics`  
**Standard:** RFC 2119 (MUST, SHALL, SHOULD, MAY)  
**Target Entities & Modules:** `PowerTree`, `PowerRailNode`, `PMICSequenceMachine`, `PowerSequenceState`, `PowerRailType`, `SchematicDocument`, `SchematicPage`, `SchematicSymbol`, `MultiPageSymbolAggregate`, `SchematicPinLocation`, `BoundingBox2D`, `SchematicSpatialIndex`, `SymbolExtractorService`, `SchematicCrossProbeIndex`, `VectorToken`, `ISchematicParser`

---

## 1. Domain Overview

The `schematics` domain models power trees, rail dependencies, voltage regulators (Buck, LDO, Boost, Charge Pump), and the PMU cold-boot state sequence machine for the Apple iPhone 13 (A15 Bionic / PMU subsystem). Furthermore, it provides full Vector PDF/SVG stream parsing, spatial token indexing (R-Tree / 2D bounding boxes), symbol & net extraction, and bidirectional cross-probing against BoardView physical CAD models.

---

## 2. Formal Requirements

### Requirement 2.1: Hierarchical Power Tree Structure
* The power tree MUST model parent-to-child rail topologies with explicit source regulator components:
  1. Primary Ingestion: `PP_BATT_VCC` $\rightarrow$ Charger IC (Tigris/Hydra/Islander) $\rightarrow$ `PP_VDD_MAIN` (nominal 3.8V – 4.4V).
  2. Boost Regulator: `PP_VDD_MAIN` $\rightarrow$ Boost IC $\rightarrow$ `PP_VDD_BOOST` (nominal 5.0V).
  3. Always-On / Standby: `PP_VDD_MAIN` $\rightarrow$ Main PMIC LDO $\rightarrow$ `PP1V8_S2` (nominal 1.8V).
  4. Core Buck Domains: `PP_VDD_MAIN` $\rightarrow$ PMU Bucks $\rightarrow$ `PP_VDD_CPU_CORE`, `PP_VDD_GPU`, `PP_VDD_SOC`, `PP0V85_LPDDR5`.
  5. RF Domain: `PP_VDD_MAIN` $\rightarrow$ Interposer $\rightarrow$ `PP_VDD_RF_MAIN` $\rightarrow$ Baseband PMU (PMX60).
* Each `PowerRailNode` MUST define `nominal_voltage`, `voltage_min`, `voltage_max`, `rail_type` (`PRIMARY_BUS`, `BOOST`, `ALWAYS_ON_S2`, `CORE_BUCK`, `LDO_SWITCHED`), and `parent_rail_id`.

### Requirement 2.2: PMU Cold-Boot Power Sequence State Machine
* The system MUST model the 5 discrete power-up sequence states:
  * `S5_OFF`: Battery connected, only `PP_BATT_VCC` is present.
  * `S4_STANDBY`: Charger IC generates `PP_VDD_MAIN`, PMU standby circuits active, `PP1V8_S2` is stable.
  * `S3_TRIGGER`: Power button pressed (`BUTTON_TO_PMU_ONOFF_L` pulled low) or VBUS attached; PMU initiates buck turn-on cascade.
  * `S2_SLEEP`: SoC enters low-power sleep; high-current core rails powered down, `S2` always-on rails remain live.
  * `S0_FULL_EXECUTION`: All rails (CPU, GPU, DRAM, NAND, Display, RF) fully powered and stable.
* The state machine MUST validate transitions:
  * Legal forward sequence: `S5_OFF` $\rightarrow$ `S4_STANDBY` $\rightarrow$ `S3_TRIGGER` $\rightarrow$ `S0_FULL_EXECUTION`.
  * Sleep transitions: `S0_FULL_EXECUTION` $\leftrightarrow$ `S2_SLEEP`.
  * Fault / Power-cut transitions: Any state $\rightarrow$ `S5_OFF`.
* Illegal transitions (such as jumping directly from `S5_OFF` to `S0_FULL_EXECUTION` without `S4_STANDBY`) MUST be rejected with a domain state transition exception.

### Requirement 2.3: Rail Dependency Validation
* An active rail in state $S_n$ MUST NOT be valid if its parent rail in the `PowerTree` is absent or unpowered.
* For example, enabling `PP_VDD_BOOST` or `PP_VDD_CPU_CORE` MUST require `PP_VDD_MAIN` to be in `POWER_OK` state.

### Requirement 2.4: Vector Token & Bounding Box Representation
* The domain MUST model 2D bounding boxes via immutable `BoundingBox2D` value objects with coordinates `(minX, minY, maxX, maxY)`.
* `BoundingBox2D` MUST provide spatial intersection, containment (`containsPoint(x, y)`, `intersects(box)`), expansion (`union(box)`), and area calculation.
* Each extracted text token MUST be represented as a `VectorToken` containing:
  - `text`: string content (normalized trimmed Unicode),
  - `pageNumber`: 1-based page index,
  - `bounds`: `BoundingBox2D` in PDF points (72 DPI) or normalized mm,
  - `fontSize`: number,
  - `fontFamily`: optional string,
  - `rotationDegrees`: rotation angle ($0^\circ, 90^\circ, 180^\circ, 270^\circ$).

### Requirement 2.5: Spatial R-Tree Page Indexing
* Each `SchematicPage` MUST maintain an in-memory spatial index (`SchematicSpatialIndex`) powered by a 2D R-Tree structure.
* The spatial index MUST support:
  1. Point query `searchPoint(pageNumber, x, y)` returning all overlapping text tokens, pin symbols, or net labels in $O(\log N)$ average time complexity.
  2. Box range query `searchBox(pageNumber, queryBox)` returning all contained or intersecting elements.
  3. Nearest neighbor query `findNearestToken(pageNumber, x, y, maxDistance)` returning the closest text token within a radial boundary.

### Requirement 2.6: Component Symbol & Designator Extraction
* The `SymbolExtractorService` MUST extract electronic reference designators and associate them with functional symbol blocks.
* Supported designator regex classes MUST include:
  - Microchips / ICs: `^U[0-9]{1,5}[A-Z]?$`, `^U_[A-Z0-9_]+$`, `^PMU_[A-Z0-9_]+$` (e.g. `U2700`, `U_BB_PMU`, `PMU_A15`).
  - Passives: Resistors (`^R[0-9]{1,5}$`), Capacitors (`^C[0-9]{1,5}$`), Inductors (`^L[0-9]{1,5}$`), Diodes (`^D[0-9]{1,5}$`), Transistors/FETs (`^Q[0-9]{1,5}$`), Ferrite Beads/Filters (`^FL[0-9]{1,5}$`).
  - Connectors & Testpoints: `^J[0-9]{1,5}$`, `^TP[0-9]{1,5}$`.
* When a component symbol spans multiple banks (e.g. `U2700_A`, `U2700_B`, `U2700_C` or Bank designators in symbol headers), the extractor MUST aggregate all banks under a canonical `MultiPageSymbolAggregate` identified by the root designator (e.g., `U2700`).

### Requirement 2.7: Pin Extraction & Pin-to-Symbol Locators
* The extractor MUST identify pin numbers and pin names within proximity of a component symbol boundary:
  - Grid BGA Pins: Pattern `^[A-HJ-NP-Z][0-9]{1,3}$` (e.g., `A1`, `B12`, `AH35` excluding confusing letters I, O, Q, S where applicable).
  - Numbered Lead Pins: Pattern `^[0-9]{1,4}$` (e.g., `1`, `2`, `144`).
* Each `SchematicPinLocation` MUST record:
  - `refDes`: Parent component designator (e.g., `U2700`),
  - `pinNumber`: Normalized pin identifier (e.g., `A12`),
  - `pinName`: Optional functional pin signal label (e.g., `BUCK0_LX`),
  - `pageNumber`: Schematic page number,
  - `coordinates`: Pin insertion point `(x, y)` and bounding box.

### Requirement 2.8: Net Label Token Extraction & Aliasing
* The extractor MUST recognize net label tokens matching microelectronics power and signal topologies:
  - Power Rails: `^PP[0-9A-Z_]+$` (e.g., `PP_VDD_MAIN`, `PP1V8_S2`, `PP_VDD_CPU_CORE`, `PP_BATT_VCC`, `PP_VDD_BOOST`).
  - Active-Low Signals: `^[A-Z0-9_]+_L$` or `^[A-Z0-9_]+_N$` (e.g., `BUTTON_TO_PMU_ONOFF_L`, `AP_TO_PMU_RESET_L`).
  - Bus & Interface Lines: `^I2C[0-9]_[A-Z0-9_]+$`, `^SPI[0-9]_[A-Z0-9_]+$`, `^UART[0-9]_[A-Z0-9_]+$`.
* Extracted net labels MUST be associated with the corresponding page, coordinates, and intersecting wire or pin terminals.

### Requirement 2.9: Bidirectional Cross-Probe Indexing
* The `SchematicCrossProbeIndex` MUST establish two-way mapping between schematic entities and BoardView physical entities:
  1. **Physical Pad to Schematic Symbols**: Given `(subBoardId, padId)` or `(refDes, pinNumber)`:
     - Returns the list of schematic page occurrences, bounding box locations, and pin connection details.
  2. **Schematic Coordinate / Selection to Physical BoardView**: Given `(pageNumber, x, y)` or a selected schematic pin / net label:
     - Returns the resolved canonical `composite_net_id`, matching `PadEntity` coordinates on Top and/or Bottom sub-boards, and `InterposerJunction` details if bridged.
* Cross-probe queries MUST execute with sub-millisecond latency ($O(1)$ dictionary lookups or $O(\log N)$ spatial lookups).

### Requirement 2.10: Safe Ingestion & Fallback Resiliency
* The schematic parser MUST enforce defensive memory quotas:
  - Maximum input stream/file size: `256 MB`.
  - Maximum page count: `500 pages`.
* In the event of unparseable vector streams or corrupt fonts on a single page, the parser MUST log a recoverable diagnostic and continue indexing the remaining valid pages.

---

## 3. Given / When / Then Testable Scenarios (TDD)

### Scenario 3.1: Power Sequence Forward Progression
```gherkin
Given a PMICSequenceMachine initialized in state "S5_OFF"
When the battery is connected and PP_VDD_MAIN achieves stable 4.0 V
Then the machine transitions to state "S4_STANDBY"
And rail "PP1V8_S2" is marked active (1.8 V).
When a power button trigger event is received
Then the machine transitions to state "S3_TRIGGER"
And upon buck rail stabilization, transitions to "S0_FULL_EXECUTION"
And rails ["PP_VDD_CPU_CORE", "PP_VDD_GPU", "PP0V85_LPDDR5"] are active.
```

### Scenario 3.2: Rejection of Illegal State Transition
```gherkin
Given a PMICSequenceMachine in state "S5_OFF"
When an instruction requests an immediate jump to "S0_FULL_EXECUTION" without PP_VDD_MAIN
Then the state machine MUST throw an "IllegalStateTransitionException"
And the state MUST remain "S5_OFF".
```

### Scenario 3.3: Power Tree Missing Parent Fault
```gherkin
Given a power tree where "PP_VDD_BOOST" depends on "PP_VDD_MAIN"
When "PP_VDD_MAIN" is in FAULT state (0.0 V)
And a diagnostic query evaluates the expected state of "PP_VDD_BOOST"
Then the diagnostic engine asserts that "PP_VDD_BOOST" MUST be 0.0 V
And flags the root cause as "Parent rail PP_VDD_MAIN inactive".
```

### Scenario 3.4: Text Token Extraction & Spatial Query
```gherkin
Given a parsed schematic page 12 containing text tokens:
  | Text        | X0    | Y0    | X1    | Y1    |
  | U2700       | 150.0 | 200.0 | 180.0 | 212.0 |
  | PP_VDD_MAIN | 210.0 | 205.0 | 280.0 | 217.0 |
  | A12         | 185.0 | 206.0 | 195.0 | 214.0 |
When a spatial point query is executed at X=160.0, Y=205.0 on page 12
Then the spatial index MUST return token "U2700"
And when a spatial box query is executed for [180.0, 200.0, 300.0, 220.0]
Then the result MUST contain tokens ["PP_VDD_MAIN", "A12"].
```

### Scenario 3.5: Multi-Page Split Component Aggregation
```gherkin
Given schematic page 12 with symbol bank "U2700" (Bank A: BUCK_POWER)
And schematic page 13 with symbol bank "U2700" (Bank B: GPIO_CONTROL)
And schematic page 14 with symbol bank "U2700" (Bank C: LDO_OUT)
When the SymbolExtractorService processes the schematic document
Then it MUST aggregate all 3 occurrences into a single MultiPageSymbolAggregate for "U2700"
And the aggregate MUST list pages [12, 13, 14]
And querying pin "A12" (located on page 12) returns page 12 coordinates.
```

### Scenario 3.6: Bidirectional Cross-Probing BoardView to Schematic
```gherkin
Given a BoardView pad "TOP_U2700_A12" corresponding to component "U2700", pin "A12"
And a loaded SchematicCrossProbeIndex with iPhone 13 schematic fixtures
When querying cross-probe for component "U2700", pin "A12"
Then the index MUST return page 12
And the target bounding box MUST encompass pin "A12" and attached net "PP_VDD_MAIN".
```

### Scenario 3.7: Bidirectional Cross-Probing Schematic Coordinate to BoardView
```gherkin
Given a technician clicks on schematic coordinate X=245.0, Y=210.0 on page 12 (over net label "PP_VDD_MAIN")
When the cross-probe engine resolves the coordinate
Then the resolved net name MUST be "PP_VDD_MAIN"
And the physical BoardView pads MUST include "TOP_U2700_A12" on sub-board "SUB_IPHONE13_TOP_LOGIC"
And include Interposer pad "INT_PAD_084".
```
