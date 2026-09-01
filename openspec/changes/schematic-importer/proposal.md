# Proposal: Schematic Import Pipeline

## Intent

Schematics are 100% hardcoded TypeScript fixtures (`iPhone13SchematicFixtures`) — no parser, no catalog, no way to load real files. The user needs a repeatable, testable pipeline that imports vector-PDF schematics from user-designated folders, parses them into domain `SchematicDocument` aggregates, catalogs them by board model, and auto-loads the correct schematic when a board opens. This closes the gap left by the archived `schematic-pdf-indexer` change which defined the domain model but never implemented `ISchematicParser`.

## Scope

### In Scope
- Domain port `ISchematicParser` + intermediate raw schematic type (closes existing spec entity gap)
- PDF vector-text parser (`pdfjs-dist`) extracting tokens with bounds per page
- Format sniffer/factory (mirrors `BoardViewParserFactory.detectParser` pattern)
- `SchematicDocument` assembler (raw tokens → domain aggregate, validates per spec R2.10)
- CLI importer script (`tsx scripts/import-schematics.ts`): recursive folder scan, sniff, parse, emit `SchematicDocumentBundle` JSON + manifest
- Manifest-driven catalog service: `boardModel → bundle` mapping, hydrator to `SchematicDocument`
- Shell/pairing refactor: replace hardcoded fixtures with catalog-driven lookup
- Synthetic validation fixture: generated vector PDF + expected `SchematicDocument` JSON
- Re-scan support: CLI re-runs update the manifest incrementally

### Out of Scope
- Fastify upload route (exploration Option D) — deferred
- In-browser runtime discovery / folder picker (exploration Option B) — deferred
- Image-only PDF rendering (requires page-image UI, separate change)
- Proprietary/encrypted format support
- Any scraping or copyright-infringing content acquisition

## Capabilities

### New Capabilities
- `schematic-import`: parser infrastructure (port, factory/sniffer, PDF parser, raw→domain assembler), CLI importer, bundle schema, manifest catalog

### Modified Capabilities
- `schematics`: new requirement for `ISchematicParser` port — closing the existing spec entity gap; catalog-driven document resolution replacing hardcoded fixture injection

## Approach

Phased per exploration recommendation: **C first** (manifest schema + pure catalog loader + catalog-driven pairing in shell), **then A** (CLI importer: folder scan → sniff → parse → validate → emit bundles). Mirrors the proven BoardView ingestion pattern: port → factory/sniffer → parsers → transformer → repos. Strict TDD throughout.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/domain/schematics/ports/` (new) | New | `ISchematicParser` port + raw schematic type |
| `src/infrastructure/schematics/` (new) | New | PDF parser, sniffer/factory, assembler |
| `src/application/schematics/SchematicsFacade.ts` | Modified | Real `uploadSchematic`, catalog registry query |
| `src/application/workbench/WorkbenchFacade.ts` | Modified | Catalog-driven `resolveCompanion` replacing `companionFixtures` |
| `src/ui/workbench/BoardForgeShell.tsx` | Modified | Replace fixture memo with catalog lookup |
| `scripts/` (new) | New | `import-schematics.ts` CLI tool |
| `src/infrastructure/seeds/` | Modified | Migrate fixtures to JSON bundle or keep as golden test reference |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| `pdfjs-dist` adds bundle/test surface | Med | Isolated in infrastructure; lazy-load; exclude from Vite bundle if CLI-only |
| Real PDFs are image-only (no text tokens) | High | Scope explicitly limits to vector-text; image-only deferred to separate change |
| Net name mismatch → empty cross-probe | Med | Catalog entry records parser confidence; graceful NO_COMPANION fallback |
| Shell refactor touches rendering path | Med | Slice into chained PRs; fixture kept as golden test baseline |
| 400-line PR budget exceeded | Med | Multi-PR chain: PR1=catalog+loader, PR2=parser+assembler, PR3=CLI, PR4=shell wiring |

## Rollback Plan

Additive-only: new domain port, new infrastructure modules, new CLI script. Catalog loader is additive to shell. Revert by disabling catalog lookup and restoring fixture injection (git revert). No schema migrations, no data loss.

## Dependencies

- `pdfjs-dist` (new — PDF text+geometry extraction)
- `tsx` (already a devDep — CLI script runner)
- Existing `SchematicCrossProbeIndex`, `SymbolExtractorService`, `BoundingBox2D` domain entities
- Existing BoardView parser/factory pattern as architectural reference

## Success Criteria

- [ ] `pnpm test` passes with new parser, catalog, and assembler tests (strict TDD red-green)
- [ ] CLI imports a vector-PDF schematic → emits valid `SchematicDocumentBundle` JSON + manifest
- [ ] Synthetic fixture PDF round-trips: import → manifest → workbench renders tokens with correct bounds
- [ ] Open board → correct schematic auto-loads from catalog (not hardcoded fixture)
- [ ] Re-scan updates manifest without duplicating entries
- [ ] All existing domain/facade/workbench tests pass unchanged

## Proposal question round

1. **PDF scope**: Should the first slice also handle multi-document PDFs (multiple schematics in one file, separated by bookmarks/TOC), or single-document-per-file only?
2. **Catalog persistence**: Manifest as a JSON file in `public/` or `src/infrastructure/`? Or in-memory only (regenerated on CLI re-run)? Impacts whether the workbench survives reload without re-running the CLI.
3. **Board model keying**: The manifest maps `boardModel` → bundle. For boards with multiple revisions (e.g., iPhone 13 different board numbers), should the key be `boardModel + boardRevision` or just `boardModel` with "latest wins"?
4. **Fixture migration**: Should `iPhone13SchematicFixtures.ts` be converted to a JSON bundle loaded via the new catalog (single source of truth), or kept as-is alongside the catalog (fixture = golden test, catalog = production path)?
5. **Error reporting**: When the CLI encounters a PDF that fails parsing, should it (a) skip with a warning and continue, (b) fail the batch, or (c) produce a partial bundle with error metadata?
