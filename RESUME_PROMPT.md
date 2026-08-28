# Resume Prompt — BoardForge Workbench Redesign (paste into the agent on the other machine)

Paste this whole block into OpenCode on the new machine AFTER cloning, running
`pnpm install`, checking out the chain tip, and completing `/sdd-init` + the
Session Preflight (choose hybrid/both artifact store, any pace).

---

Continue the `boardforge-redesign` change. Do NOT start a new session from scratch.

## Context

1. FIRST read `HANDOFF.md` at the repo root — it is the authoritative summary of the
   delivery chain, the tracking issue/PRs, progress, and resume steps. Trust it over any
   machine-local memory (Engram on this machine is empty/local and does not carry the
   prior session's context).
2. Read `openspec/changes/boardforge-redesign/tasks-resliced.md` — this is the re-sliced
   implementation plan. Units 1, 2, 3A, 3B, 3C are already done (marked `[x] applied`).
   The next unit is **3D**.

## Current chain state

- Repo: https://github.com/JoseViccaro/BoardForge.git
- Issue: #1 (approved, `status:approved`)
- Tracker PR: #2 (draft, `feat/boardforge-workbench` → main) — KEEP DRAFT
- Chain tip branch: `feat/boardforge-workbench-05-overlay-resolve`
- Delivery: feature-branch-chain, exception-ok, 400-line review budget
- Test runner: `pnpm test` (Vitest, strict TDD, pure node tests under `tests/`)

## Task — implement unit 3D

1. Create the next unit branch off the tip:
   `git checkout feat/boardforge-workbench-05-overlay-resolve`
   `git checkout -b feat/boardforge-workbench-06-schematic-model`
2. Read unit 3D scope in `tasks-resliced.md`: **schematic-nav + schematic-pinmap cores**
   (~330 lines, 12 tests, branch `-06-schematic-model`, depends on 3C + domain
   `SchematicCrossProbeIndex`).
3. Implement with STRICT TDD (RED → GREEN). Pure cores in
   `src/ui/schematics/schematic-nav.ts` and `src/ui/schematics/schematic-pinmap.ts`,
   DOM-free, node-tested under `tests/unit/ui/schematics/`. Consume the existing
   `SchematicCrossProbeIndex` domain — do NOT redefine it. Do NOT modify `src/domain/**`.
4. Re-gate before finishing: `git diff --stat` must be ≤400 changed lines for the slice.
   Trim test edge cases (report overflow rather than accepting it) if it crosses 400.
5. Commit in reviewable work units (test + code together), conventional commits,
   NO `Co-Authored-By` trailers.
6. Run `pnpm test` — expect ~350 existing + the new 3D tests, all green.
7. Push `feat/boardforge-workbench-06-schematic-model` and open PR #7 targeting
   `feat/boardforge-workbench-05-overlay-resolve` as base, with label `type:feature`,
   body `Refs #1`, and a Chain Context section (position 3D of 15, base = -05,
   follow-up = 3E).
8. Mark unit 3D `[x] applied` in `tasks-resliced.md` and commit.

## Notes

- `npx tsc` at the repo root is CLEAN (0 errors). If you (or a sub-agent) see a
  "broken build / N pre-existing tsc errors" report, VERIFY with a direct
  `npx tsc` before treating it as real — it is a known recurring false positive.
- Keep the tracker PR #2 draft until ALL units (3D–6E) are merged into it.
- feature-branch-chain only; do not mix chain strategies.
- For every subsequent unit, follow the same pattern (new branch off the parent tip,
  re-gate ≤400 lines, PR targeting the immediate parent, update `tasks-resliced.md`).
