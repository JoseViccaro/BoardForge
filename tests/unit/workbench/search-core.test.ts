import { describe, it, expect } from "vitest";
import {
  WorkbenchSearchService,
  type SearchIndexDoc,
} from "../../../src/application/workbench/WorkbenchSearchService.js";

/**
 * Unit 5A — WorkbenchSearchService 4-field in-memory index + rank + context
 * (RED tests).
 *
 * Replaces the PR 1 stub with a real search over the loaded session: nets,
 * component designators, and part numbers. Hits carry panel + board context
 * (search R2) and are ranked by match quality (exact > prefix > substring).
 *
 * ASVS L2: the query is user input — every test verifies the raw input is
 * normalized (trim + case-fold) before matching and never trusted verbatim.
 */

// ---------------------------------------------------------------------------
// Fixtures: a small deterministic iPhone 13 style index snapshot
// ---------------------------------------------------------------------------

const DOCS: SearchIndexDoc[] = [
  // Nets (boardview + schematic panels)
  {
    field: "net",
    text: "PP_VDD_MAIN",
    panel: "boardview",
    boardId: "BRD_820_02106",
    netName: "PP_VDD_MAIN",
  },
  {
    field: "net",
    text: "PP_VDD_MAIN",
    panel: "schematic",
    boardId: "BRD_820_02106",
    netName: "PP_VDD_MAIN",
  },
  {
    field: "net",
    text: "PP_VDD_CPU_CORE",
    panel: "boardview",
    boardId: "BRD_820_02106",
    netName: "PP_VDD_CPU_CORE",
  },
  {
    field: "net",
    text: "I2C0_SDA",
    panel: "boardview",
    boardId: "BRD_820_02106",
    netName: "I2C0_SDA",
  },
  // Component designator (schematic panel)
  {
    field: "designator",
    text: "U2700",
    panel: "schematic",
    boardId: "BRD_820_02106",
  },
  // Component part numbers (boardview panel)
  {
    field: "partNumber",
    text: "PMX60",
    panel: "boardview",
    boardId: "BRD_820_02106",
  },
  {
    field: "partNumber",
    text: "A15",
    panel: "boardview",
    boardId: "BRD_820_02106",
  },
];

function buildService(docs: SearchIndexDoc[] = DOCS): WorkbenchSearchService {
  return new WorkbenchSearchService(docs);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("WorkbenchSearchService (search core)", () => {
  describe("search R1 — multi-field unified search", () => {
    it("substring search: 'VDD_MAIN' finds net PP_VDD_MAIN", () => {
      const hits = buildService().search("VDD_MAIN");
      expect(hits.length).toBeGreaterThan(0);
      expect(hits.map((h) => h.label)).toContain("PP_VDD_MAIN");
      expect(hits.every((h) => h.field === "net")).toBe(true);
      expect(hits.some((h) => h.netName === "PP_VDD_MAIN")).toBe(true);
    });

    it("designator search: 'U2700' finds component U2700 in the schematic panel", () => {
      const hits = buildService().search("U2700");
      expect(hits.length).toBeGreaterThan(0);
      const designatorHit = hits.find((h) => h.field === "designator");
      expect(designatorHit?.label).toBe("U2700");
      expect(designatorHit?.panel).toBe("schematic");
    });

    it("part number search: 'PMX60' finds component by part number", () => {
      const hits = buildService().search("PMX60");
      expect(hits.length).toBeGreaterThan(0);
      const partHit = hits.find((h) => h.field === "partNumber");
      expect(partHit?.label).toBe("PMX60");
      expect(partHit?.boardId).toBe("BRD_820_02106");
    });
  });

  describe("search R2 — results carry panel + board context", () => {
    it("results carry their panel and board origin", () => {
      const hits = buildService().search("VDD");
      expect(hits.length).toBeGreaterThan(0);
      for (const hit of hits) {
        expect(["boardview", "schematic", "navigator"]).toContain(hit.panel);
        expect(hit.boardId).toBe("BRD_820_02106");
      }
      // PP_VDD_MAIN appears on both boardview and schematic panels (R2 context)
      const boards = new Set(hits.map((h) => h.panel));
      expect(boards.has("boardview")).toBe(true);
      expect(boards.has("schematic")).toBe(true);
    });
  });

  describe("ranking", () => {
    it("ranks exact matches before prefix and substring matches", () => {
      const docs: SearchIndexDoc[] = [
        { field: "net", text: "PP_VDD_MAIN", panel: "boardview", boardId: "B" },
        { field: "net", text: "PP_VDD", panel: "boardview", boardId: "B" },
        { field: "net", text: "XP_PP_VDD_AUX", panel: "boardview", boardId: "B" },
      ];
      const hits = buildService(docs).search("PP_VDD");
      // Exact "PP_VDD" must come first, then the prefix "PP_VDD_MAIN",
      // then the substring "XP_VDD_Y".
      expect(hits.map((h) => h.label)).toEqual([
        "PP_VDD",
        "PP_VDD_MAIN",
        "XP_PP_VDD_AUX",
      ]);
    });
  });

  describe("incremental-as-typed (R2)", () => {
    it("returns results incrementally as the query grows, before submit", () => {
      const service = buildService();
      const broad = service.search("pp_v");
      expect(broad.some((h) => h.label === "PP_VDD_MAIN")).toBe(true);
      expect(broad.some((h) => h.label === "PP_VDD_CPU_CORE")).toBe(true);

      const narrow = service.search("pp_vdd_cp");
      expect(narrow.map((h) => h.label)).toContain("PP_VDD_CPU_CORE");
      expect(narrow.map((h) => h.label)).not.toContain("PP_VDD_MAIN");
    });
  });

  describe("empty / no-match", () => {
    it("empty or whitespace-only query returns no hits", () => {
      const service = buildService();
      expect(service.search("")).toHaveLength(0);
      expect(service.search("   ")).toHaveLength(0);
    });

    it("no matching record returns an empty result", () => {
      expect(buildService().search("ZZZ_NOT_PRESENT")).toHaveLength(0);
    });
  });

  describe("normalization (ASVS L2)", () => {
    it("trims surrounding whitespace from the raw query", () => {
      const hits = buildService().search("  vdd_main  ");
      expect(hits.length).toBeGreaterThan(0);
      expect(hits.map((h) => h.label)).toContain("PP_VDD_MAIN");
    });

    it("case-folds the raw query before matching (never trusts raw input)", () => {
      const service = buildService();
      // Lowercase "u2700" must resolve to the indexed "U2700" designator
      expect(service.search("u2700").some((h) => h.label === "U2700")).toBe(true);
      // Mixed-case "VdD_mAiN" resolves to the net too
      expect(service.search("VdD_mAiN").some((h) => h.label === "PP_VDD_MAIN")).toBe(true);
    });
  });

  describe("substring / prefix matching across fields", () => {
    it("matches substring and prefix across different fields", () => {
      const service = buildService();
      // Substring in a part number token
      expect(service.search("MX6").some((h) => h.label === "PMX60")).toBe(true);
      // Prefix in a net
      expect(service.search("I2C").some((h) => h.label === "I2C0_SDA")).toBe(true);
    });
  });
});
