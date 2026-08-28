# Tasks (RE-SLICED): BoardForge Workbench Redesign — Phases 3-6

Revision of `sdd/boardforge-redesign/tasks` (#1090). PR 1 (~1,357 actual vs ~250 forecast) and PR 2 (~1,117 vs ~220) proved extraction PRs run ~5x naive panel estimates under strict TDD + pure-core extraction. Maintainer rejected further `size:exception`; every remaining unit fits ≤400 changed lines.

Pattern per unit: ONE pure DOM-free core + its RED Vitest test file, OR one zero-logic adapter + wiring (adapter logic stays 100% in tested cores, per PR 2 pattern). A full panel per PR is proven impossible (PR 2 = 1,117).

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines (phases 3-6) | ~4,700 across 15 PRs (265-395 each) |
| 400-line budget risk | Medium (per-file calibration, ±20%, not the old 5x) |
| Chained PRs recommended | Yes |
| Suggested split | Chain PR 03 → PR 04 → ... → PR 17 |
| Chain strategy | feature-branch-chain (unchanged) |
| Delivery strategy | chaining (feature-branch-chain) |

```
Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: Medium
```

Calibration (observed PR 2): pure core 376 lines, test 327 lines (23 tests ≈ 14/test + recording Draw2D fake ~60), adapter 258 lines. Core-scale units (one impl + one test file) land 270-390; adapters ship separately, zero-logic, verified by suite+build gate plus their pure helper tests.

Phase order preserved: 3 schematics → 4 sync → 5 search → 6 measurements/session. Branches continue the existing chain numbering: `feat/boardforge-workbench-0N-<descriptor>`, each created off the immediate previous PR branch (chain tip today = `feat/boardforge-workbench-02-boardview`), every PR targeted at its parent branch.

## Chain Diagram

```text
feat/boardforge-workbench            ← tracker (PR 1, shipped)
 └─ feat/boardforge-workbench-02-boardview     (PR 2, applied — awaiting gate)
     └─ 📍 feat/boardforge-workbench-03-vector-renderer     (3A)
         └─ -04-hit-tester    (3B) → -05-overlay-resolve (3C) → -06-schematic-model (3D)
             → -07-schematic-panel (3E) → -08-cross-panel-sync (4A) → -09-keyboard-shortcuts (4B)
             → -10-search-core (5A) → -11-search-history-symptom (5B) → -12-net-navigator (5C)
             → -13-measurement-store (6A) → -14-measurement-persist-export (6B)
             → -15-measurement-panel (6C) → -16-session-restore (6D) → -17-shell-finalize (6E)
Only the tracker merges to main, after PR 17 integrates.
```

## Re-Sliced Units

| Unit | Focus / deliverable | Files (create + / modify) | Specs satisfied | Est. changed lines | Test scope (RED→GREEN Vitest) | Target branch | Prior dependency |
|---|---|---|---|---|---|---|---|
| 3A | VectorRenderer core: tokens→draw commands | + `src/ui/schematics/VectorRenderer.ts`; + `tests/unit/ui/schematics/VectorRenderer.test.ts` | schematics R1 (both scenarios) | 360 | 10 tests: BoundingBox2D placement, page 12 renders, missing page → empty + page-not-found + no exception (recording Draw2D double) | `feat/boardforge-workbench-03-vector-renderer` | chain tip `-02-boardview`; domain `VectorToken`/`BoundingBox2D` |
| 3B | HitTester core: spatial index over token bounds | + `src/ui/schematics/HitTester.ts`; + `tests/unit/ui/schematics/HitTester.test.ts` | schematics R2 prereq (click→net, coord→token), design D3 | 270 | 8 tests: near-hit, rect, cell refinement, miss→null, out-of-page→null (synthetic grid) | `feat/boardforge-workbench-04-hit-tester` | 3A |
| 3C | Overlay resolver: cross-probe reverse map | + `src/ui/schematics/overlay-resolve.ts`; + `tests/unit/ui/schematics/overlay-resolve.test.ts` | schematics R2 (both scenarios) | 300 | 8 tests: net PP_VDD_MAIN → per-page highlights, canonical pages, no occurrence → EMPTY + notInSchematic signal (registered CrossProbeIndex doc) | `feat/boardforge-workbench-05-overlay-resolve` | 3B; domain `SchematicCrossProbeIndex` |
| 3D | Page-navigation + detail pin-map cores | + `src/ui/schematics/schematic-nav.ts`, `schematic-pinmap.ts`; + 2 test files | schematics R3 (nav scenario), R4 (pin-map scenario) | 330 | 12 tests: jump U2700 → page 12 + list [12,13,14], next/prev bounds, pin A12 row (name/page/coords) + net PP_VDD_MAIN | `feat/boardforge-workbench-06-schematic-model` | 3C |
| 3E | SchematicPanel thin adapter + shell slot | + `src/ui/schematics/SchematicPanel.tsx`; mod `src/ui/workbench/BoardForgeShell.tsx` | schematics R1-R4 end-to-end UI | 280 | none (zero-logic adapter per PR 2 pattern); gate = full `pnpm test` + `pnpm build` green | `feat/boardforge-workbench-07-schematic-panel` | 3D |
| 4A | Cross-panel sync: boardview→bus→schematic | + `tests/integration/workbench/crossPanelSync.test.ts`; mod SchematicPanel bus/CSP wiring | schematics R2 (integration), design D1/D2 | 350 | 6 tests: select net → bus → overlay via queryFromBoardViewNet; no-counterpart → schematic empty + marker event emitted | `feat/boardforge-workbench-08-cross-panel-sync` | 3E |
| 4B | Keyboard shortcuts pure core | + `src/ui/workbench/keyboardShortcuts.ts` + test; mod BoardForgeShell | workbench nav; ASVS L2 input handling | 250 | 8 tests: Ctrl+number focus, net jump, cross-probe toggle, ignore browser chrome keys | `feat/boardforge-workbench-09-keyboard-shortcuts` | 4A |
| 5A | WorkbenchSearchService core: 4-field index + rank + context | mod `src/application/workbench/WorkbenchSearchService.ts` (replaces PR 1 stub); + `tests/unit/workbench/search-core.test.ts` | search R1 (3 scenarios), R2 (1) | 390 | 11 tests: substring VDD_MAIN / designator U2700 / part PMX60, panel+board context, incremental-as-typed | `feat/boardforge-workbench-10-search-core` | 4B |
| 5B | Search history + symptom reference mapping | mod `WorkbenchSearchService.ts`; + `tests/unit/workbench/search-history-symptom.test.ts` | search R3 (2 scenarios), R4 (1) | 270 | 7 tests: newest-first, dedupe, session-restore slice, CRITICAL_LOW_OR_SHORT mapping, query sanitization | `feat/boardforge-workbench-11-search-history-symptom` | 5A |
| 5C | NetNavigator adapter + marker helper | + `src/ui/net/NetNavigatorPanel.tsx`, `src/ui/net/navigator-marker.ts` + test; mod BoardForgeShell | search R2/R3 UI; schematics R2 empty signal | 380 | 6 tests: marker mapped vs not-in-schematic (pure helper); adapter gate = suite+build | `feat/boardforge-workbench-12-net-navigator` | 5B |
| 6A | MeasurementLogStore core: validation + trend | mod `src/application/workbench/MeasurementLogStore.ts` (replaces PR 1 stub); + `tests/unit/workbench/MeasurementLogStore.test.ts` | measurements R1 (capture), R2 (both), R3 (trend) | 390 | 12 tests: bind net/pin INT_PAD_084, meter +0.035 V normalization, PASS log, trend direction | `feat/boardforge-workbench-13-measurement-store` | 5C |
| 6B | Export CSV/JSON + IndexedDB persistence | mod `MeasurementLogStore.ts`; + `tests/unit/workbench/meas-export-persist.test.ts` | measurements R4 (export), session R2 | 290 | 8 tests: CSV/JSON fidelity, save/load roundtrip, export sanitization | `feat/boardforge-workbench-14-measurement-persist-export` | 6A |
| 6C | MeasurementPanel adapter + form validation core | + `src/ui/measure/MeasurementPanel.tsx`, `src/ui/measure/diode-form.ts` + test; mod BoardForgeShell | measurements R1 (block-submit scenario), R4 UI | 380 | 5 tests: board-state unset → blocks submit + error; adapter gate = suite+build | `feat/boardforge-workbench-15-measurement-panel` | 6B |
| 6D | Session restore pipeline (pure) + schema validation | mod `src/application/workbench/SessionStore.ts`; + `tests/unit/workbench/sessionPersistence.test.ts` | session R1 (both), R2, R3 (both), R4 (both) | 370 | 10 tests: full restore (sizes+selection+history+measurements+pairing), corrupt→fresh+diagnostic, NO_COMPANION, gone net→cleared (ASVS L2) | `feat/boardforge-workbench-16-session-restore` | 6C |
| 6E | Facade save/load wiring + App.tsx finalize | mod `src/application/workbench/WorkbenchFacade.ts`, `src/App.tsx` | session R1-R4 end-to-end; rollout (flag default true) | 165 | none; gate = full suite green + build green; legacy inline render removed | `feat/boardforge-workbench-17-shell-finalize` | 6D |

Total estimated changed lines (phases 3-6): **~4,700** across **15 PRs**, every unit 165-390 ≤ 400.

## Per-Unit Work Unit Contract (work-unit-commits)

Every unit keeps tests with code, one deliverable per commit/PR, and:

- **Focused test command**: `pnpm vitest run <the unit's test file>`; full gate: `pnpm test` + `pnpm build` at the PR gate (326 tests pass after PR 2; must never regress).
- **Runtime harness**: pure-core units 3A-3D, 4B, 5A, 5B, 6A, 6B, 6D → `N/A` (node-tested pure modules; visual harness lands with the adapter that consumes them). Adapter/wiring units 3E, 5C, 6C, 6E and integration 4A → `pnpm dev` with `VITE_WORKBENCH=true`, manual scenario per spec (e.g. 3E: select PP_VDD_MAIN in boardview → schematic pages highlight; 5C: filter net list, not-in-schematic marker; 6C: submit diode form, missing board state blocks; 6E: full reload restores session).
- **Rollback boundary**: each unit = its own file pair(s) (+ created files, targeted mods); `git revert` of that PR removes only that unit's behavior, no unrelated rollback.
- **OWASP ASVS L2**: preserved — query/input sanitization (5B, 6B), persisted-state schema validation (6D, 1.x already), never trusting stored session data before restore.

## Guard Contract (machine-readable)

```text
Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: Medium
```

Note: session context labels delivery strategy "chaining" — not one of the four canonical SDD values (ask-on-risk | auto-chain | single-pr | exception-ok). Behavior resolves to `auto-chain` (proceed per slice) confirmed by the explicit fixed chain strategy; flagged to orchestrator for cache normalization.