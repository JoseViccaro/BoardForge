import { describe, it, expect } from "vitest";
import { ToleranceWindow } from "../../../src/domain/measurements/value-objects/ToleranceWindow.js";
import { EvaluationOutcome } from "../../../src/domain/measurements/value-objects/EvaluationOutcome.js";

describe("ToleranceWindow (Domain VO)", () => {
  it("should evaluate nominal reading correctly", () => {
    const window = new ToleranceWindow({ nominal: 0.425, tolerancePct: 7.0 });
    expect(window.evaluate(0.425)).toBe(EvaluationOutcome.PASS);
  });
});
