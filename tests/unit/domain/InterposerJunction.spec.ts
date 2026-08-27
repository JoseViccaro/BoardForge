import { describe, it, expect } from "vitest";
import { InterposerJunction } from "../../../src/domain/boardview/value-objects/InterposerJunction.js";
import { NetClassification } from "../../../src/domain/boardview/value-objects/NetClassification.js";

describe("InterposerJunction (Domain VO)", () => {
  it("should create InterposerJunction and identify bridge status", () => {
    const junction = new InterposerJunction({
      junctionId: "JUNC_084",
      interposerPadId: "INT_PAD_084",
      topPadId: "TOP_PAD_01",
      bottomPadId: "BOT_PAD_01",
      canonicalNetName: "PP_VDD_MAIN",
      classification: NetClassification.POWER_MAIN,
    });
    expect(junction.isBridge()).toBe(true);
  });
});
