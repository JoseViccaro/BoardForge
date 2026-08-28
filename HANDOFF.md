# BoardForge — Workbench Redesign Handoff

> **Purpose**: Continuity point so work can be resumed from any machine by cloning
> `https://github.com/JoseViccaro/BoardForge.git`. This file is the source of truth
> for the delivery chain state (the Engram memory of the machine that authored this
> does not travel with the repo).

## Project

- **Repo**: https://github.com/JoseViccaro/BoardForge.git
- **Stack**: React 19 + Vite 8 + TypeScript 7 + Fastify 5 + Vitest 4 (strict TDD, pure node tests under `tests/`)
- **Architecture**: Clean Architecture + Hexagonal + DDD (modular monolith)
- **Artifact store**: hybrid (OpenSpec files in `openspec/changes/` + Engram where available)
- **Test runner**: `pnpm test` (Vitest). **Build/typecheck**: `npx tsc` — verified clean (0 errors).

## Change: `boardforge-redesign`

Unified synchronized workbench competing with JCID-class tools (Strategy B from competitive
exploration). 5 product decisions at FULL competitive depth: auto boardview↔schematic pairing,
vector-token schematic rendering with cross-probe highlights, full multi-field search,
full diode-mode measurement entry, full session restore.

### Delivery

- **Chain strategy**: feature-branch-chain (tracker accumulates; only tracker merges to main)
- **Delivery strategy**: exception-ok (size:exceptions accepted for oversized slices)
- **Review budget**: 400 lines/PR (re-sliced plan keeps every future PR ≤400)
- **Non-goals**: instrument integration, AI copilot, community (future)
- **Domain untouched**: `src/domain/**` is NOT modified — frontend + application layer only

### Tracking

- **Issue**: #1 (boardforge-redesign) — `status:approved`
- **Tracker PR**: #2 — `feat/boardforge-workbench` → main (DRAFT, keep draft until chain complete)

## Delivery Chain State

```text
main  (base, published)
 └── #2  Tracker (draft) — feat/boardforge-workbench            [PR 1: platform]  MERGED-INTENDED
      └── #3  feat/boardforge-workbench-02-boardview            [PR 2: boardview extraction]  OPEN
           └── #4  feat/boardforge-workbench-03-vector-renderer [3A]                      OPEN
                └── #5  feat/boardforge-workbench-04-hit-tester [3B]                      OPEN
                     └── #6  feat/boardforge-workbench-05-overlay-resolve [3C]            OPEN
                          └── NEXT: -06-schematic-model [3D] page-nav + pin-map cores
```

### PRs opened (all `type:feature`, base = immediate parent)

| PR | Unit | Branch (head) | Base | Status |
|----|------|---------------|------|--------|
| #2 | 1 (platform) | `feat/boardforge-workbench` | `main` | OPEN (draft tracker) |
| #3 | 2 (boardview) | `feat/boardforge-workbench-02-boardview` | tracker | OPEN |
| #4 | 3A (vector-renderer) | `feat/boardforge-workbench-03-vector-renderer` | -02 | OPEN |
| #5 | 3B (hit-tester) | `feat/boardforge-workbench-04-hit-tester` | -03 | OPEN |
| #6 | 3C (overlay-resolve) | `feat/boardforge-workbench-05-overlay-resolve` | -04 | OPEN |

## Implementation Progress (from `tasks-resliced.md`)

Units completed (checkbox `[x] applied` in `openspec/changes/boardforge-redesign/tasks-resliced.md`):
- [x] 1 (platform), 2 (boardview) — pre-re-slice PRs 1-2
- [x] 3A VectorRenderer core (vector-renderer, 324 lines)
- [x] 3B HitTester core (hit-tester, 254 lines)
- [x] 3C overlay-resolve core (overlay-resolve, 268 lines)

Test counts: 350 passing (81 files), zero regressions, `src/domain/**` untouched.

## Remaining Units (re-sliced, each ≤400 lines)

| Unit | Focus | Branch | Est |
|------|-------|--------|-----|
| 3D | schematic-nav + schematic-pinmap cores | `-06-schematic-model` | 330 |
| 3E | SchematicPanel adapter + shell slot | `-07-schematic-panel` | 280 |
| 4A | Cross-panel sync integration | `-08-cross-panel-sync` | 350 |
| 4B | Keyboard shortcuts core | `-09-keyboard-shortcuts` | 250 |
| 5A | Search core (4-field + rank) | `-10-search-core` | 390 |
| 5B | Search history + symptom mapping | `-11-search-history-symptom` | 270 |
| 5C | NetNavigator + marker | `-12-net-navigator` | 380 |
| 6A | MeasurementLogStore core | `-13-measurement-store` | 390 |
| 6B | Export CSV/JSON + IndexedDB persist | `-14-measurement-persist-export` | 290 |
| 6C | MeasurementPanel + form core | `-15-measurement-panel` | 380 |
| 6D | Session restore pipeline | `-16-session-restore` | 370 |
| 6E | Facade wiring + App finalize | `-17-shell-finalize` | 165 |

## Resume Instructions (on the other machine)

1. `git clone https://github.com/JoseViccaro/BoardForge.git && cd BoardForge`
2. `pnpm install`
3. Checkout the chain tip: `git checkout feat/boardforge-workbench-05-overlay-resolve`
4. Run the suite to confirm baseline: `pnpm test` → expect ~350 passing
5. Create the next unit branch off the tip: `git checkout -b feat/boardforge-workbench-06-schematic-model`
6. Read `openspec/changes/boardforge-redesign/tasks-resliced.md` for unit 3D scope, then implement with strict TDD (RED→GREEN), re-gate with `git diff --stat` (≤400 lines), commit work units, push, and open PR #7 targeting `feat/boardforge-workbench-05-overlay-resolve`.

## Important Notes

- `npx tsc` is CLEAN (0 errors). Some sdd-apply agents run a tsc variant that reports
  spurious pre-existing errors — always verify with a direct `npx tsc` before treating
  a "broken build" report as real.
- The Engram memory (apply-progress, session context) is machine-local and does NOT
  travel with the repo. `tasks-resliced.md`, `tasks.md`, `design.md`, and the specs are
  the durable source of truth for progress.
- Keep the tracker PR #2 in draft until ALL units (3D–6E) are merged into it.
- Do NOT mix chain strategies: feature-branch-chain only.
