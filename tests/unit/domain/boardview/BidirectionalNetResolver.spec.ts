import { describe, it, expect } from "vitest";
import { BidirectionalNetResolver } from "../../../../src/domain/boardview/services/BidirectionalNetResolver.js";
import { NetTopology } from "../../../../src/domain/boardview/aggregates/NetTopology.js";
import { InterposerJunction } from "../../../../src/domain/boardview/value-objects/InterposerJunction.js";
import { NetClassification } from "../../../../src/domain/boardview/value-objects/NetClassification.js";

describe("BidirectionalNetResolver", () => {
  it("should resolve full cross-board path from top pin through interposer to bottom pin", () => {
    const topology = new NetTopology({
      id: "NET_PP_VDD_MAIN_820_02106",
      canonicalNetName: "PP_VDD_MAIN",
      classification: NetClassification.POWER_MAIN,
      localPins: [
        { subBoardId: "SUB_TOP", padId: "TOP_U2700_A12", pinRef: "U2700.A12" },
        { subBoardId: "SUB_BOT", padId: "BOT_UBBPMU_C4", pinRef: "U_BB_PMU.C4" },
      ],
      interposerJunctions: [
        new InterposerJunction({
          junctionId: "JUNC_084",
          interposerPadId: "INT_PAD_084",
          topPadId: "TOP_U2700_A12",
          bottomPadId: "BOT_UBBPMU_C4",
          canonicalNetName: "PP_VDD_MAIN",
          classification: NetClassification.POWER_MAIN,
        }),
      ],
    });

    const resolver = new BidirectionalNetResolver();
    const resolution = resolver.resolvePath(topology, "TOP_U2700_A12");

    expect(resolution).toBeDefined();
    expect(resolution.canonicalNetName).toBe("PP_VDD_MAIN");
    expect(resolution.classification).toBe(NetClassification.POWER_MAIN);
    expect(resolution.interposerPadId).toBe("INT_PAD_084");
    expect(resolution.originPadId).toBe("TOP_U2700_A12");
    expect(resolution.connectedPins).toHaveLength(1);
    expect(resolution.connectedPins[0].padId).toBe("BOT_UBBPMU_C4");
    expect(resolution.connectedPins[0].pinRef).toBe("U_BB_PMU.C4");
  });

  it("should resolve cross-board path starting from Interposer pad", () => {
    const topology = new NetTopology({
      id: "NET_PP_VDD_MAIN_820_02106",
      canonicalNetName: "PP_VDD_MAIN",
      classification: NetClassification.POWER_MAIN,
      localPins: [
        { subBoardId: "SUB_TOP", padId: "TOP_U2700_A12", pinRef: "U2700.A12" },
        { subBoardId: "SUB_BOT", padId: "BOT_UBBPMU_C4", pinRef: "U_BB_PMU.C4" },
      ],
      interposerJunctions: [
        new InterposerJunction({
          junctionId: "JUNC_084",
          interposerPadId: "INT_PAD_084",
          topPadId: "TOP_U2700_A12",
          bottomPadId: "BOT_UBBPMU_C4",
          canonicalNetName: "PP_VDD_MAIN",
          classification: NetClassification.POWER_MAIN,
        }),
      ],
    });

    const resolver = new BidirectionalNetResolver();
    const resolution = resolver.resolveFromInterposerPad(topology, "INT_PAD_084");

    expect(resolution).toBeDefined();
    expect(resolution?.canonicalNetName).toBe("PP_VDD_MAIN");
    expect(resolution?.connectedPins).toHaveLength(2);
  });
});
