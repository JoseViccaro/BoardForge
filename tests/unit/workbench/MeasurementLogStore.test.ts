import { describe, it, expect } from "vitest";
import {
  MeasurementLogStore,
  type MeasurementLogEntry,
} from "../../../src/application/workbench/MeasurementLogStore.js";
import { MeasurementProfile } from "../../../src/domain/measurements/aggregates/MeasurementProfile.js";
import { MeasurementReference } from "../../../src/domain/measurements/entities/MeasurementReference.js";
import { MultimeterProfile } from "../../../src/domain/measurements/value-objects/MultimeterProfile.js";
import { DiagnosticBoardState } from "../../../src/domain/measurements/value-objects/DiagnosticBoardState.js";
import { EvaluationOutcome } from "../../../src/domain/measurements/value-objects/EvaluationOutcome.js";

const SPLIT_TOP = DiagnosticBoardState.SPLIT_TOP;

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

/** Records a reading and returns the persisted entry back. */
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

describe("MeasurementLogStore (measurements R1/R2/R3)", () => {
  it("binds a captured reading to the selected net and pin", async () => {
    const store = new MeasurementLogStore();
    const profile = makeProfile(makeRef("INT_PAD_084"));

    const entry = await record(store, profile, "INT_PAD_084", 0.42);

    expect(entry.padId).toBe("INT_PAD_084");
    expect(entry.netName).toBe("PP_VDD_MAIN");
  });

  it("stores the meter profile and board state with each reading", async () => {
    const store = new MeasurementLogStore();
    const profile = makeProfile(makeRef("INT_PAD_084"));

    const entry = await record(store, profile, "INT_PAD_084", 0.42, MultimeterProfile.SUNSHINE_DT17N);

    expect(entry.boardState).toBe(SPLIT_TOP);
    expect(entry.meterModel).toBe("SUNSHINE_DT17N");
  });

  it("normalizes the measured value by the meter offset before evaluating", async () => {
    const store = new MeasurementLogStore();
    const profile = makeProfile(makeRef("INT_PAD_084")); // nominal 0.425 [0.395,0.455]

    const entry = await record(store, profile, "INT_PAD_084", 0.38, MultimeterProfile.SUNSHINE_DT17N);

    expect(entry.measuredVolts).toBe(0.38);
    expect(entry.normalizedVolts).toBe(0.415); // 0.380 + 0.035
    expect(entry.outcome).toBe(EvaluationOutcome.PASS);
  });

  it("logs PASS and appends to the per-net history for a valid in-tolerance reading", async () => {
    const store = new MeasurementLogStore();
    const profile = makeProfile(makeRef("INT_PAD_084"));

    const entry = await record(store, profile, "INT_PAD_084", 0.418);

    expect(entry.outcome).toBe(EvaluationOutcome.PASS);
    expect(store.historyFor("INT_PAD_084")).toHaveLength(1);
  });

  it("classifies a near-ground reading as CRITICAL_LOW_OR_SHORT", async () => {
    const store = new MeasurementLogStore();
    const profile = makeProfile(makeRef("INT_PAD_084"));

    const entry = await record(store, profile, "INT_PAD_084", 0.02);

    expect(entry.outcome).toBe(EvaluationOutcome.CRITICAL_LOW_OR_SHORT);
  });

  it("classifies an open reading as OPEN_LINE_OL", async () => {
    const store = new MeasurementLogStore();
    const profile = makeProfile(makeRef("INT_PAD_084"));

    const entry = await record(store, profile, "INT_PAD_084", 2.999);

    expect(entry.outcome).toBe(EvaluationOutcome.OPEN_LINE_OL);
  });

  it("classifies a marginally out-of-tolerance reading as WARNING_DEVIATION", async () => {
    const store = new MeasurementLogStore();
    const profile = makeProfile(makeRef("INT_PAD_084")); // 7% tolerance → warning to ~0.4697

    const entry = await record(store, profile, "INT_PAD_084", 0.46);

    expect(entry.outcome).toBe(EvaluationOutcome.WARNING_DEVIATION);
  });

  it("refuses to record a reading with no matching reference", async () => {
    const store = new MeasurementLogStore();
    const profile = makeProfile(makeRef("INT_PAD_084"));

    await expect(
      store.record({
        profile,
        padId: "INT_PAD_999",
        boardState: SPLIT_TOP,
        measuredVolts: 0.4,
        meterProfile: MultimeterProfile.FLUKE_115_STANDARD,
      })
    ).rejects.toThrow("MeasurementReference");
  });

  it("returns per-pin history in chronological order", async () => {
    const store = new MeasurementLogStore();
    const profile = makeProfile(makeRef("INT_PAD_084"));

    await record(store, profile, "INT_PAD_084", 0.42, MultimeterProfile.FLUKE_115_STANDARD, "2026-01-01T00:00:00.000Z");
    await record(store, profile, "INT_PAD_084", 0.43, MultimeterProfile.FLUKE_115_STANDARD, "2026-01-01T00:00:01.000Z");
    await record(store, profile, "INT_PAD_084", 0.415, MultimeterProfile.FLUKE_115_STANDARD, "2026-01-01T00:00:02.000Z");

    const history = store.historyFor("INT_PAD_084");
    expect(history.map((e) => e.normalizedVolts)).toEqual([0.42, 0.43, 0.415]);
  });

  it("computes an UP trend across increasing readings", async () => {
    const store = new MeasurementLogStore();
    const profile = makeProfile(makeRef("INT_PAD_084"));

    await record(store, profile, "INT_PAD_084", 0.41, MultimeterProfile.FLUKE_115_STANDARD, "2026-01-01T00:00:00.000Z");
    await record(store, profile, "INT_PAD_084", 0.43, MultimeterProfile.FLUKE_115_STANDARD, "2026-01-01T00:00:01.000Z");
    await record(store, profile, "INT_PAD_084", 0.44, MultimeterProfile.FLUKE_115_STANDARD, "2026-01-01T00:00:02.000Z");

    expect(store.trendFor("INT_PAD_084")).toBe("UP");
  });

  it("computes a DOWN trend across decreasing readings", async () => {
    const store = new MeasurementLogStore();
    const profile = makeProfile(makeRef("INT_PAD_084"));

    await record(store, profile, "INT_PAD_084", 0.44, MultimeterProfile.FLUKE_115_STANDARD, "2026-01-01T00:00:00.000Z");
    await record(store, profile, "INT_PAD_084", 0.42, MultimeterProfile.FLUKE_115_STANDARD, "2026-01-01T00:00:01.000Z");
    await record(store, profile, "INT_PAD_084", 0.40, MultimeterProfile.FLUKE_115_STANDARD, "2026-01-01T00:00:02.000Z");

    expect(store.trendFor("INT_PAD_084")).toBe("DOWN");
  });

  it("reports NONE trend for a single reading or no history", async () => {
    const store = new MeasurementLogStore();
    const profile = makeProfile(makeRef("INT_PAD_084"));

    expect(store.trendFor("INT_PAD_084")).toBe("NONE");

    await record(store, profile, "INT_PAD_084", 0.42);
    expect(store.trendFor("INT_PAD_084")).toBe("NONE");
  });
});
