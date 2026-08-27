import { describe, it, expect } from "vitest";
import { MeasurementProfile } from "../../../../src/domain/measurements/aggregates/MeasurementProfile.js";
import { MeasurementReference } from "../../../../src/domain/measurements/entities/MeasurementReference.js";
import { DiagnosticBoardState } from "../../../../src/domain/measurements/value-objects/DiagnosticBoardState.js";

describe("MeasurementProfile (measurements suite)", () => {
  it("should optimize compound key lookups (padId, boardState)", () => {
    const profile = new MeasurementProfile({
      id: "PROF_TEST",
      boardId: "BRD_820_02106",
      title: "Test Profile",
    });

    const ref = new MeasurementReference({
      id: "REF_1",
      padId: "INT_PAD_042",
      boardState: DiagnosticBoardState.SPLIT_TOP,
      nominal: 0.480,
    });

    profile.addReference(ref);
    expect(profile.getReference("INT_PAD_042", DiagnosticBoardState.SPLIT_TOP)).toBe(ref);
  });
});
