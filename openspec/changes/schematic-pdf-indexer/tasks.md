# Implementation Tasks: `schematic-pdf-indexer`

**Change ID:** `schematic-pdf-indexer`  
**Standard:** Strict Test-Driven Development (TDD: Red $\rightarrow$ Green $\rightarrow$ Refactor)  

---

## Task Matrix & Phasing

### Phase 1: Spatial Geometry & Value Objects (TDD)
- [x] **Task 1.1: `BoundingBox2D` Value Object**
  - Create unit tests `tests/unit/domain/schematics/BoundingBox2D.spec.ts` testing bounds invariants, `containsPoint`, `intersects`, `union`, `expand`, area, center.
  - Implement `src/domain/schematics/value-objects/BoundingBox2D.ts`.
- [x] **Task 1.2: `SchematicCoordinate` & `VectorToken` Value Objects**
  - Create unit tests `tests/unit/domain/schematics/VectorToken.spec.ts`.
  - Implement `SchematicCoordinate.ts`, `VectorToken.ts`, `SymbolPinRef.ts`, `NetLabelMatch.ts`.

---

### Phase 2: Spatial Indexing & R-Tree Engine (TDD)
- [x] **Task 2.1: `SchematicSpatialIndex` 2D Spatial Engine**
  - Create unit tests `tests/unit/domain/schematics/SchematicSpatialIndex.spec.ts` for insertion, point query $O(\log N)$, range/box query, and nearest neighbor search.
  - Implement `src/domain/schematics/services/SchematicSpatialIndex.ts`.
- [x] **Task 2.2: `SchematicPage` Entity & Spatial Integration**
  - Create unit tests `tests/unit/domain/schematics/SchematicPage.spec.ts`.
  - Implement `src/domain/schematics/entities/SchematicPage.ts` integrating `SchematicSpatialIndex`.

---

### Phase 3: Symbol Extraction & Multi-Page IC Aggregation (TDD)
- [x] **Task 3.1: `SchematicPinLocation` & `SchematicSymbol` Entities**
  - Create unit tests `tests/unit/domain/schematics/SchematicSymbol.spec.ts`.
  - Implement `SchematicPinLocation.ts` and `SchematicSymbol.ts`.
- [x] **Task 3.2: `MultiPageSymbolAggregate` & `SchematicDocument` Aggregates**
  - Create unit tests `tests/unit/domain/schematics/MultiPageSymbolAggregate.spec.ts` and `SchematicDocument.spec.ts`.
  - Implement `MultiPageSymbolAggregate.ts` and `SchematicDocument.ts`.
- [x] **Task 3.3: `SymbolExtractorService` Regex & Spatial Association Engine**
  - Create unit tests `tests/unit/domain/schematics/SymbolExtractorService.spec.ts` for IC designators (`U2700`, `U_BB_PMU`, `PMU_A15`), pin numbers (BGA grid `A12`, lead `144`), and net labels (`PP_VDD_MAIN`, `BUTTON_TO_PMU_ONOFF_L`).
  - Implement `src/domain/schematics/services/SymbolExtractorService.ts`.

---

### Phase 4: Bidirectional Cross-Probing Engine (TDD)
- [x] **Task 4.1: `SchematicCrossProbeIndex` Domain Service**
  - Create unit tests `tests/unit/domain/schematics/SchematicCrossProbeIndex.spec.ts`.
  - Test BoardView pad $\rightarrow$ Schematic symbols/pins/pages resolution.
  - Test Schematic point/box/pin $\rightarrow$ BoardView pads, sub-boards, and Interposer junctions resolution.
  - Implement `src/domain/schematics/services/SchematicCrossProbeIndex.ts`.

---

### Phase 5: iPhone 13 Schematic Fixtures & Integration Testing
- [x] **Task 5.1: Apple iPhone 13 Multi-Page Schematic Fixtures**
  - Implement `src/infrastructure/seeds/iPhone13SchematicFixtures.ts` (Pages 12, 13, 25, 48, 84).
  - Create integration test `tests/integration/iPhone13SchematicCrossProbe.spec.ts` verifying end-to-end cross-probing between iPhone 13 BoardView (`820-02106`) and multi-page schematics.
