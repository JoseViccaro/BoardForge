import { describe, it, expect } from "vitest";
import { DiagnosticBoardState } from "../../../../src/domain/measurements/value-objects/DiagnosticBoardState.js";
import { MultimeterProfile } from "../../../../src/domain/measurements/value-objects/MultimeterProfile.js";
import { DiodeReading } from "../../../../src/domain/measurements/value-objects/DiodeReading.js";
import { ToleranceWindow } from "../../../../src/domain/measurements/value-objects/ToleranceWindow.js";
import { EvaluationOutcome } from "../../../../src/domain/measurements/value-objects/EvaluationOutcome.js";

describe("Measurements Value Objects", () => {
  describe("DiagnosticBoardState", () => {
    it("should define valid diagnostic board states", () => {
      expect(DiagnosticBoardState.SPLIT_TOP).toBe("SPLIT_TOP");
      expect(DiagnosticBoardState.SPLIT_BOTTOM).toBe("SPLIT_BOTTOM");
      expect(DiagnosticBoardState.JOINED_SANDWICH).toBe("JOINED_SANDWICH");
      expect(DiagnosticBoardState.SOCKET_FIXTURE).toBe("SOCKET_FIXTURE");
    });
  });

  describe("MultimeterProfile", () => {
    it("should create profile and compute calibrated normalization", () => {
      const profile = new MultimeterProfile("SUNSHINE_DT17N", 1.0, 0.035);
      expect(profile.name).toBe("SUNSHINE_DT17N");
      expect(profile.scaleFactor).toBe(1.0);
      expect(profile.offsetVolts).toBe(0.035);

      const normalized = profile.normalize(0.380);
      expect(normalized).toBe(0.415);
    });

    it("should provide default FLUKE_115_STANDARD baseline", () => {
      const fluke = MultimeterProfile.FLUKE_115_STANDARD;
      expect(fluke.name).toBe("FLUKE_115_STANDARD");
      expect(fluke.normalize(0.425)).toBe(0.425);
    });
  });

  describe("DiodeReading", () => {
    it("should calculate normalized voltage without meter profile", () => {
      const reading = new DiodeReading(0.425, false);
      expect(reading.forwardVoltageVolts).toBe(0.425);
      expect(reading.isOpenLoop).toBe(false);
      expect(reading.normalizedVolts()).toBe(0.425);
    });

    it("should calculate normalized voltage with meter profile", () => {
      const sunshine = new MultimeterProfile("SUNSHINE_DT17N", 1.0, 0.035);
      const reading = new DiodeReading(0.380, false, sunshine);
      expect(reading.normalizedVolts()).toBe(0.415);
    });

    it("should handle Open Loop (OL)", () => {
      const reading = DiodeReading.createOpenLoop();
      expect(reading.isOpenLoop).toBe(true);
      expect(reading.forwardVoltageVolts).toBe(2.999);
      expect(reading.normalizedVolts()).toBe(2.999);
    });

    it("should reject negative voltage readings", () => {
      expect(() => new DiodeReading(-0.1, false)).toThrow("forwardVoltageVolts cannot be negative");
    });
  });

  describe("ToleranceWindow", () => {
    it("should create tolerance window with automatic min/max based on tolerancePct", () => {
      const window = new ToleranceWindow({ nominal: 0.425, tolerancePct: 7.0 });
      expect(window.nominal).toBe(0.425);
      expect(window.tolerancePct).toBe(7.0);
      expect(window.min).toBeCloseTo(0.39525, 4);
      expect(window.max).toBeCloseTo(0.45475, 4);
    });

    it("should create tolerance window with explicit min/max", () => {
      const window = new ToleranceWindow({ nominal: 0.425, min: 0.395, max: 0.455 });
      expect(window.nominal).toBe(0.425);
      expect(window.min).toBe(0.395);
      expect(window.max).toBe(0.455);
    });

    it("should evaluate normal reading within bounds as PASS", () => {
      const window = new ToleranceWindow({ nominal: 0.425, min: 0.395, max: 0.455 });
      expect(window.evaluate(0.418)).toBe(EvaluationOutcome.PASS);
      expect(window.calculateDeviationPct(0.418)).toBeCloseTo(-1.647, 2);
    });

    it("should evaluate short reading <= 0.050V as CRITICAL_LOW_OR_SHORT", () => {
      const window = new ToleranceWindow({ nominal: 0.425, min: 0.395, max: 0.455 });
      expect(window.evaluate(0.012)).toBe(EvaluationOutcome.CRITICAL_LOW_OR_SHORT);
    });

    it("should evaluate reading >= 50% below nominal as CRITICAL_LOW_OR_SHORT", () => {
      const window = new ToleranceWindow({ nominal: 0.425, min: 0.395, max: 0.455 });
      expect(window.evaluate(0.200)).toBe(EvaluationOutcome.CRITICAL_LOW_OR_SHORT);
    });

    it("should evaluate OL or reading >= 2.500V as OPEN_LINE_OL when nominal is active", () => {
      const window = new ToleranceWindow({ nominal: 0.425, min: 0.395, max: 0.455 });
      expect(window.evaluate(2.999)).toBe(EvaluationOutcome.OPEN_LINE_OL);
    });

    it("should evaluate deviation between 1.0x and 1.5x of tolerance as WARNING_DEVIATION", () => {
      // nominal 1.000V, tolerance 10% (0.900V - 1.100V). 1.5x tolerance is 15% (0.850V - 1.150V)
      const window = new ToleranceWindow({ nominal: 1.000, tolerancePct: 10.0 });
      expect(window.evaluate(1.120)).toBe(EvaluationOutcome.WARNING_DEVIATION);
      expect(window.evaluate(0.880)).toBe(EvaluationOutcome.WARNING_DEVIATION);
    });
  });
});
