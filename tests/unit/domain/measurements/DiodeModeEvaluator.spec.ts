import { describe, it, expect, beforeEach } from "vitest";
import { DiodeModeEvaluator } from "../../../../src/domain/measurements/services/DiodeModeEvaluator.js";
import { MeasurementReference } from "../../../../src/domain/measurements/entities/MeasurementReference.js";
import { DiagnosticBoardState } from "../../../../src/domain/measurements/value-objects/DiagnosticBoardState.js";
import { MultimeterProfile } from "../../../../src/domain/measurements/value-objects/MultimeterProfile.js";
import { DiodeReading } from "../../../../src/domain/measurements/value-objects/DiodeReading.js";
import { EvaluationOutcome } from "../../../../src/domain/measurements/value-objects/EvaluationOutcome.js";

describe("DiodeModeEvaluator Domain Service", () => {
  let evaluator: DiodeModeEvaluator;

  beforeEach(() => {
    evaluator = new DiodeModeEvaluator();
  });

  it("should evaluate a normal reading within tolerance as PASS", () => {
    const reference = new MeasurementReference({
      id: "REF_084_TOP",
      padId: "INT_PAD_084",
      boardState: DiagnosticBoardState.SPLIT_TOP,
      nominal: 0.425,
      min: 0.395,
      max: 0.455,
      tolerancePct: 7.0,
      netName: "PP_VDD_MAIN",
    });

    const result = evaluator.evaluate(0.418, reference);

    expect(result.outcome).toBe(EvaluationOutcome.PASS);
    expect(result.isPass).toBe(true);
    expect(result.measuredVolts).toBe(0.418);
    expect(result.normalizedVolts).toBe(0.418);
    expect(result.nominalVolts).toBe(0.425);
    expect(result.deviationPct).toBeCloseTo(-1.647, 2);
    expect(result.padId).toBe("INT_PAD_084");
    expect(result.netName).toBe("PP_VDD_MAIN");
    expect(result.message).toContain("PASS");
  });

  it("should detect short circuit when reading <= 0.050V on active rail", () => {
    const reference = new MeasurementReference({
      id: "REF_084_TOP",
      padId: "INT_PAD_084",
      boardState: DiagnosticBoardState.SPLIT_TOP,
      nominal: 0.425,
      min: 0.395,
      max: 0.455,
      netName: "PP_VDD_MAIN",
    });

    const result = evaluator.evaluate(0.012, reference);

    expect(result.outcome).toBe(EvaluationOutcome.CRITICAL_LOW_OR_SHORT);
    expect(result.isPass).toBe(false);
    expect(result.measuredVolts).toBe(0.012);
    expect(result.message).toContain("Possible short circuit to ground on PP_VDD_MAIN");
  });

  it("should detect short circuit when reading is >= 50% below nominal", () => {
    const reference = new MeasurementReference({
      id: "REF_084_TOP",
      padId: "INT_PAD_084",
      boardState: DiagnosticBoardState.SPLIT_TOP,
      nominal: 0.425,
      min: 0.395,
      max: 0.455,
      netName: "PP_VDD_MAIN",
    });

    const result = evaluator.evaluate(0.200, reference);

    expect(result.outcome).toBe(EvaluationOutcome.CRITICAL_LOW_OR_SHORT);
    expect(result.isPass).toBe(false);
    expect(result.message).toContain("Possible short circuit to ground on PP_VDD_MAIN");
  });

  it("should detect open line (OL) or reading >= 2.500V on active rail", () => {
    const reference = new MeasurementReference({
      id: "REF_042_TOP",
      padId: "INT_PAD_042",
      boardState: DiagnosticBoardState.SPLIT_TOP,
      nominal: 0.480,
      min: 0.446,
      max: 0.514,
      netName: "I2C0_SDA",
    });

    // Test with DiodeReading OL
    const olReading = DiodeReading.createOpenLoop();
    const result1 = evaluator.evaluate(olReading, reference);

    expect(result1.outcome).toBe(EvaluationOutcome.OPEN_LINE_OL);
    expect(result1.isPass).toBe(false);
    expect(result1.message).toContain("Possible unseated pull-up resistor or open interposer trace");

    // Test with numeric 2.999V
    const result2 = evaluator.evaluate(2.999, reference);
    expect(result2.outcome).toBe(EvaluationOutcome.OPEN_LINE_OL);
    expect(result2.isPass).toBe(false);
  });

  it("should pass open line (OL) if reference is also expected OL", () => {
    const reference = new MeasurementReference({
      id: "REF_NC_PAD",
      padId: "INT_PAD_NC",
      boardState: DiagnosticBoardState.SPLIT_TOP,
      nominal: 2.999,
      min: 2.500,
      max: 3.000,
      netName: "NC_TEST",
    });

    const olReading = DiodeReading.createOpenLoop();
    const result = evaluator.evaluate(olReading, reference);

    expect(result.outcome).toBe(EvaluationOutcome.PASS);
    expect(result.isPass).toBe(true);
  });

  it("should apply multimeter profile calibration normalization", () => {
    const sunshine = new MultimeterProfile("SUNSHINE_DT17N", 1.0, 0.035);
    const reference = new MeasurementReference({
      id: "REF_084_TOP",
      padId: "INT_PAD_084",
      boardState: DiagnosticBoardState.SPLIT_TOP,
      nominal: 0.425,
      min: 0.395,
      max: 0.455,
      netName: "PP_VDD_MAIN",
    });

    // Reading 0.380V normalized with +0.035V -> 0.415V, which is within [0.395, 0.455]
    const readingWithProfile = new DiodeReading(0.380, false, sunshine);
    const result = evaluator.evaluate(readingWithProfile, reference);

    expect(result.measuredVolts).toBe(0.380);
    expect(result.normalizedVolts).toBe(0.415);
    expect(result.outcome).toBe(EvaluationOutcome.PASS);
    expect(result.isPass).toBe(true);

    // Also support passing profile explicitly into evaluate(number, reference, profile)
    const resultDirectProfile = evaluator.evaluate(0.380, reference, sunshine);
    expect(resultDirectProfile.normalizedVolts).toBe(0.415);
    expect(resultDirectProfile.outcome).toBe(EvaluationOutcome.PASS);
  });

  it("should classify reading between 1.0x and 1.5x of tolerance as WARNING_DEVIATION", () => {
    const reference = new MeasurementReference({
      id: "REF_100_TOP",
      padId: "INT_PAD_100",
      boardState: DiagnosticBoardState.SPLIT_TOP,
      nominal: 1.000,
      tolerancePct: 10.0, // Normal range [0.900, 1.100], warning range [0.850, 1.150]
      netName: "PP_TEST_RAIL",
    });

    const resultHigh = evaluator.evaluate(1.120, reference);
    expect(resultHigh.outcome).toBe(EvaluationOutcome.WARNING_DEVIATION);
    expect(resultHigh.isPass).toBe(false);
    expect(resultHigh.message).toContain("WARNING");

    const resultLow = evaluator.evaluate(0.880, reference);
    expect(resultLow.outcome).toBe(EvaluationOutcome.WARNING_DEVIATION);
    expect(resultLow.isPass).toBe(false);
    expect(resultLow.message).toContain("WARNING");
  });
});
