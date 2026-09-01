import { describe, it, expect } from "vitest";
import {
  WorkbenchSearchService,
  EvaluationOutcome,
  type SearchIndexDoc,
} from "../../../src/application/workbench/WorkbenchSearchService.js";

/**
 * Unit 5B — WorkbenchSearchService search history + symptom reference mapping
 * (RED tests).
 *
 * Extends the 5A core (4-field index + ranked search) with:
 *  - a per-session search history (newest-first, deduped, capped), with a
 *    prunable/persistable slice for session restore (search R3);
 *  - symptom reference indexing that resolves a symptom term ("short to
 *    ground") to its domain diagnostic classification
 *    (EvaluationOutcome.CRITICAL_LOW_OR_SHORT) (search R4).
 *
 * ASVS L2: every recorded/queried symptom term is user input — trimmed and
 * case-folded before indexing, never trusted verbatim.
 *
 * The existing 5A behavior (search() + 4-field index) must keep passing;
 * these tests only add behavior.
 */

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/** A symptom reference doc indexed against the search service (R4). */
const SYMPTOM_DOCS: SearchIndexDoc[] = [
  {
    field: "symptom",
    text: "short to ground",
    classification: EvaluationOutcome.CRITICAL_LOW_OR_SHORT,
    panel: "navigator",
    boardId: "BRD_820_02106",
  },
];

function buildService(docs: SearchIndexDoc[] = []): WorkbenchSearchService {
  return new WorkbenchSearchService(docs);
}

// ---------------------------------------------------------------------------
// Tests — search R3: history (newest-first, dedupe, session-restore slice)
// ---------------------------------------------------------------------------

describe("WorkbenchSearchService (search history — R3)", () => {
  it("returns history newest-first after recording several executed queries", () => {
    const service = buildService();
    service.recordSearch("VDD_MAIN");
    service.recordSearch("U2700");
    service.recordSearch("PMX60");
    expect(service.history()).toEqual(["PMX60", "U2700", "VDD_MAIN"]);
  });

  it("dedupes a repeated query, keeping a single entry at the newest position", () => {
    const service = buildService();
    service.recordSearch("VDD_MAIN");
    service.recordSearch("VDD_MAIN");
    expect(service.history()).toEqual(["VDD_MAIN"]);

    // Re-running a query rises it back to the top without duplication.
    service.recordSearch("U2700");
    service.recordSearch("VDD_MAIN");
    expect(service.history()).toEqual(["VDD_MAIN", "U2700"]);
  });

  it("returns an empty history before any search is recorded", () => {
    const service = buildService();
    expect(service.history()).toEqual([]);
  });

  it("exposes a prunable/persistable slice (newest `limit`) for session restore", () => {
    const service = buildService();
    service.recordSearch("VDD_MAIN");
    service.recordSearch("U2700");
    service.recordSearch("PMX60");
    expect(service.historySlice(2)).toEqual(["PMX60", "U2700"]);
    // Slice never mutates the underlying history.
    expect(service.history()).toHaveLength(3);

    // A persisted (newest-first) slice can be restored in place.
    const rebuilt = buildService();
    rebuilt.restoreHistory(["PMX60", "U2700", "VDD_MAIN"]);
    expect(rebuilt.history()).toEqual(["PMX60", "U2700", "VDD_MAIN"]);
  });
});

// ---------------------------------------------------------------------------
// Tests — search R4: symptom reference mapping
// ---------------------------------------------------------------------------

describe("WorkbenchSearchService (symptom reference mapping — R4)", () => {
  it("maps the symptom 'short to ground' to CRITICAL_LOW_OR_SHORT", () => {
    const service = buildService();
    expect(service.classifySymptom("short to ground")).toBe(
      EvaluationOutcome.CRITICAL_LOW_OR_SHORT
    );
    // Symptom matching is case-insensitive (ASVS L2).
    expect(service.classifySymptom("  SHORT TO GROUND  ")).toBe(
      EvaluationOutcome.CRITICAL_LOW_OR_SHORT
    );
  });

  it("returns a symptom hit carrying the diagnostic classification when searched", () => {
    const service = buildService(SYMPTOM_DOCS);
    const hits = service.search("short");
    const symptomHit = hits.find((h) => h.field === "symptom");
    expect(symptomHit).toBeDefined();
    expect(symptomHit?.classification).toBe(
      EvaluationOutcome.CRITICAL_LOW_OR_SHORT
    );
  });

  it("no-ops on a symptom term with no recorded classification", () => {
    const service = buildService();
    expect(service.classifySymptom("zzz-not-a-symptom")).toBeUndefined();
    // Searching an unmatched symptom term yields no symptom hits.
    expect(service.search("zzz-not-a-symptom")).toEqual([]);
  });
});
