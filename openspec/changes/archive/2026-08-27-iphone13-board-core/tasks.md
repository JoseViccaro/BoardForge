# Implementation Tasks: `iphone13-board-core`

**Change ID:** `iphone13-board-core`  
**Status:** Ready for Implementation  
**Methodology:** Strict Test-Driven Development (TDD: Red $\rightarrow$ Green $\rightarrow$ Refactor)  
**Target Subsystems:** `catalog`, `boardview`, `measurements`, `schematics`  
**Device Target:** Apple iPhone 13 (A2482, A2631, A2633, A2634, A2635 / Logic Board 820-02106)  

---

## Phase 1: Domain Value Objects & Coordinate Transformers (TDD Cycle)

### 1.1. Catalog & BoardView Value Objects
- [x] **1.1.1 [RED] Write unit tests for Catalog & BoardView Value Objects**
  - Path: `tests/unit/domain/catalog/value-objects.spec.ts`
  - Path: `tests/unit/domain/boardview/value-objects.spec.ts`
  - Scenarios:
    - Validate `BoardId`, `SubBoardId`, `BoardStackType` enum invariants.
    - Test `LayerSide` (`TOP_SIDE`, `BOTTOM_SIDE`) and `NetClassification` (`POWER_MAIN`, `POWER_BUCK`, `SIGNAL_I2C`, `SIGNAL_SPI`, `RF_ANTENNA`, `GROUND`).
    - Test `LayerCoordinate` immutability, precision rounding ($0.0001\text{ mm}$), and equality.
    - Test `InterposerJunction` instantiation, optional pad link handling, and `isBridge()` predicate.
- [x] **1.1.2 [GREEN] Implement Catalog & BoardView Value Objects**
  - Path: `src/domain/catalog/value-objects/BoardId.ts`
  - Path: `src/domain/catalog/value-objects/SubBoardId.ts`
  - Path: `src/domain/catalog/value-objects/BoardStackType.ts`
  - Path: `src/domain/boardview/value-objects/LayerCoordinate.ts`
  - Path: `src/domain/boardview/value-objects/LayerSide.ts`
  - Path: `src/domain/boardview/value-objects/NetClassification.ts`
  - Path: `src/domain/boardview/value-objects/InterposerJunction.ts`
- [x] **1.1.3 [REFACTOR] Clean up value object equality checks and type brands**
  - Ensure zero external runtime dependencies and strict TypeScript readonly properties.

### 1.2. Measurements & Schematics Value Objects
- [x] **1.2.1 [RED] Write unit tests for Measurements & Schematics Value Objects**
  - Path: `tests/unit/domain/measurements/value-objects.spec.ts`
  - Path: `tests/unit/domain/schematics/value-objects.spec.ts`
  - Scenarios:
    - Test `DiagnosticBoardState` enum values (`SPLIT_TOP`, `SPLIT_BOTTOM`, `JOINED_SANDWICH`, `SOCKET_FIXTURE`).
    - Test `MultimeterProfile` scaling factor and offset calculation.
    - Test `DiodeReading` normalized voltage calculation and `isOpenLoop` handling.
    - Test `ToleranceWindow` boundary evaluations (`nominal`, `min`, `max`, `tolerancePct`).
    - Test `PowerRailState`, `PowerSequenceState`, and `PowerRailType` structural integrity.
- [x] **1.2.2 [GREEN] Implement Measurements & Schematics Value Objects**
  - Path: `src/domain/measurements/value-objects/DiagnosticBoardState.ts`
  - Path: `src/domain/measurements/value-objects/MultimeterProfile.ts`
  - Path: `src/domain/measurements/value-objects/DiodeReading.ts`
  - Path: `src/domain/measurements/value-objects/ToleranceWindow.ts`
  - Path: `src/domain/measurements/value-objects/EvaluationOutcome.ts`
  - Path: `src/domain/schematics/value-objects/PowerRailState.ts`
  - Path: `src/domain/schematics/value-objects/PowerSequenceState.ts`
  - Path: `src/domain/schematics/value-objects/PowerRailType.ts`
- [x] **1.2.3 [REFACTOR] Standardize numerical precision and boundary edge case helpers**

### 1.3. CoordinateTransformer Service
- [x] **1.3.1 [RED] Write unit tests for CoordinateTransformer**
  - Path: `tests/unit/domain/boardview/CoordinateTransformer.spec.ts`
  - Scenarios:
    - Test `flipHorizontal(coord, boardWidth)` for $X=15.25\text{ mm}$, $W=60.0\text{ mm} \rightarrow X'=44.75\text{ mm}$, $Y$ unchanged.
    - Test idempotent behavior when already flipped.
    - Test `translate(coord, dx, dy)` with positive/negative deltas.
    - Test `stackTransform(coord, layerSpacingZ)` 3D exploded displacement calculation.
- [x] **1.3.2 [GREEN] Implement CoordinateTransformer**
  - Path: `src/domain/boardview/services/CoordinateTransformer.ts`
- [x] **1.3.3 [REFACTOR] Optimize coordinate math and document coordinate space frame of reference**

---

## Phase 2: Domain Aggregates & Entities (TDD Cycle)

### 2.1. CompositeBoard Aggregate & Catalog Entities
- [x] **2.1.1 [RED] Write unit tests for CompositeBoard aggregate & SubBoard entity**
  - Path: `tests/unit/domain/catalog/CompositeBoard.spec.ts`
  - Scenarios:
    - Instantiate iPhone 13 composite board `820-02106` with 3 sub-boards (`TOP_LOGIC`, `INTERPOSER_FRAME`, `BOTTOM_RF`).
    - Enforce invariant: `SANDWICH_INTERPOSER` requires $\ge 2$ sub-boards.
    - Enforce invariant: Reject duplicate `SubBoardId` throwing `DuplicateSubBoardIdException`.
    - Query sub-board by role and id.
- [x] **2.1.2 [GREEN] Implement CompositeBoard aggregate, SubBoard entity, and exceptions**
  - Path: `src/domain/catalog/entities/CompositeBoard.ts`
  - Path: `src/domain/catalog/entities/SubBoardEntity.ts`
  - Path: `src/domain/catalog/exceptions/DuplicateSubBoardIdException.ts`
  - Path: `src/domain/catalog/repositories/ICompositeBoardRepository.ts`
- [x] **2.1.3 [REFACTOR] Encapsulate child collection mutability with readonly getters**

### 2.2. BoardView Entities & NetTopology Aggregate
- [x] **2.2.1 [RED] Write unit tests for PadEntity, ComponentEntity, and NetTopology**
  - Path: `tests/unit/domain/boardview/NetTopology.spec.ts`
  - Scenarios:
    - Create `PadEntity` and `ComponentEntity` on sub-boards.
    - Build `NetTopology` with local pins on Top AP board and Bottom RF board linked via `InterposerJunction` `PAD_84`.
    - Bidirectional resolution: Given Top Pin `U2700.A12`, resolve canonical net `PP_VDD_MAIN` and linked Bottom pin `U_BB_PMU.C4`.
    - Resolve connected pins from interposer pad `INT_PAD_084`.
- [x] **2.2.2 [GREEN] Implement PadEntity, ComponentEntity, NetTopology, and BidirectionalNetResolver**
  - Path: `src/domain/boardview/entities/PadEntity.ts`
  - Path: `src/domain/boardview/entities/ComponentEntity.ts`
  - Path: `src/domain/boardview/entities/NetTopology.ts`
  - Path: `src/domain/boardview/services/BidirectionalNetResolver.ts`
  - Path: `src/domain/boardview/repositories/INetTopologyRepository.ts`
- [x] **2.2.3 [REFACTOR] Index net lookup tables for $O(1)$ pin-to-junction resolution**

### 2.3. MeasurementProfile Aggregate & Measurement Entities
- [x] **2.3.1 [RED] Write unit tests for MeasurementProfile aggregate**
  - Path: `tests/unit/domain/measurements/MeasurementProfile.spec.ts`
  - Scenarios:
    - Create `MeasurementProfile` for `BRD_820_02106` with `FLUKE_115_STANDARD` baseline.
    - Register multi-state reference readings (`SPLIT_TOP`, `SPLIT_BOTTOM`, `JOINED_SANDWICH`, `SOCKET_FIXTURE`) on interposer pads.
    - Query reference by `(PadId, DiagnosticBoardState)`.
- [x] **2.3.2 [GREEN] Implement MeasurementProfile and MeasurementReference**
  - Path: `src/domain/measurements/entities/MeasurementProfile.ts`
  - Path: `src/domain/measurements/entities/MeasurementReference.ts`
  - Path: `src/domain/measurements/repositories/IMeasurementRepository.ts`
- [x] **2.3.3 [REFACTOR] Optimize compound key lookups `(padId, boardState)`**

---

## Phase 3: Domain Services & State Machines (TDD Cycle)

### 3.1. DiodeModeEvaluator Service
- [x] **3.1.1 [RED] Write comprehensive unit tests for DiodeModeEvaluator**
  - Path: `tests/unit/domain/measurements/DiodeModeEvaluator.spec.ts`
  - Scenarios:
    - Normal reading: $0.418\text{V}$ on $0.425\text{V} \pm 7\%$ $\rightarrow$ `PASS` (deviation $-1.65\%$).
    - Short circuit detection: $0.012\text{V}$ on nominal $0.425\text{V}$ $\rightarrow$ `CRITICAL_LOW_OR_SHORT`.
    - Open line detection: `OL` / $2.999\text{V}$ on active rail $\rightarrow$ `OPEN_LINE_OL`.
    - Multimeter calibration: Normalize Sunshine DT17N reading ($0.380\text{V} + 0.035\text{V} = 0.415\text{V}$) $\rightarrow$ `PASS`.
    - Warning threshold: deviation between $1.0\times$ and $1.5\times$ of tolerance $\rightarrow$ `WARNING_DEVIATION`.
- [x] **3.1.2 [GREEN] Implement DiodeModeEvaluator service**
  - Path: `src/domain/measurements/services/DiodeModeEvaluator.ts`
- [x] **3.1.3 [REFACTOR] Extract tolerance calculation strategies and alert message generation**

### 3.2. PowerTree Entity & BootSequenceStateMachine
- [x] **3.2.1 [RED] Write unit tests for PowerTree and BootSequenceStateMachine**
  - Path: `tests/unit/domain/schematics/PowerTree.spec.ts`
  - Path: `tests/unit/domain/schematics/BootSequenceStateMachine.spec.ts`
  - Scenarios:
    - Build iPhone 13 power tree (`PP_BATT_VCC` $\rightarrow$ `PP_VDD_MAIN` $\rightarrow$ `PP_VDD_BOOST`, `PP1V8_S2`, `PP_VDD_CPU_CORE`).
    - Verify power dependency validation: child rail invalid if parent rail faulted.
    - Test legal forward boot sequence: `S5_OFF` $\rightarrow$ `S4_STANDBY` $\rightarrow$ `S3_TRIGGER` $\rightarrow$ `S0_FULL_EXECUTION`.
    - Test sleep transitions: `S0_FULL_EXECUTION` $\leftrightarrow$ `S2_SLEEP`.
    - Test fault recovery / cut: Any state $\rightarrow$ `S5_OFF`.
    - Test illegal transition rejection: `S5_OFF` $\rightarrow$ `S0_FULL_EXECUTION` throwing `IllegalStateTransitionException`.
- [x] **3.2.2 [GREEN] Implement PowerTree, PowerRailNode, BootSequenceStateMachine, and Exceptions**
  - Path: `src/domain/schematics/entities/PowerTree.ts`
  - Path: `src/domain/schematics/entities/PowerRailNode.ts`
  - Path: `src/domain/schematics/services/BootSequenceStateMachine.ts`
  - Path: `src/domain/schematics/exceptions/IllegalStateTransitionException.ts`
- [x] **3.2.3 [REFACTOR] Align PMU state machine events and transition table representation**

---

## Phase 4: Application DTOs & Use Cases (TDD Cycle)

### 4.1. Catalog & BoardView Query Handlers
- [x] **4.1.1 [RED] Write integration tests for CompositeBoard and Net Resolution use cases**
  - Path: `tests/integration/application/GetCompositeBoardHandler.spec.ts`
  - Path: `tests/integration/application/ResolveNetCrossJunctionHandler.spec.ts`
  - Scenarios:
    - Query `GetCompositeBoardHandler` by `BoardId` and return fully structured `CompositeBoardDto`.
    - Query `ResolveNetCrossJunctionHandler` by pin/pad reference and return `NetResolutionDto` with cross-layer trace path.
- [x] **4.1.2 [GREEN] Implement Application DTOs and Query Handlers**
  - Path: `src/application/catalog/dtos/CompositeBoardDto.ts`
  - Path: `src/application/catalog/queries/GetCompositeBoardHandler.ts`
  - Path: `src/application/boardview/dtos/NetResolutionDto.ts`
  - Path: `src/application/boardview/queries/ResolveNetCrossJunctionHandler.ts`
- [x] **4.1.3 [REFACTOR] Add mapper profiles between domain models and DTO contracts**

### 4.2. Diagnostic Measurement & Boot Sequence Use Cases
- [x] **4.2.1 [RED] Write integration tests for Diode Evaluation and Boot Sequence simulation use cases**
  - Path: `tests/integration/application/EvaluateDiodeMeasurementHandler.spec.ts`
  - Path: `tests/integration/application/SimulateBootSequenceHandler.spec.ts`
  - Scenarios:
    - Execute `EvaluateDiodeMeasurementHandler` command and return `DiodeEvaluationResultDto`.
    - Execute `SimulateBootSequenceHandler` command and return step-by-step `BootSequenceResultDto`.
- [x] **4.2.2 [GREEN] Implement Measurement & Boot Sequence Handlers and DTOs**
  - Path: `src/application/measurements/dtos/DiodeEvaluationResultDto.ts`
  - Path: `src/application/measurements/commands/EvaluateDiodeMeasurementHandler.ts`
  - Path: `src/application/schematics/dtos/BootSequenceResultDto.ts`
  - Path: `src/application/schematics/commands/SimulateBootSequenceHandler.ts`
- [x] **4.2.3 [REFACTOR] Standardize error handling and application command validation**

---

## Phase 5: Verification & Contract Tests against iPhone 13 Logic Board Fixture

### 5.1. Seed Data & In-Memory Test Repositories
- [x] **5.1.1 Create iPhone 13 (820-02106) Canonical Fixture & Seed Data**
  - Path: `src/infrastructure/seeds/iPhone13_820_02106_Seed.ts`
  - Content:
    - Top AP Sub-board dimensions ($60.0\text{ mm} \times 120.0\text{ mm}$, 10 layers), components (A15 SoC `U0100`, Main PMIC `U2700`, NAND `U2600`).
    - Bottom RF Sub-board (8 layers), components (Qualcomm X60 `U_BB`, PMX60 `U_BB_PMU`, SDR735).
    - Interposer Frame with complete ring pad array (including `INT_PAD_084` `PP_VDD_MAIN`, `INT_PAD_042` `I2C0_SDA`, `INT_PAD_112` `PP1V8_S2`).
    - Reference measurements across all 4 diagnostic states (`SPLIT_TOP`, `SPLIT_BOTTOM`, `JOINED_SANDWICH`, `SOCKET_FIXTURE`).
- [x] **5.1.2 Implement In-Memory / Postgres Repository Adapters**
  - Path: `src/infrastructure/persistence/in-memory/InMemoryCompositeBoardRepository.ts`
  - Path: `src/infrastructure/persistence/in-memory/InMemoryNetTopologyRepository.ts`
  - Path: `src/infrastructure/persistence/in-memory/InMemoryMeasurementRepository.ts`

### 5.2. End-to-End Contract & Verification Test Suite
- [x] **5.2.1 [TEST] Comprehensive iPhone 13 Sandwich Logic Board Verification Suite**
  - Path: `tests/e2e/iPhone13LogicBoardCore.spec.ts`
  - Scenarios:
    - End-to-end composite board retrieval with verified layer structure.
    - Full interposer cross-probe resolution between AP SoC and Baseband PMU.
    - Multi-meter calibrated diode evaluation against iPhone 13 golden reference table.
    - Full PMU cold boot cycle simulation from battery ingestion to `S0_FULL_EXECUTION`.
- [x] **5.2.2 [VERIFY] Run full test suite and confirm 100% pass rate**
  - Verify all unit, integration, and E2E contract tests execute cleanly with zero warnings.
