# Tasks: Schematic Ingestion Engine

Task breakdown for the `schematic-ingestion-engine` change following Strict TDD (Red-Green-Refactor).

## Phase 1: Domain & Foundation
- [x] 1.1 `[TDD-RED]` Create unit tests for domain entities and aggregates (`SchematicDocument`, `SchematicSheet`, `SchematicSymbol`, `SchematicPinLocation`, `SchematicNet`) testing multi-sheet validation and duplicate RefDes aggregation in [`tests/unit/domain/schematics/SchematicDocument.spec.ts`](file:///c:/Users/LAB-JOSE/Desktop/BoardForge/tests/unit/domain/schematics/SchematicDocument.spec.ts).
- [x] 1.2 `[TDD-GREEN]` Implement pure domain entities and aggregate root in [`src/domain/schematics/entities/SchematicSymbol.ts`](file:///c:/Users/LAB-JOSE/Desktop/BoardForge/src/domain/schematics/entities/SchematicSymbol.ts), [`src/domain/schematics/entities/SchematicSheet.ts`](file:///c:/Users/LAB-JOSE/Desktop/BoardForge/src/domain/schematics/entities/SchematicSheet.ts), and [`src/domain/schematics/aggregates/SchematicDocument.ts`](file:///c:/Users/LAB-JOSE/Desktop/BoardForge/src/domain/schematics/aggregates/SchematicDocument.ts).
- [x] 1.3 Define domain port interfaces for parsing and cross-probe indexing in [`src/domain/schematics/ports/ISchematicParser.ts`](file:///c:/Users/LAB-JOSE/Desktop/BoardForge/src/domain/schematics/ports/ISchematicParser.ts) and [`src/domain/schematics/ports/ISchematicCrossProbeIndex.ts`](file:///c:/Users/LAB-JOSE/Desktop/BoardForge/src/domain/schematics/ports/ISchematicCrossProbeIndex.ts).

## Phase 2: Infrastructure Parser & Worker
- [x] 2.1 `[TDD-RED]` Write unit tests in [`tests/unit/infrastructure/schematics/VectorPdfSchematicParser.spec.ts`](file:///c:/Users/LAB-JOSE/Desktop/BoardForge/tests/unit/infrastructure/schematics/VectorPdfSchematicParser.spec.ts) covering `%PDF-` magic header sniffing, token extraction, `UnsupportedFormatError`, and `CorruptedStreamError`.
- [x] 2.2 `[TDD-GREEN]` Implement `VectorPdfSchematicParser` and `SchematicParserFactory` in [`src/infrastructure/schematics/parsers/VectorPdfSchematicParser.ts`](file:///c:/Users/LAB-JOSE/Desktop/BoardForge/src/infrastructure/schematics/parsers/VectorPdfSchematicParser.ts) and [`src/infrastructure/schematics/parsers/SchematicParserFactory.ts`](file:///c:/Users/LAB-JOSE/Desktop/BoardForge/src/infrastructure/schematics/parsers/SchematicParserFactory.ts).
- [x] 2.3 `[TDD-REFACTOR]` Add resilient parsing support for partial sheet corruptions emitting `ParseDiagnostic` warnings in `VectorPdfSchematicParser`.

## Phase 3: Application & Cross-Probing Integration
- [x] 3.1 `[TDD-RED]` Write unit and latency benchmark tests for `SchematicCrossProbeIndex` (< 1ms query budget) in [`tests/unit/application/schematics/SchematicCrossProbeIndex.spec.ts`](file:///c:/Users/LAB-JOSE/Desktop/BoardForge/tests/unit/application/schematics/SchematicCrossProbeIndex.spec.ts).
- [x] 3.2 `[TDD-GREEN]` Implement in-memory bidirectional spatial index in [`src/application/schematics/services/SchematicCrossProbeIndex.ts`](file:///c:/Users/LAB-JOSE/Desktop/BoardForge/src/application/schematics/services/SchematicCrossProbeIndex.ts).
- [x] 3.3 `[TDD-RED]` Write unit tests for ingestion command and query handlers in [`tests/unit/application/schematics/IngestSchematicUseCase.spec.ts`](file:///c:/Users/LAB-JOSE/Desktop/BoardForge/tests/unit/application/schematics/IngestSchematicUseCase.spec.ts).
- [x] 3.4 `[TDD-GREEN]` Implement `IngestSchematicUseCase`, `CrossProbeLookupUseCase`, and expose via [`src/application/schematics/SchematicsFacade.ts`](file:///c:/Users/LAB-JOSE/Desktop/BoardForge/src/application/schematics/SchematicsFacade.ts).

## Phase 4: UI Wiring & End-to-End Verification
- [x] 4.1 `[TDD-RED]` Write component and event bus integration tests in [`tests/integration/schematics/SchematicSyncIntegration.spec.ts`](file:///c:/Users/LAB-JOSE/Desktop/BoardForge/tests/integration/schematics/SchematicSyncIntegration.spec.ts).
- [x] 4.2 `[TDD-GREEN]` Connect [`src/ui/schematics/SchematicPanel.tsx`](file:///c:/Users/LAB-JOSE/Desktop/BoardForge/src/ui/schematics/SchematicPanel.tsx) to `SchematicsFacade` and [`WorkbenchEventBus`](file:///c:/Users/LAB-JOSE/Desktop/BoardForge/src/application/workbench/WorkbenchEventBus.ts) for bi-directional boardview sync.
- [x] 4.3 Run full Vitest regression suite and verify end-to-end ingestion and cross-probe latency constraints.
