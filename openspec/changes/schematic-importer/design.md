# Design: Schematic Import Pipeline

## Technical Approach

Mirror the proven BoardView ingestion pattern: `port → sniffer/factory → parser(s) → assembler → repos`. A domain port `ISchematicParser` decouples the parser contract from `pdfjs-dist`. A CLI script scans folders at build-time, sniffs PDFs, parses vector text tokens via `pdfjs-dist`, assembles them into `SchematicDocument` domain aggregates, serializes as JSON bundles, and writes a manifest. The workbench fetches JSON bundles at runtime — `pdfjs-dist` is never imported client-side. `iPhone13SchematicFixtures` stays golden for tests; catalog is the production path.

## Architecture Decisions

| Decision | Options | Tradeoff | Choice |
|----------|---------|----------|--------|
| Bundle location | `public/schematics/` vs in-memory regeneration | `public/` survives reload, no CLI re-run; in-memory regen loses state on refresh | `public/schematics/` |
| pdfjs loading | Client bundle vs CLI-only | Client bundle adds ~300KB; CLI-only keeps workbench zero-cost | CLI-only (lazy import) |
| Domain port location | `src/domain/schematics/ports/` vs inline in infra | Port in domain preserves dependency rule; infra inline breaks it | `src/domain/schematics/ports/` |
| Token type classification | Heuristic (font size/regex) vs none | Heuristic improves cross-probe; none is simpler but loses signal | Heuristic — uppercase refdes vs net names |
| Manifest merge strategy | Hash-based idempotence vs timestamp-only | Hash avoids re-emitting unchanged bundles; timestamp-only re-emits everything | SHA-256 hash per bundle |
| Fixture migration | Keep as golden + catalog = production | Converting fixture to JSON bundle loses compile-time test control | Keep both — separate paths |

## Data Flow

```
CLI Script (tsx)
  │
  ├─► SchematicFormatSniffer.sniff(buffer) → Format result
  │
  ├─► SchematicParserFactory.create(format) → ISchematicParser
  │
  ├─► PdfSchematicParser.parse(rawBytes) → RawSchematicTokenSet
  │      └─ pdfjs-dist: page.getTextContent() → items with transform matrix
  │
  ├─► SchematicAssembler.assemble(raw) → SchematicDocument
  │      └─ Validates R2.10 (≤500 pages, ≤50MB), builds SpatialIndex
  │
  ├─► serializeToBundle(doc) → SchematicDocumentBundle JSON
  │
  └─► ManifestMerge.merge(existing, entry) → updated manifest.json

Workbench (runtime)
  │
  ├─► fetch('/schematics/manifest.json') → manifest
  ├─► fetch(`/schematics/${entry.file}`) → bundle JSON
  ├─► HydrateBundle.hydrate(json) → SchematicDocument
  │      └─ Reconstructs VectorToken, BoundingBox2D, SchematicPage, SpatialIndex
  └─► SchematicCrossProbeIndex.registerSchematicDocument(doc)
```

## Concrete Schemas

### SchematicDocumentBundle (JSON)

```json
{
  "documentId": "SCH_iphone13_top_abc123",
  "title": "iPhone 13 Top Schematic",
  "pageCount": 3,
  "sourceFilename": "iphone13_top.pdf",
  "importedAt": "2026-09-01T12:00:00Z",
  "pages": [
    {
      "pageNumber": 1,
      "width": 1000,
      "height": 800,
      "tokens": [
        {
          "text": "PP_VDD_MAIN",
          "bounds": { "minX": 120, "minY": 200, "maxX": 175, "maxY": 215 },
          "fontSize": 8,
          "fontFamily": "Helvetica",
          "rotation": 0,
          "tokenType": "NET_LABEL"
        }
      ],
      "netLabels": [
        { "netName": "PP_VDD_MAIN", "pageNumber": 1, "bounds": { "minX": 120, "minY": 200, "maxX": 175, "maxY": 215 } }
      ],
      "symbols": []
    }
  ]
}
```

### manifest.json

```json
{
  "version": 1,
  "entries": [
    {
      "boardModel": "iPhone13",
      "boardRevision": "820-02106",
      "file": "schematic_iphone13_820-02106.json",
      "hash": "sha256:abc123...",
      "sourceFilename": "iphone13_top.pdf",
      "importedAt": "2026-09-01T12:00:00Z",
      "parserConfidence": "EXACT_MAGIC",
      "tokenCount": 1542,
      "pageCount": 120
    }
  ]
}
```

### Serialization mapping (domain → JSON)

| Domain type | JSON representation |
|-------------|-------------------|
| `BoundingBox2D` | `{ minX, minY, maxX, maxY }` — plain object, reconstructed via `new BoundingBox2D(...)` |
| `VectorToken` | `{ text, bounds: {...}, fontSize, fontFamily?, rotation, tokenType }` — reconstructed via `new VectorToken({ ...bounds_from_json })` |
| `NetLabelMatch` | `{ netName, pageNumber, bounds: {...}, rotation }` — reconstructed via `new NetLabelMatch(...)` |
| `SchematicPage` | Flat `{ pageNumber, width, height, tokens[], netLabels[], symbols[] }` — reconstructed via `new SchematicPage(...)` then `addToken/addNetLabel/addSymbol` |
| `SchematicDocument` | Top-level bundle object — reconstructed via `new SchematicDocument(...)` then `addPage/registerSymbol` |

No class instances are serialized — all fields are plain JSON. Hydration reconstructs domain objects from plain data.

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/domain/schematics/ports/ISchematicParser.ts` | Create | Domain port: `parse(rawBytes, meta?) → SchematicDocument \| ParseError` |
| `src/domain/schematics/intermediate/RawSchematicTokenSet.ts` | Create | Raw intermediate type (mirrors `RawBoardViewDocument` pattern) |
| `src/domain/schematics/services/SchematicFormatSniffer.ts` | Create | Sniffs `%PDF-` magic in leading 1024 bytes |
| `src/infrastructure/schematics/parsers/PdfSchematicParser.ts` | Create | `pdfjs-dist` lazy import, extracts tokens via `page.getTextContent()` |
| `src/infrastructure/schematics/parsers/SchematicParserFactory.ts` | Create | Mirrors `BoardViewParserFactory` — `create(format) → ISchematicParser` |
| `src/infrastructure/schematics/assemblers/SchematicAssembler.ts` | Create | Raw tokens → `SchematicDocument` with validation (R2.10 limits) |
| `src/infrastructure/schematics/catalog/SchematicCatalogService.ts` | Create | Manifest fetch, boardModel+revision lookup, bundle hydration |
| `src/infrastructure/schematics/catalog/SchematicBundleSerializer.ts` | Create | `SchematicDocument` → JSON bundle serialization |
| `src/infrastructure/schematics/catalog/HydrateBundle.ts` | Create | JSON bundle → `SchematicDocument` reconstruction |
| `scripts/import-schematics.ts` | Create | CLI: scan folder, sniff, parse, emit bundles + manifest |
| `src/application/schematics/SchematicsFacade.ts` | Modify | Add `resolveFromCatalog(model, revision)` using `SchematicCatalogService` |
| `src/application/workbench/WorkbenchFacade.ts` | Modify | `resolveCompanion` queries catalog; remove `companionFixtures` constant |
| `src/ui/workbench/BoardForgeShell.tsx` | Modify | Replace `iPhone13SchematicFixtures` memo with catalog-driven lookup |

## Interfaces / Contracts

```typescript
// src/domain/schematics/ports/ISchematicParser.ts
export interface ParseSchematicMeta {
  sourceFilename?: string;
  boardModel?: string;
  boardRevision?: string;
}

export interface ParseSchematicResult {
  document: SchematicDocument;
  diagnostics: ParseDiagnostic[];
}

export interface ISchematicParser {
  parse(rawBytes: Uint8Array, meta?: ParseSchematicMeta): Promise<ParseSchematicResult>;
}

// src/domain/schematics/intermediate/RawSchematicTokenSet.ts
export interface RawSchematicTokenSet {
  format: string;
  sourceFilename?: string;
  pages: RawSchematicPage[];
  diagnostics: ParseDiagnostic[];
}

export interface RawSchematicPage {
  pageNumber: number;
  width: number;
  height: number;
  tokens: { text: string; x: number; y: number; width: number; height: number; fontSize: number; fontFamily?: string; rotation?: number }[];
}
```

**Net-label heuristic**: Tokens where `text === text.toUpperCase()` and text length ≥ 3 AND text matches `^[A-Z0-9_]+$` are classified `NET_LABEL`. Tokens matching `^[A-Z][A-Z0-9]+[0-9]+$` (e.g., `R2700`) are `DESIGNATOR`. Tokens matching `^[A-Z][0-9]+[A-Z]*$` (e.g., `A12`) are `PIN_NUM`. Everything else is `TEXT`.

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | Sniffer returns `VECTOR_PDF` for `%PDF-` magic, `UNKNOWN` for garbage | Direct function call, assert format + confidence |
| Unit | Parser extracts tokens with bounds from minimal PDF | Synthetic single-page PDF fixture, assert token count + bounds |
| Unit | Assembler rejects >500 pages (R2.10) | Mock 601-page raw set, assert `PAGE_LIMIT_EXCEEDED` |
| Unit | Assembler builds SpatialIndex correctly | Assert `page.queryPoint(x,y)` returns expected tokens |
| Unit | Manifest merge is idempotent (hash compare) | Write manifest, re-run merge with same hash, assert no change |
| Unit | Manifest merge adds new entry only | Write manifest, merge with one new + one existing, assert 2 entries |
| Unit | Hydration round-trip: serialize → deserialize → assert fields equal | Build doc, serialize, hydrate, compare token text/bounds/pageNumber |
| Unit | Net-label heuristic classifies uppercase tokens correctly | Feed raw tokens, assert `tokenType` classification |
| Integration | CLI round-trip: synthetic PDF → import → manifest + bundle valid | Generate synthetic PDF, run CLI, read manifest + bundle, validate JSON schema |
| Integration | Catalog resolve: fetch manifest → resolve model+revision → hydrate doc | Mock fetch, assert hydrated `SchematicDocument` has correct pages |
| E2E | Shell loads schematic from catalog, not fixture | Render shell, assert schematic panel receives catalog-hydrated document |

## Threat Matrix

N/A — no routing, shell commands, subprocess, VCS/PR automation, executable-file classification, or process-integration boundary. The CLI script runs via `pnpm tsx scripts/import-schematics.ts` — it is a user-initiated TypeScript script, not a subprocess or automation boundary.

## Migration / Rollout

**No data migration required.** Additive-only: new domain port, new infrastructure modules, new CLI script. `iPhone13SchematicFixtures` stays unchanged. Catalog loader is additive to shell. Revert by disabling catalog lookup and restoring fixture injection (git revert).

The shell refactor (PR4) switches from `iPhone13SchematicFixtures.createFixtures().document` to `SchematicCatalogService.hydrate(bundleJson)`. If the catalog is empty (no imports yet), the shell falls back to the golden fixture — ensuring the app works without running the CLI.

## PR Chain Slicing

| PR | Scope | New files | Modified files | Est. lines |
|----|-------|-----------|----------------|-----------|
| PR1 | Catalog + loader | `ISchematicParser`, `RawSchematicTokenSet`, `SchematicCatalogService`, `SchematicBundleSerializer`, `HydrateBundle` | — | ~280 |
| PR2 | Parser + assembler | `SchematicFormatSniffer`, `PdfSchematicParser`, `SchematicParserFactory`, `SchematicAssembler` | — | ~320 |
| PR3 | CLI + fixture | `scripts/import-schematics.ts`, synthetic PDF generator, round-trip test | — | ~250 |
| PR4 | Shell wiring | — | `SchematicsFacade`, `WorkbenchFacade`, `BoardForgeShell` | ~120 |

Each PR is independently testable and ≤400 lines. PR1 is the foundation (schemas + hydration). PR2 is the parser stack. PR3 is the CLI entry point. PR4 wires everything together.

## Synthetic Fixture Design

Generate a minimal vector PDF programmatically using `pdfjs-dist`'s own API (or a raw PDF byte writer — ~50 lines). The synthetic PDF contains:
- 2 pages with known text tokens at deterministic coordinates
- Tokens: `PP_VDD_MAIN` (net label), `U2700` (designator), `A12` (pin num)
- Expected `SchematicDocument` JSON as a golden file

Round-trip test: generate PDF → parse → serialize → hydrate → assert token text, bounds, and page numbers match golden. This validates the full pipeline without external dependencies.

For user PDF validation (KiCad export or open-hardware schematic): the CLI runs the same path. Parser confidence `EXACT_MAGIC` confirms vector text extraction worked. `NO_TEXT_TOKENS` diagnostic flags image-only PDFs for deferred handling.

## Risks + Mitigations

| Risk | Mitigation |
|------|------------|
| `pdfjs-dist` API shape differs across versions | Pin version in package.json; test against exact API (`page.getTextContent().items[].transform`) |
| Token transform matrix math: pdfjs uses `[a,b,c,d,e,f]` affine transform | Derive `(x, y, width, height)` from `transform[4], transform[5]` (tx, ty) and `width` from text metrics; unit test with known coordinates |
| Net-label heuristic false positives | Conservative regex; catalog records `parserConfidence`; UI can filter by `tokenType` |
| Real PDFs are image-only (no text operators) | Scope explicitly limits to vector-text; `NO_TEXT_TOKENS` diagnostic; image-only deferred |
| Bundle JSON size for large schematics (120+ pages) | Estimated ~500KB–2MB for typical schematics; Vite serves from `public/` which is efficient; compression via gzip in production |
| `pdfjs-dist` adds test surface (Vitest) | Isolated in `src/infrastructure/`; lazy import; if Vitest has issues, mock the module in tests |

## Rollback / Data Notes

Additive-only change. No existing files are deleted. `public/schematics/` bundles are git-ignored (generated by CLI). Rollback: `git revert` the 4 PRs in reverse order. No schema migrations. No database changes. No breaking changes to existing domain types.

## Open Questions

- [ ] Should the manifest include a `parserConfidence` field for UI display, or is it sufficient to have it at import time only?
- [ ] For the synthetic PDF generator: raw PDF byte writer (~50 lines, zero deps) vs `pdfjs-dist` API (heavier but tests the actual parser path)? Recommendation: raw PDF writer for the fixture generator, `pdfjs-dist` only in the parser itself.
