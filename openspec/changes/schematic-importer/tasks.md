# Tasks: Schematic Import Pipeline

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~970 (PR1 ~280, PR2 ~320, PR3 ~250, PR4 ~120) |
| 400-line budget risk | Low (each PR ≤400) |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 → PR 2 → PR 3 → PR 4 (feature-branch-chain) |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: Low

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 1 | Catalog + hydration loader (port, bundle, manifest) | PR 1 | `pnpm vitest run tests/unit/schematics/catalog` | N/A — pure modules; CLI harness in PR 3 | Revert `src/infrastructure/schematics/catalog/`, domain port |
| 2 | Parser + assembler (sniffer, pdf parser, factory, assembler) | PR 2 | `pnpm vitest run tests/unit/schematics/parser` | N/A — pure modules; synthetic harness in PR 3 | Revert `src/infrastructure/schematics/parsers/`, sniffer, assembler |
| 3 | CLI importer + synthetic PDF fixture + round-trip | PR 3 | `pnpm vitest run tests/integration/schematics/roundTrip.test.ts` | `pnpm tsx scripts/import-schematics.ts ./test-fixtures` | Revert `scripts/import-schematics.ts`, fixture generator |
| 4 | Shell wiring (facade + shell catalog lookup) | PR 4 | `pnpm vitest run tests/unit/schematics/shellWiring.test.ts` | `pnpm dev` — open board → schematic panel loads from catalog | Revert facade + shell modifications only |

---

## PR1: Catalog + Loader Foundation

Satisfies: **schematic-import** R1.5, R1.6, R1.7; **schematics** R2.15, R2.16.

### Phase 1: Domain Port + Intermediate Types

- [ ] 1.1 RED: Create `tests/unit/schematics/ISchematicParser.test.ts` — port accepts `Uint8Array` + metadata, returns `SchematicDocument`; port rejects `emptyBytes` → `EMPTY_INPUT` error, no throw (R2.15 both scenarios)
- [ ] 1.2 GREEN: Create `src/domain/schematics/ports/ISchematicParser.ts` — `ISchematicParser` interface, `ParseSchematicMeta`, `ParseSchematicResult`, `ParseDiagnostic` types
- [ ] 1.3 GREEN: Create `src/domain/schematics/intermediate/RawSchematicTokenSet.ts` — `RawSchematicTokenSet`, `RawSchematicPage` interfaces

### Phase 2: Bundle Serialization + Hydration

- [ ] 2.1 RED: Create `tests/unit/schematics/bundleRoundTrip.test.ts` — build `SchematicDocument` with 2 pages + tokens, serialize via `SchematicBundleSerializer`, hydrate via `HydrateBundle`, assert token text/bounds/pageNumber/fontSize match; net-label heuristic classification verified (NET_LABEL for `PP_VDD_MAIN`, DESIGNATOR for `U2700`, PIN_NUM for `A12`)
- [ ] 2.2 GREEN: Create `src/infrastructure/schematics/catalog/SchematicBundleSerializer.ts` — serializes `SchematicDocument` → `SchematicDocumentBundle` JSON per design schema
- [ ] 2.3 GREEN: Create `src/infrastructure/schematics/catalog/HydrateBundle.ts` — reconstructs `SchematicDocument` from JSON bundle; rebuilds `BoundingBox2D`, `VectorToken`, `SchematicPage`, spatial index

### Phase 3: Manifest Catalog Service

- [ ] 3.1 RED: Create `tests/unit/schematics/manifestMerge.test.ts` — idempotent merge: existing manifest + same hash → unchanged (R1.6 scenario 1); merge with new file → exactly one new entry, existing preserved (R1.6 scenario 2)
- [ ] 3.2 GREEN: Create `src/infrastructure/schematics/catalog/SchematicCatalogService.ts` — `ManifestMerge.merge()`, `resolve(boardModel, boardRevision?)`, `hydrateBundle()`, SHA-256 hash idempotence
- [ ] 3.3 RED: Create `tests/unit/schematics/catalogResolve.test.ts` — exact revision resolves (R1.5 scenario 1); fallback to latest by timestamp when no revision (R1.5 scenario 2); missing model → `NO_BUNDLE_FOUND` result, no throw (R1.5 scenario 3); catalog resolves model+revision → hydrated doc (R2.16 scenario 1); fallback latest revision (R2.16 scenario 2); no companion → `NO_COMPANION` (R2.16 scenario 3); golden `iPhone13SchematicFixtures` unchanged in test context (R2.16 scenario 4)
- [ ] 3.4 GREEN: Implement `resolve()` + `hydrateBundle()` in `SchematicCatalogService.ts` — manifest fetch, lookup by `boardModel+boardRevision`, JSON bundle fetch + `HydrateBundle.hydrate()`

---

## PR2: Parser + Assembler

Satisfies: **schematic-import** R1.1, R1.2, R1.3, R1.7; **schematics** R2.15.

### Phase 4: Format Sniffer

- [ ] 4.1 RED: Create `tests/unit/schematics/sniffer.test.ts` — `%PDF-1.x` magic → `VECTOR_PDF` + `EXACT_MAGIC` confidence (R1.1 scenario 1); garbage bytes → `UNKNOWN` + `UNRECOGNIZED_FORMAT` diagnostic (R1.1 scenario 2)
- [ ] 4.2 GREEN: Create `src/domain/schematics/services/SchematicFormatSniffer.ts` — inspects leading 1024 bytes, returns format enum + confidence

### Phase 5: PDF Parser

- [ ] 5.1 RED: Create `tests/unit/schematics/pdfParser.test.ts` — mock `pdfjs-dist` `page.getTextContent()` returning tokens `U2700` and `PP_VDD_MAIN` with transform matrix; assert extracted `VectorToken` entries have non-empty text, valid `BoundingBox2D`, correct `pageNumber` (R1.2 scenario 1); mock empty pages → zero tokens + `NO_TEXT_TOKENS` diagnostic (R1.2 scenario 2)
- [ ] 5.2 GREEN: Create `src/infrastructure/schematics/parsers/PdfSchematicParser.ts` — lazy `import('pdfjs-dist')`, `page.getTextContent().items[]` → derive `(x,y,w,h)` from `transform[4],transform[5]` + text metrics; returns `RawSchematicTokenSet`

### Phase 6: Parser Factory + Assembler

- [ ] 6.1 RED: Create `tests/unit/schematics/parserFactory.test.ts` — `VECTOR_PDF` → returns `PdfSchematicParser` implementing `ISchematicParser` (R1.7 scenario 1); `UNKNOWN` → `NO_PARSER_FOR_FORMAT` error (R1.7 scenario 2)
- [ ] 6.2 GREEN: Create `src/infrastructure/schematics/parsers/SchematicParserFactory.ts` — mirrors `BoardViewParserFactory`; `create(format) → ISchematicParser`
- [ ] 6.3 RED: Create `tests/unit/schematics/assembler.test.ts` — 3-page raw set → `SchematicDocument` with 3 `SchematicPage` + spatial index (R1.3 scenario 1); 601-page raw set → `PAGE_LIMIT_EXCEEDED` error (R1.3 scenario 2); net-label heuristic classifies `PP_VDD_MAIN` as NET_LABEL, `R2700` as DESIGNATOR, `A12` as PIN_NUM, lowercase/mixed as TEXT
- [ ] 6.4 GREEN: Create `src/infrastructure/schematics/assemblers/SchematicAssembler.ts` — transforms `RawSchematicTokenSet` → `SchematicDocument`; validates ≤500 pages + ≤50MB; builds `SpatialIndex`; applies net-label/designator/pin-num heuristic

---

## PR3: CLI Importer + Synthetic Fixture

Satisfies: **schematic-import** R1.4, R1.6 (CLI path).

### Phase 7: Synthetic PDF Fixture Generator

- [ ] 7.1 RED: Create `tests/unit/schematics/syntheticPdf.test.ts` — generates 2-page vector PDF; assert magic bytes `%PDF-`; assert parsed tokens contain `PP_VDD_MAIN`, `U2700`, `A12` at deterministic coordinates; assert parser confidence = `EXACT_MAGIC`
- [ ] 7.2 GREEN: Create `tests/helpers/syntheticPdfGenerator.ts` — raw PDF byte writer (~50 lines, zero deps); embeds font metadata for known tokens at deterministic positions

### Phase 8: CLI Import Script

- [ ] 8.1 RED: Create `tests/integration/schematics/roundTrip.test.ts` — synthetic PDF → CLI import path → manifest + bundle JSON written; manifest has correct `boardModel`, `boardRevision`, `hash`, `parserConfidence`, `tokenCount`, `pageCount`; hydrate bundle → `SchematicDocument` with correct token text/bounds (design round-trip scenario)
- [ ] 8.2 GREEN: Create `scripts/import-schematics.ts` — `pnpm tsx scripts/import-schematics.ts <dir>`: recursive folder scan, sniff each file, parse, assemble, serialize, write bundles + manifest to `public/schematics/`; skip corrupt PDFs with warning (R1.4 scenario 2); SHA-256 hash per bundle for idempotent re-scan (R1.6)
- [ ] 8.3 RED: Create `tests/unit/schematics/cliSkip.test.ts` — mock one valid + one corrupt PDF buffer → valid emitted, corrupt skipped with warning logged, manifest has exactly one entry (R1.4 scenario 2)
- [ ] 8.4 Verify: Run `pnpm tsx scripts/import-schematics.ts ./test-fixtures` with synthetic PDF → inspect `public/schematics/manifest.json` and bundle JSON; assert `parserConfidence: "EXACT_MAGIC"` in manifest entry

---

## PR4: Shell Wiring

Satisfies: **schematics** R2.16 (end-to-end).

### Phase 9: Facade + Shell Integration

- [ ] 9.1 RED: Create `tests/unit/schematics/shellWiring.test.ts` — `SchematicsFacade.resolveFromCatalog(model, revision)` delegates to `SchematicCatalogService`, returns hydrated doc; `WorkbenchFacade.resolveCompanion` queries catalog → returns `CompanionResolution` with doc; unknown model → `NO_COMPANION`, shell renders empty schematic state without throwing (R2.16 scenario 3)
- [ ] 9.2 GREEN: Modify `src/application/schematics/SchematicsFacade.ts` — add `resolveFromCatalog(model, revision?)` using `SchematicCatalogService`
- [ ] 9.3 GREEN: Modify `src/application/workbench/WorkbenchFacade.ts` — `resolveCompanion` queries `SchematicCatalogService`; remove `companionFixtures` constant; fallback to golden `iPhone13SchematicFixtures` when catalog is empty
- [ ] 9.4 GREEN: Modify `src/ui/workbench/BoardForgeShell.tsx` — replace `iPhone13SchematicFixtures` memo with catalog-driven `resolveFromCatalog()` call; empty catalog → golden fixture fallback
- [ ] 9.5 Verify: `pnpm test` — all existing domain/facade/workbench tests pass unchanged; `pnpm dev` — open board → schematic panel loads from catalog (or golden fixture if no bundles)
