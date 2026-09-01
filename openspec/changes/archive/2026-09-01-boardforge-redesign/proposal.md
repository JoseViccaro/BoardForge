# Proposal: BoardForge Workbench Redesign (Strategy B)

## Intent

BoardForge's MVP wedge vs. JCID-class tools is workflow integration: one synchronized workbench replacing fragmented legacy tools. The current UI (`src/App.tsx`) is a single-pane boardview demo: hardcoded iPhone 11 Pro board, no schematic panel, naive search, no measurement capture. Redesign the interface around the technician loop — open board → boardview+schematic side-by-side → navigate nets → measure → log findings — keeping the Clean/Hex/DDD backend and domain specs intact.

## Scope

### In Scope
- Workbench shell: multi-panel layout (boardview, schematic, net navigator, measurement log)
- Session orchestration: open board → resolve companion (boardview+schematic) → shared selection/net state
- Bidirectional cross-probing across panels via existing `SchematicCrossProbeIndex`
- Inline measurement capture bound to net/pin, validated against references
- Decompose `src/App.tsx`; add `src/application/workbench/` facade composing existing facades

### Out of Scope
- Data ecosystem / content flywheel (Strategy A): ingestion, contributions, governance (OD-PROD-004)
- Unified multi-field search (OD-ARCH-003) — navigator filters loaded board only
- Instruments, AI copilot, community features (Strategy D, later phases)
- Any backend/domain requirement changes

## Capabilities

### New Capabilities
- `workbench`: unified session UX — open/companion resolution, multi-panel layout, synchronized selection, measurement capture + finding log

### Modified Capabilities
- `boardview`: workbench-facing interaction requirements — selection model, net highlighting, layer controls
- `schematics`: workbench-facing page rendering + bidirectional sync
- `measurements`: capture-entry workflow (reading + board state + meter bound to net/pin)

## Approach

UX-first. Split `src/App.tsx` into shell+panels (boardview, schematic, net, measurement, status bar). Compose existing facades (catalog, boardview, schematics, measurements) behind a `WorkbenchFacade`; reuse cross-probe index and seeded iPhone 11/13 fixtures. No domain changes; strict TDD on facade, component tests on panels. Ship inside existing app shell behind a feature flag.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/App.tsx` | Modified | Monolith → shell + panel composition |
| `src/ui/` (new) | New | Workbench panels + shared components |
| `src/application/workbench/` (new) | New | `WorkbenchFacade`, session orchestration |
| `src/interfaces/http` | Modified | Companion-resolution read routes (reuse facades) |
| `src/domain` | Untouched | Explicit non-goal |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Schematic rendering from vector tokens is heavy | Med | Slice to seeded pages; raster fallback |
| Scope creep into data ecosystem | Med | Non-goals + success criteria |
| Facade composition regresses behavior | Low | Existing tests stay green; TDD |

## Rollback Plan

Frontend-only+additive facade: pure git revert — no migrations, no domain change. Legacy `App.tsx` render kept behind feature flag until slice ships.

## Dependencies

- Existing facades, cross-probe index, fixture seeds
- OD-ARCH-003 (search), OD-PROD-002/003 (parsers), OD-PROD-004 (governance) gate later phases

## Success Criteria

- [ ] Open board → side-by-side boardview+schematic in ≤ 5 interactions
- [ ] Pin/net selection on any panel highlights counterpart in all panels
- [ ] Reading captured inline validates vs reference and logs to net/pin
- [ ] All existing domain/facade tests pass unchanged

## Proposal question round

1. Companion pairing: auto-resolve by board model, or manual?
2. Schematic depth: vector-token render vs. raster images + clickable regions?
3. Search: scoped navigator for this slice — OD-ARCH-003 deferred?
4. Measurement capture: quick value+status, or full diode-mode (meter + state)?
5. Session persistence: transient per visit, or restore on reload?