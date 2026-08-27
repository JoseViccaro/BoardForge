import { describe, it, expect } from "vitest";
import { DiodeReading } from "../../../src/domain/measurements/value-objects/DiodeReading.js";

describe("DiodeReading (Domain VO)", () => {
  it("should create DiodeReading and normalize volts", () => {
    const reading = new DiodeReading(0.425, false);
    expect(reading.normalizedVolts()).toBe(0.425);
  });
});
