import { describe, it, expect } from "vitest";
import { MeasurementReference } from "../../../src/domain/measurements/entities/MeasurementReference.js";
import { DiagnosticBoardState } from "../../../src/domain/measurements/value-objects/DiagnosticBoardState.js";
import { ToleranceWindow } from "../../../src/domain/measurements/value-objects/ToleranceWindow.js";
import { EvaluationOutcome } from "../../../src/domain/measurements/value-objects/EvaluationOutcome.js";

describe("MeasurementReference Entity", () => {
  it("should create a MeasurementReference with valid properties", () => {
    const ref = new MeasurementReference({
      id: "REF_INT_084_SPLIT_TOP",
      padId: "INT_PAD_084",
      boardState: DiagnosticBoardState.SPLIT_TOP,
      toleranceWindow: new ToleranceWindow({ nominal: 0.425, tolerancePct: 7.0 }),
      netName: "PP_VDD_MAIN",
      meterBaseline: "FLUKE_115_STANDARD",
    });

    expect(ref.id).toBe("REF_INT_084_SPLIT_TOP");
    expect(ref.padId).toBe("INT_PAD_084");
    expect(ref.boardState).toBe(DiagnosticBoardState.SPLIT_TOP);
    expect(ref.toleranceWindow.nominal).toBe(0.425);
    expect(ref.netName).toBe("PP_VDD_MAIN");
    expect(ref.meterBaseline).toBe("FLUKE_115_STANDARD");
  });

  it("should accept nominal/min/max shorthand props in constructor", () => {
    const ref = new MeasurementReference({
      id: "REF_INT_084_JOINED",
      padId: "INT_PAD_084",
      boardState: DiagnosticBoardState.JOINED_SANDWICH,
      nominal: 0.385,
      min: 0.355,
      max: 0.415,
    });

    expect(ref.toleranceWindow.nominal).toBe(0.385);
    expect(ref.toleranceWindow.min).toBe(0.355);
    expect(ref.toleranceWindow.max).toBe(0.415);
  });

  it("should evaluate a measured reading against the reference window", () => {
    const ref = new MeasurementReference({
      id: "REF_1",
      padId: "INT_PAD_084",
      boardState: DiagnosticBoardState.SPLIT_TOP,
      nominal: 0.425,
      min: 0.395,
      max: 0.455,
    });

    expect(ref.evaluate(0.418)).toBe(EvaluationOutcome.PASS);
    expect(ref.evaluate(0.012)).toBe(EvaluationOutcome.CRITICAL_LOW_OR_SHORT);
    expect(ref.calculateDeviationPct(0.418)).toBeCloseTo(-1.647, 2);
  });

  it("should throw if id or padId is missing", () => {
    expect(() => {
      new MeasurementReference({
        id: "",
        padId: "PAD_1",
        boardState: DiagnosticBoardState.SPLIT_TOP,
        nominal: 0.5,
      });
    }).toThrow("id cannot be empty");

    expect(() => {
      new MeasurementReference({
        id: "REF_1",
        padId: "",
        boardState: DiagnosticBoardState.SPLIT_TOP,
        nominal: 0.5,
      });
    }).toThrow("padId cannot be empty");
  });
});
