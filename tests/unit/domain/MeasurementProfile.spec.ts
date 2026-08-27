import { describe, it, expect } from "vitest";
import { MeasurementProfile } from "../../../src/domain/measurements/aggregates/MeasurementProfile.js";
import { MeasurementReference } from "../../../src/domain/measurements/entities/MeasurementReference.js";
import { DiagnosticBoardState } from "../../../src/domain/measurements/value-objects/DiagnosticBoardState.js";
import { BoardId } from "../../../src/domain/catalog/value-objects/BoardId.js";

describe("MeasurementProfile Aggregate", () => {
  it("should create a MeasurementProfile with baseline", () => {
    const profile = new MeasurementProfile({
      id: "PROF_IPHONE13_820_02106",
      boardId: new BoardId("BRD_820_02106"),
      title: "iPhone 13 Golden Diagnostic Profile",
      baseline: "FLUKE_115_STANDARD",
    });

    expect(profile.id).toBe("PROF_IPHONE13_820_02106");
    expect(profile.boardId.value).toBe("BRD_820_02106");
    expect(profile.title).toBe("iPhone 13 Golden Diagnostic Profile");
    expect(profile.baseline).toBe("FLUKE_115_STANDARD");
    expect(profile.references).toEqual([]);
  });

  it("should register multi-state reference readings and retrieve by (padId, state)", () => {
    const profile = new MeasurementProfile({
      id: "PROF_1",
      boardId: "BRD_820_02106",
      title: "iPhone 13 Profile",
    });

    const refSplitTop = new MeasurementReference({
      id: "REF_084_SPLIT_TOP",
      padId: "INT_PAD_084",
      boardState: DiagnosticBoardState.SPLIT_TOP,
      nominal: 0.425,
      netName: "PP_VDD_MAIN",
    });

    const refJoined = new MeasurementReference({
      id: "REF_084_JOINED",
      padId: "INT_PAD_084",
      boardState: DiagnosticBoardState.JOINED_SANDWICH,
      nominal: 0.380,
      netName: "PP_VDD_MAIN",
    });

    const refSplitBottom = new MeasurementReference({
      id: "REF_084_SPLIT_BOT",
      padId: "INT_PAD_084",
      boardState: DiagnosticBoardState.SPLIT_BOTTOM,
      nominal: 0.490,
      netName: "PP_VDD_MAIN",
    });

    const refSocket = new MeasurementReference({
      id: "REF_084_SOCKET",
      padId: "INT_PAD_084",
      boardState: DiagnosticBoardState.SOCKET_FIXTURE,
      nominal: 0.385,
      netName: "PP_VDD_MAIN",
    });

    profile.addReference(refSplitTop);
    profile.addReference(refJoined);
    profile.addReference(refSplitBottom);
    profile.addReference(refSocket);

    expect(profile.references).toHaveLength(4);

    const foundSplitTop = profile.getReference("INT_PAD_084", DiagnosticBoardState.SPLIT_TOP);
    expect(foundSplitTop?.nominal).toBe(0.425);

    const foundJoined = profile.getReference("INT_PAD_084", DiagnosticBoardState.JOINED_SANDWICH);
    expect(foundJoined?.nominal).toBe(0.380);

    const allForPad = profile.getAllReferencesForPad("INT_PAD_084");
    expect(allForPad).toHaveLength(4);

    const allForState = profile.getAllReferencesForState(DiagnosticBoardState.SPLIT_TOP);
    expect(allForState).toHaveLength(1);
    expect(allForState[0].padId).toBe("INT_PAD_084");
  });

  it("should return undefined when querying non-existent reference", () => {
    const profile = new MeasurementProfile({
      id: "PROF_1",
      boardId: "BRD_820_02106",
      title: "iPhone 13 Profile",
    });

    expect(profile.getReference("PAD_NONEXISTENT", DiagnosticBoardState.SPLIT_TOP)).toBeUndefined();
  });
});
