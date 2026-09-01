import { describe, it, expect } from "vitest";
import {
  MeasurementLogStore,
  type MeasurementLogEntry,
} from "../../../src/application/workbench/MeasurementLogStore.js";
import type { IMeasurementStoragePort } from "../../../src/application/workbench/MeasurementLogStore.js";
import { MeasurementProfile } from "../../../src/domain/measurements/aggregates/MeasurementProfile.js";
import { MeasurementReference } from "../../../src/domain/measurements/entities/MeasurementReference.js";
import { MultimeterProfile } from "../../../src/domain/measurements/value-objects/MultimeterProfile.js";
import { DiagnosticBoardState } from "../../../src/domain/measurements/value-objects/DiagnosticBoardState.js";
import { EvaluationOutcome } from "../../../src/domain/measurements/value-objects/EvaluationOutcome.js";

const SPLIT_TOP = DiagnosticBoardState.SPLIT_TOP;

/* ── test helpers (shared with 6A tests) ── */

function makeRef(
  padId: string,
  opts: { nominal: number; min: number; max: number; netName?: string } = {
    nominal: 0.425,
    min: 0.395,
    max: 0.455,
  }
): MeasurementReference {
  return new MeasurementReference({
    id: `REF_${padId}`,
    padId,
    boardState: SPLIT_TOP,
    nominal: opts.nominal,
    min: opts.min,
    max: opts.max,
    netName: opts.netName ?? "PP_VDD_MAIN",
  });
}

function makeProfile(...refs: MeasurementReference[]): MeasurementProfile {
  return new MeasurementProfile({
    id: "PROF_IPHONE13",
    boardId: "BRD_820_02106",
    title: "iPhone13 Diode Baseline",
    references: refs,
  });
}

async function record(
  store: MeasurementLogStore,
  profile: MeasurementProfile,
  padId: string,
  measuredVolts: number,
  meter: MultimeterProfile = MultimeterProfile.FLUKE_115_STANDARD,
  recordedAt?: string
): Promise<MeasurementLogEntry> {
  return store.record({
    profile,
    padId,
    boardState: SPLIT_TOP,
    measuredVolts,
    meterProfile: meter,
    recordedAt,
  });
}

/* ── in-memory port fake for IndexedDB roundtrip tests ── */

class FakeStoragePort implements IMeasurementStoragePort {
  private readonly map = new Map<string, string>();

  async read(key: string): Promise<string | null> {
    return this.map.get(key) ?? null;
  }

  async write(key: string, value: string): Promise<void> {
    this.map.set(key, value);
  }
}

/* ════════════════════════════════════════════════════════════════════════
   Unit 6B — Export CSV/JSON + IndexedDB persistence (measurements R4, session R2)
   ════════════════════════════════════════════════════════════════════════ */

describe("MeasurementLogStore — export + persistence (6B)", () => {
  /* ── CSV export ── */

  it("exports entries as CSV with a header row and one data row per entry", async () => {
    const store = new MeasurementLogStore();
    const profile = makeProfile(makeRef("INT_PAD_084"));

    await record(store, profile, "INT_PAD_084", 0.42, MultimeterProfile.FLUKE_115_STANDARD, "2026-01-01T00:00:00.000Z");
    await record(store, profile, "INT_PAD_084", 0.44, MultimeterProfile.FLUKE_115_STANDARD, "2026-01-01T00:00:01.000Z");

    const csv = store.exportCSV();
    const lines = csv.split("\n");

    // Header + 2 data rows
    expect(lines.length).toBe(3);
    // Header contains expected columns
    expect(lines[0]).toContain("padId");
    expect(lines[0]).toContain("netName");
    expect(lines[0]).toContain("outcome");
    expect(lines[0]).toContain("measuredVolts");
    expect(lines[0]).toContain("normalizedVolts");
    expect(lines[0]).toContain("recordedAt");
    expect(lines[0]).toContain("boardState");
    expect(lines[0]).toContain("meterModel");
    // Data rows contain the pad id
    expect(lines[1]).toContain("INT_PAD_084");
    expect(lines[2]).toContain("INT_PAD_084");
  });

  it("exports an empty log as header-only CSV", () => {
    const store = new MeasurementLogStore();
    const csv = store.exportCSV();
    const lines = csv.split("\n").filter((l) => l.length > 0);
    expect(lines.length).toBe(1); // header only
    expect(lines[0]).toContain("padId");
  });

  /* ── JSON export ── */

  it("exports entries as a JSON array with full fidelity", async () => {
    const store = new MeasurementLogStore();
    const profile = makeProfile(makeRef("INT_PAD_084"));

    await record(store, profile, "INT_PAD_084", 0.42, MultimeterProfile.FLUKE_115_STANDARD, "2026-01-01T00:00:00.000Z");

    const json = store.exportJSON();
    const parsed: MeasurementLogEntry[] = JSON.parse(json);

    expect(parsed).toHaveLength(1);
    expect(parsed[0].padId).toBe("INT_PAD_084");
    expect(parsed[0].outcome).toBe(EvaluationOutcome.PASS);
    expect(parsed[0].measuredVolts).toBe(0.42);
    expect(parsed[0].boardState).toBe(SPLIT_TOP);
    expect(parsed[0].meterModel).toBe("FLUKE_115_STANDARD");
  });

  it("exports an empty log as an empty JSON array", () => {
    const store = new MeasurementLogStore();
    const parsed = JSON.parse(store.exportJSON());
    expect(parsed).toEqual([]);
  });

  /* ── CSV injection sanitization (ASVS L2) ── */

  it("sanitizes CSV values that could trigger formula injection (=,+,-,@) by prefixing with single quote", async () => {
    const store = new MeasurementLogStore();
    // We need a netName that starts with a formula-injection character.
    // Since netName comes from the reference, we create a ref with such a net.
    const ref = makeRef("PAD_X", { nominal: 0.425, min: 0.395, max: 0.455, netName: "=CMD|calc!A1" });
    const profile = makeProfile(ref);

    await record(store, profile, "PAD_X", 0.42, MultimeterProfile.FLUKE_115_STANDARD, "2026-01-01T00:00:00.000Z");

    const csv = store.exportCSV();
    const lines = csv.split("\n");
    // The data row should have the netName sanitized
    expect(lines[1]).toContain("'=CMD|calc!A1");
    // Should NOT contain the raw =CMD (without quote prefix)
    expect(lines[1]).not.toMatch(/(^|,)=CMD/);
  });

  it("sanitizes leading +, -, @ in CSV field values per ASVS L2", async () => {
    const store = new MeasurementLogStore();
    // net names starting with formula-trigger characters
    const refs = [
      makeRef("PAD_A", { nominal: 0.425, min: 0.395, max: 0.455, netName: "+5V_RAIL" }),
      makeRef("PAD_B", { nominal: 0.425, min: 0.395, max: 0.455, netName: "-12V_SUPPLY" }),
      makeRef("PAD_C", { nominal: 0.425, min: 0.395, max: 0.455, netName: "@metadata" }),
    ];
    const profile = makeProfile(...refs);

    await record(store, profile, "PAD_A", 0.42, MultimeterProfile.FLUKE_115_STANDARD, "2026-01-01T00:00:00.000Z");
    await record(store, profile, "PAD_B", 0.43, MultimeterProfile.FLUKE_115_STANDARD, "2026-01-01T00:00:01.000Z");
    await record(store, profile, "PAD_C", 0.44, MultimeterProfile.FLUKE_115_STANDARD, "2026-01-01T00:00:02.000Z");

    const csv = store.exportCSV();
    // Each sanitized net should be prefixed with '
    expect(csv).toContain("'+5V_RAIL");
    expect(csv).toContain("'-12V_SUPPLY");
    expect(csv).toContain("'@metadata");
  });

  /* ── save/load roundtrip ── */

  it("roundtrips entries through save → load preserving all fields and order", async () => {
    const port = new FakeStoragePort();

    // Record two entries into a fresh store
    const original = new MeasurementLogStore();
    const profile = makeProfile(makeRef("INT_PAD_084"), makeRef("INT_PAD_085", { nominal: 0.425, min: 0.395, max: 0.455, netName: "PP_VDD_CORE" }));

    await record(original, profile, "INT_PAD_084", 0.42, MultimeterProfile.FLUKE_115_STANDARD, "2026-01-01T00:00:00.000Z");
    await record(original, profile, "INT_PAD_085", 0.50, MultimeterProfile.SUNSHINE_DT17N, "2026-01-01T00:00:01.000Z");
    await record(original, profile, "INT_PAD_084", 0.43, MultimeterProfile.FLUKE_115_STANDARD, "2026-01-01T00:00:02.000Z");

    // Save
    await original.save(port, "test-meas");

    // Load into a new store
    const restored = new MeasurementLogStore();
    const loaded = await restored.load(port, "test-meas");

    expect(loaded).toBe(true);

    // All entries restored
    const history084 = restored.historyFor("INT_PAD_084");
    const history085 = restored.historyFor("INT_PAD_085");

    expect(history084).toHaveLength(2);
    expect(history085).toHaveLength(1);

    // Fields preserved
    expect(history084[0].measuredVolts).toBe(0.42);
    expect(history084[0].netName).toBe("PP_VDD_MAIN");
    expect(history084[0].outcome).toBe(EvaluationOutcome.PASS);
    expect(history084[0].boardState).toBe(SPLIT_TOP);
    expect(history084[0].meterModel).toBe("FLUKE_115_STANDARD");

    expect(history085[0].netName).toBe("PP_VDD_CORE");
    expect(history085[0].meterModel).toBe("SUNSHINE_DT17N");

    // Order preserved
    expect(history084[0].recordedAt).toBe("2026-01-01T00:00:00.000Z");
    expect(history084[1].recordedAt).toBe("2026-01-01T00:00:02.000Z");

    // Trend still works after restore
    expect(restored.trendFor("INT_PAD_084")).toBe("UP");
  });

  it("returns false from load when no data exists at the key", async () => {
    const port = new FakeStoragePort();
    const store = new MeasurementLogStore();
    const loaded = await store.load(port, "nonexistent-key");

    expect(loaded).toBe(false);
    expect(store.historyFor("INT_PAD_084")).toHaveLength(0);
  });
});
