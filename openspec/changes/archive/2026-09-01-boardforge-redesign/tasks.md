# Tasks: BoardForge Workbench Redesign

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 1,300–1,600 (across 6 slices) |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 → PR 2 → PR 3 → PR 4 → PR 5 → PR 6 (feature-branch-chain) |
| Delivery strategy | ask-on-risk |
| Chain strategy | feature-branch-chain |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: High

**Rationale for feature-branch-chain**: Panels are deeply coupled through the WorkbenchEventBus and shared SessionStore. Each PR builds on the previous one's types and contracts. Stacked-to-main would expose partial integrations. A feature branch (`feature/boardforge-workbench`) accumulates the final integration; PR #1 targets the feature branch, PR #2 targets PR #1, and so on. Only the feature branch merges to main after all slices land.

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 1 | Platform backbone: EventBus + SessionStore + WorkbenchFacade skeleton | PR 1 | `npx vitest run tests/unit/workbench/` | Open board → shell renders without panels; bus fires and receives test events | Remove `src/application/workbench/` — no panel code depends on it yet |
| 2 | BoardView panel extraction from App.tsx | PR 2 | `npx vitest run tests/unit/ui/boardview/` + `tests/unit/workbench/` | Open board → boardview renders; net click emits selection event on bus | Revert `src/ui/boardview/`, restore App.tsx import; feature shell still loads |
| 3 | Schematics panel: VectorRenderer + SchematicPanel + overlay | PR 3 | `npx vitest run tests/unit/ui/schematics/` + `tests/unit/workbench/` | Open paired board → schematic renders tokens; net selection shows highlight overlay | Remove `src/ui/schematics/`; boardview panel unaffected |
| 4 | Cross-panel sync wiring (bus ↔ panels ↔ CrossProbeIndex) | PR 4 | `npx vitest run tests/unit/workbench/ && tests/integration/` | Click net in boardview → schematic highlights + navigator filters | Revert Panel wiring files; panels render independently but no sync |
| 5 | Multi-field search + NetNavigatorPanel | PR 5 | `npx vitest run tests/unit/ui/search/` + `tests/unit/workbench/` | Type "VDD" → results appear with panel context; history persists on reload | Remove `WorkbenchSearchService` + `NetNavigatorPanel`; other panels unaffected |
| 6 | MeasurementLogStore + MeasurementPanel + IndexedDB session persistence | PR 6 | `npx vitest run tests/unit/ui/measure/ && tests/unit/workbench/` + `npx vitest run tests/unit/` (full) | Record reading → log shows; reload session → state restored | Remove `MeasurementLogStore` + `MeasurementPanel` + IndexedDB glue; search/nav unaffected |

## Phase 1: Platform Foundation (EventBus + SessionStore + Facade Skeleton)

Satisfies: **workbench** spec (WorkbenchFacade composition, event bus, keyboard shortcuts foundation).

- [x] 1.1 RED: Create `tests/unit/workbench/WorkbenchEventBus.test.ts` — typed pub/sub: subscribe, publish, unsubscribe, topic isolation
- [x] 1.2 GREEN: Create `src/application/workbench/WorkbenchEventBus.ts` — typed `WorkbenchTopic` union, `subscribe(topic, handler)`, `publish(topic, payload)`, `dispose()`; zero dependencies
- [x] 1.3 RED: Create `tests/unit/workbench/SessionStore.test.ts` — save/load panel geometry + selection to IndexedDB; corrupt-state recovery returns fresh session; ASVS L2 schema validation
- [x] 1.4 GREEN: Create `src/application/workbench/SessionStore.ts` — IndexedDB-backed store (idb wrapper), schema-validated on load, exports `SessionState` type (panel positions, selection, search history, pairing)
- [x] 1.5 RED: Create `tests/unit/workbench/WorkbenchFacade.test.ts` — facade delegates `openBoard` to `BoardViewFacade`, `select` emits on bus, `search` delegates to search service, preserves existing facade contracts
- [x] 1.6 GREEN: Create `src/application/workbench/WorkbenchFacade.ts` — composes `BoardViewFacade`, `SchematicsFacade`, `MeasurementsFacade`; owns `SessionStore`, `MeasurementLogStore`, `WorkbenchSearchService` (stubs until later slices); companion resolution via `(boardModel, boardRevision)` → `CompanionResolution`
- [x] 1.7 RED: Create `tests/unit/workbench/companionResolution.test.ts` — auto-pair by model+revision returns schematic; missing revision returns `NO_COMPANION`
- [x] 1.8 GREEN: Implement companion resolution inside `WorkbenchFacade.openBoard()` — deterministic lookup against catalog fixtures, emit `pairing.resolved` on bus
- [x] 1.9 Create `src/ui/workbench/BoardForgeShell.tsx` — minimal shell skeleton: renders placeholder divs for boardview/schematic/navigator/measure panels; subscribes to `SessionStore` via `useSyncExternalStore`
- [x] 1.10 Modify `src/App.tsx` — add feature flag toggle; behind flag render `BoardForgeShell` instead of current monolith; existing render path unchanged

## Phase 2: BoardView Panel Extraction — [x] ALL DONE (PR 2, branch feat/boardforge-workbench-02-boardview; 326 tests: 303 baseline + 23 new; vite build ok)

Satisfies: **boardview** spec (auto-pairing, net highlighting sync, pin hover/click). Depends on Phase 1 bus/facade.

- [x] 2.1 RED: Create `tests/unit/ui/boardview/BoardViewPanel.test.ts` — renders board from fixture data; emits `selection.change` on net click; highlight reflects active selection; layer flip preserves highlight
- [x] 2.2 GREEN: Create `src/ui/extract-render.ts` — extract canvas paint function from `App.tsx` into pure function `renderBoard(canvas, boardData, options)`
- [x] 2.3 GREEN: Create `src/ui/boardview/BoardViewPanel.tsx` — React component: canvas + layer tabs + pin hover tooltip (net name, classification) + click reveals schematic details via `SchematicCrossProbeIndex`; subscribes to `selection.change` on bus
- [x] 2.4 Wire `BoardForgeShell.tsx` to render `BoardViewPanel` in the boardview slot; pass facade for data access
- [x] 2.5 Modify `src/App.tsx` — behind feature flag, replace current boardview inline code with `BoardForgeShell` composition

## Phase 3: Schematics Panel (Vector Renderer + Overlay)

> **ARCHIVE RECONCILIATION**: Phases 3–6 fine-grained rows below were superseded at apply time by the re-sliced 15-unit plan (`tasks-resliced.md`, units 3A–3E, 4A–4B, 5A–5C, 6A–6E). All re-sliced units are marked `[x] applied` and verified complete (verify-report, 23/23 requirements, 37/37 scenarios, 447/447 tests). Authorized archive-time stale-checkbox reconciliation: each superseded row below is marked `[x]` per verify-report proof.

Satisfies: **schematics** spec (vector token rendering, cross-probe overlay, page navigation, component detail). Depends on Phase 1 bus/facade + Phase 2 selection model.

- [x] 3.1 RED: Create `tests/unit/ui/schematics/VectorRenderer.test.ts` — tokens placed at BoundingBox2D positions; missing page returns empty canvas; page filter correct
- [x] 3.2 GREEN: Create `src/ui/schematics/VectorRenderer.ts` — pure function: `(tokens: VectorToken[], page: number, ctx: CanvasRenderingContext2D) => void`; positions tokens by coordinates, text rendering, no raster
- [x] 3.3 RED: Create `tests/unit/ui/schematics/HitTester.test.ts` — hit test at coordinates returns matching token; miss returns null; spatial index O(1)/O(log N)
- [x] 3.4 GREEN: Create `src/ui/schematics/HitTester.ts` — spatial index over `VectorToken` bounding boxes; `testPoint(x, y, page)` → `VectorToken | null`
- [x] 3.5 RED: Create `tests/unit/ui/schematics/SchematicPanel.test.ts` — renders page from tokens; overlay highlights matching net from `selection.change`; empty net → no highlight + signal; page nav (next/prev/jump) works; component detail shows pin map from `SchematicPinLocation`
- [x] 3.6 GREEN: Create `src/ui/schematics/SchematicPanel.tsx` — canvas + overlay rendering + page nav controls + component detail panel; subscribes to `selection.change` on bus, queries `SchematicCrossProbeIndex` for highlight targets
- [x] 3.7 Wire `BoardForgeShell.tsx` to render `SchematicPanel` in the schematic slot; pass facade for token data

## Phase 4: Cross-Panel Synchronization

Satisfies: **workbench** spec (cross-panel synchronization scenarios). Depends on Phases 1–3.

- [x] 4.1 RED: Create `tests/integration/workbench/crossPanelSync.test.ts` — assembly test: boardview emits `selection.change{net}` → bus delivers to SchematicPanel + NetNavigatorPanel; `SchematicCrossProbeIndex.queryFromBoardViewNet` reverse-maps correctly; selection with no counterpart → schematic empty, navigator "not in schematic" marker
- [x] 4.2 GREEN: Wire `SchematicPanel` subscription to `selection.change` with `CrossProbeIndex` reverse-mapping in `BoardForgeShell.tsx` or through facade composition
- [x] 4.3 RED: Create `tests/unit/workbench/keyboardShortcuts.test.ts` — shortcut key maps to panel focus change; net jump shortcut; cross-probe toggle
- [x] 4.4 GREEN: Implement keyboard shortcut handler in `BoardForgeShell.tsx` — focus management across panels, `Ctrl+[number]` for panel focus, net navigation shortcuts

## Phase 5: Search + Net Navigator

Satisfies: **search** spec (multi-field unified search, real-time results, history, symptom search). Depends on Phase 1 bus/facade + Phase 4 selection model.

- [x] 5.1 RED: Create `tests/unit/ui/search/WorkbenchSearchService.test.ts` — 4-field substring match (net, designator, part#, symptom); ranked results; history recorded newest-first; history deduped; symptom → `CRITICAL_LOW_OR_SHORT` candidate mapping; ASVS L2 input sanitization
- [x] 5.2 GREEN: Create `src/application/workbench/WorkbenchSearchService.ts` — in-memory 4-field index over loaded session; `search(query)` → `SearchHit[]` with field, panel context, board origin; `history()` → `string[]` newest-first
- [x] 5.3 RED: Create `tests/unit/ui/net/NetNavigatorPanel.test.ts` — renders filtered net list from session; filter by selection; "not in schematic" marker on unmapped nets; search highlights matches; history display
- [x] 5.4 GREEN: Create `src/ui/net/NetNavigatorPanel.tsx` — filterable net list + search input + history list; subscribes to `selection.change` on bus to highlight/filter; "not in schematic" marker via `SchematicCrossProbeIndex`
- [x] 5.5 Wire `BoardForgeShell.tsx` to render `NetNavigatorPanel`; connect to facade search + bus

## Phase 6: Measurements + Session Persistence

Satisfies: **measurements** spec (diode form, inline validation, history/trends, export) + **session** spec (full persistence, corrupt recovery, pairing restore, selection restore). Depends on Phases 1–5.

- [x] 6.1 RED: Create `tests/unit/ui/measure/MeasurementLogStore.test.ts` — record reading with meter profile + board state; append to net/pin history; trend indicator computes deviation; export produces CSV/JSON; history scoped per net
- [x] 6.2 GREEN: Create `src/application/workbench/MeasurementLogStore.ts` — `record(dto)` validates against `MeasurementReference` via `DiodeModeEvaluator`, appends to history, computes trend; `export(format)` → string; IndexedDB-backed for persistence
- [x] 6.3 RED: Create `tests/unit/ui/measure/MeasurementPanel.test.ts` — diode form renders; required-field validation blocks submit; reading records to log; log displays history chronologically; export button triggers
- [x] 6.4 GREEN: Create `src/ui/measure/MeasurementPanel.tsx` — diode-mode form (reading, meter model, mode, range, board state) + bound to selected net/pin from bus + validation + log view + trend display + export button
- [x] 6.5 Wire `BoardForgeShell.tsx` to render `MeasurementPanel`; connect to facade `recordMeasurement` + bus selection binding
- [x] 6.6 RED: Create `tests/unit/workbench/sessionPersistence.test.ts` — full save/restore cycle: panel positions + selection + search history + measurements + pairing; corrupt state → fresh session + diagnostic; pairing unresolvable → `NO_COMPANION` + board loads; selection net gone → cleared state
- [x] 6.7 GREEN: Implement full `SessionStore` save/restore wiring in `WorkbenchFacade` — load session restores all stores; `saveSession()` serializes all state to IndexedDB; session reload re-resolves companion and restores selection
- [x] 6.8 Final GREEN: Modify `src/App.tsx` — feature flag default to `true`; remove legacy inline render path; all existing domain/facade tests pass unchanged

## Key Learnings

1. The 400-line budget requires 6 chained PRs — feature-branch-chain strategy keeps partial integrations off main until all panels coordinate.
2. IndexedDB for session persistence provides async, secure-context-safe storage beyond localStorage's limitations for workbench-scale data.
3. MeasurementLogStore ownership in frontend app-layer avoids domain-layer pollution since the domain `MeasurementProfile` holds refs only.
4. WorkbenchEventBus is the critical backbone — every panel slice depends on its typed topic/payload contracts from PR 1.
5. TDD strict mode means every store/service has RED tests first — test files are created before implementation files in every phase.
