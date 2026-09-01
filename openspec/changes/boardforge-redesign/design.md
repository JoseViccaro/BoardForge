# Design: BoardForge Workbench Redesign

## Technical Approach

Frontend presentation + application-layer work only. `src/domain` is untouched. Decompose the 548-line `src/App.tsx` into a panel shell, compose the existing facades (`BoardViewFacade`, `SchematicsFacade`, `MeasurementsFacade`) behind a new `WorkbenchFacade`, and add an in-process typed event bus for cross-panel synchronization. All logic lives in pure application-layer services/stores (no React in the core), maximally testable with Vitest (pure unit tests, no DOM) while preserving OWASP ASVS L2.

## Architecture Decisions

| # | Decision | Alternatives | Choice |
|---|----------|-------------|--------|
| D1 | State management | zustand / React Context / Redux | **Pure app-layer stores + `useSyncExternalStore`** — zero-dependency, unit-testable without React, aligns with Hexagonal (UI thin) |
| D2 | Cross-panel sync | Redux actions / imperative props drilling | **Typed in-process `WorkbenchEventBus` (pub/sub)** — bidirectional, panels subscribe, no prop drilling across shell |
| D3 | Schematic rendering | Raster `<img>` + hotspots | **Pure `VectorRenderer` (tokens→draw commands) + `<canvas>`** — meets spec (no raster fallback in-slice), testable as pure fn |
| D4 | Measurement log/history | Extend domain aggregate | **Frontend `MeasurementLogStore`** — domain lacks reading-history; `src/domain` untouched; facade `recordMeasurement` returns `DiodeEvaluationResultDto` for evaluation |
| D5 | Panel geometry | Hand-rolled flex | **Minimal splitter (`PositionsStore`)** persisted to session — keeps scope tight, no heavy lib |
| D6 | Search | Backend query / naive `find` | **Pure `WorkbenchSearchService` over loaded session** — the 4 fields indexed, substring+ranked, in-memory (frontend-only per spec) |

## Data Flow

    BoardForgeShell (features/workbench)
        │  useWorkbench() — subscribes stores
        ▼
    WorkbenchFacade ── composes ──► BoardViewFacade / SchematicsFacade / MeasurementsFacade
        │  owns: SessionStore, MeasurementLogStore, WorkbenchSearchService
        ▼
    WorkbenchEventBus  ◄── publishes/emits ──  panels register(topics, handler)
        │                     topics: selection.change | pairing.resolved |
        │                             measurement.recorded | search.focus | page.navigate
        ▼
    BoardViewPanel ─► SchematicsPanel ─► NetNavigatorPanel ─► MeasurementPanel
        │   canvas render         vector+overlay          filter              diode form+log
        └─────── SchematicCrossProbeIndex ── reverse-maps net↔schematic ───────┘

Selection flow: `BoardViewPanel` emits `selection.change{net}` → bus → `SchematicsPanel` reverse-maps via `SchematicCrossProbeIndex.queryFromBoardViewNet` → overlay highlights; `NetNavigatorPanel` filters; `MeasurementPanel` binds net/pin.

## File Changes

| File | Action | Desc |
|------|--------|------|
| `src/application/workbench/WorkbenchFacade.ts` | Create | Compose facades + stores + bus |
| `src/application/workbench/WorkbenchEventBus.ts` | Create | Typed pub/sub, topics/payloads |
| `src/application/workbench/SessionStore.ts` | Create | Panel geometry, selection, history; schema-validated persist (ASVS L2) |
| `src/application/workbench/MeasurementLogStore.ts` | Create | Readings/history/trends/export (frontend, per D4) |
| `src/application/workbench/WorkbenchSearchService.ts` | Create | 4-field index + ranked search |
| `src/ui/schematics/VectorRenderer.ts` | Create | Pure tokens→draw commands |
| `src/ui/schematics/SchematicPanel.tsx` | Create | Canvas + overlay + page nav + detail |
| `src/ui/schematics/HitTester.ts` | Create | Spatial-index hit-testing |
| `src/ui/boardview/BoardViewPanel.tsx` | Create | Extract canvas render+interaction from App.tsx |
| `src/ui/net/NetNavigatorPanel.tsx` | Create | Filter list, marker "not in schematic" |
| `src/ui/measure/MeasurementPanel.tsx` | Create | Diode form, log, trends, export |
| `src/ui/workbench/BoardForgeShell.tsx` | Create | Panel layout shell + status bar + shortcuts |
| `src/ui/extract-render.ts` | Create | Move canvas paint fn out of App.tsx |
| `src/App.tsx` | Modify | Slim to `BoardForgeShell` composition behind flag |
| `src/application/*/…Facade.ts` | Untouched | Domain + facades unchanged |

## Interfaces / Contracts

```ts
// WorkbenchEventBus topics
type WorkbenchTopic =
  | "selection.change"   // { net?: string; refDes?: string; pin?: string; boardId: string }
  | "pairing.resolved"   // { boardId; schematicId?; diagnostic: "OK"|"NO_COMPANION" }
  | "measurement.recorded" // { padId; netName; outcome; normalizedVolts }
  | "search.focus"       // { query; hit?: SearchHit }
  | "page.navigate";     // { pageNumber }

// WorkbenchFacade contract
class WorkbenchFacade {
  openBoard(boardId): Promise<SessionState>;        // resolve companion
  select(target: SelectionTarget): void;            // emit selection.change
  recordMeasurement(dto): Promise<RecordingResult>;
  search(q: string): SearchHit[];                   // delegates to WorkbenchSearchService
  saveSession(): void; loadSession(id?): SessionState;
}
```

## Testing Strategy (Vitest, `tests/` — pure, no DOM for core)

| Layer | What | Approach |
|-------|------|----------|
| Unit | EventBus pub/sub, broadcast, unsubscribe | Pure tests |
| Unit | VectorRenderer token positioning; HitTester; overlay resolve-empty | Pure fn tests |
| Unit | SearchService 4-field substring + rank + dedupe history | Fixtures from seeds |
| Unit | SessionStore save/restore + corrupt-state recovery (ASVS) | Mock localStorage |
| Unit | WorkbenchFacade delegation — existing facade/domain tests stay green; no `src/domain` touched | Composition tests |
| Integration | Cross-panels: selection.change boardview→schematic/navigator via bus + CrossProbeIndex | Assembled facade test |

## Threat Matrix

**N/A** — no routing, shell, subprocess, VCS/PR automation, executable-file classification, or process-integration boundary in this frontend presentation + application-layer change. (The only `exec` expressions are pre-existing string-parsing regexes in `FzzArchiveParser.ts`, untouched and out of scope.)

## Migration / Rollout

No data/domain migration. Legacy `App.tsx` render kept behind a feature flag until each slice ships; pure additive git revert rollback per proposal.

## Open Questions

- [ ] Measurement "history/trends" and "export" have no domain aggregate — confirm frontend `MeasurementLogStore` is the intended owner (D4) before implementation.
- [ ] Confirm localStorage is the designated ASVS L2 persistence target for `SessionStore` (vs. IndexedDB).

## PR / Slice Decomposition (stay within 400-line review budget)

Scope reconciliation: multi-field search (OD-ARCH-003) is now **FULL in-slice** (was "deferred"). Recommend **chained PRs** (delivery_strategy `ask-on-risk` → work units):

1. **PR-1 platform**: `WorkbenchEventBus` + `SessionStore` + `WorkbenchFacade` skeleton (pure, fully tested). Backbone enabling all panels.
2. **PR-2 boardview**: extract `BoardViewPanel` + `extract-render` from App.tsx; emit/receive selection. No behavior change.
3. **PR-3 schematics**: `VectorRenderer` + `SchematicPanel` + overlay via CrossProbeIndex + page nav.
4. **PR-4 cross-panel sync**: wire boardview↔schematic↔navigator over the bus (the technician loop).
5. **PR-5 search + navigator**: `WorkbenchSearchService` (all 4 fields) + `NetNavigatorPanel` filtering + history.
6. **PR-6 measurements + session**: `MeasurementLogStore` (diode form, trends, export) + session save/restore wiring.

Each slice: clear start/finish, autonomous scope, own verification (RED→GREEN), reasonable rollback. PRs chain off the feature branch. This keeps each PR ≤ ~400 lines and isolates the riskiest additions.
