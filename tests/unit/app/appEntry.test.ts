import { describe, it, expect } from "vitest";
import { WORKBENCH_ENABLED } from "../../../src/App.js";

/**
 * Unit 6E shell finalize: the new BoardForgeShell workbench is the default app
 * entry. The legacy inline boardview render was removed and the workbench flag
 * defaults to TRUE (no VITE_WORKBENCH env required). The behavioral gate for the
 * actual render path is the full `pnpm test` + `pnpm build` suite.
 */
describe("App entry (workbench shell finalize)", () => {
  it("defaults the workbench flag to true (new shell is the default route)", () => {
    expect(WORKBENCH_ENABLED).toBe(true);
  });
});
