# Proposal: Schematic Ingestion Engine

## Intent
Enable ingestion of real vector schematic files (Vector PDF, CAD, netlist) with isolated worker parsing, domain aggregate assembly, and bidirectional cross-probe indexing with BoardView layouts in BoardForge.

## Scope

### In Scope
- Domain aggregate model: `SchematicDocument`, `SchematicSheet`, `SchematicSymbol`, `SchematicNet`.
- Isolated parser pipeline (Web Worker / worker thread) for vector PDF and CAD schematic inputs.
- Token and geometry extraction with spatial indexing for symbols, pins, and nets.
- Cross-probe index builder linking schematic tokens to BoardView net/part records.
- Strict TDD unit & integration tests (`pnpm test`) and strict TypeScript type validation.

### Out of Scope
- Full hardware SPICE simulation and circuit emulation.
- Automated PCB autorouting or ECAD layout generation.
- OCR / raster-image text recognition for scanned bitmap schematics.

## Approach
1. **Domain Model**: Define pure entities and aggregates (`SchematicDocument`, `SchematicSheet`, `SchematicSymbol`, `SchematicNet`) and parser ports (`ISchematicParser`).
2. **Worker Parsing Pipeline**: Implement format sniffers and vector token extractors inside isolated worker contexts to prevent UI thread blocking.
3. **Cross-Probe Indexing**: Construct bidirectional spatial and token lookup indexes mapping schematic components/nets to BoardView elements.
4. **Strict TDD**: Drive implementation via red-green-refactor cycles with synthetic and golden test fixtures.

## Affected Areas
- `src/domain/schematics/`: Entities, value objects, ports, and domain aggregates.
- `src/infrastructure/schematics/`: Worker parser implementations, format sniffers, token extractors.
- `src/application/schematics/`: Ingestion facade, cross-probe coordinate mapper, and indexing services.
- `src/ui/workbench/`: Canvas cross-probe synchronization bindings.

## Risks & Mitigations
- **Large vector schematic parsing overhead**: Mitigated by offloading parsing and indexing to Web Workers.
- **Net naming mismatches between CAD and BoardView**: Mitigated by fuzzy/canonical net name normalization in the indexer.
- **Complex multi-sheet document hierarchy**: Mitigated by explicit `SchematicSheet` hierarchical aggregate structure.

## Rollback Plan
Purely additive domain models, infrastructure parsers, and indexing services. If regressions occur, revert schematic ingestion modules and fall back to existing fixture loaders without altering BoardView core logic.

## Dependencies
- Vector parsing libraries (`pdfjs-dist` or lightweight vector stream extractors).
- Existing BoardView domain aggregates and cross-probe interfaces.

## Success Criteria
- [ ] 100% passing Vitest suite (`pnpm test`) covering domain aggregates, parsers, and indexing.
- [ ] Strict TypeScript compilation with zero type errors (`pnpm typecheck` or `tsc --noEmit`).
- [ ] Vector schematic ingestion completes and indexes symbols/nets for cross-probing.
