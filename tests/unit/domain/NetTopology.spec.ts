import { describe, it, expect } from "vitest";
import { NetTopology } from "../../../src/domain/boardview/aggregates/NetTopology.js";
import { InterposerJunction } from "../../../src/domain/boardview/value-objects/InterposerJunction.js";
import { NetClassification } from "../../../src/domain/boardview/value-objects/NetClassification.js";

describe("NetTopology Aggregate", () => {
  it("should create NetTopology and register pin bindings & junctions", () => {
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

    expect(topology.canonicalNetName).toBe("PP_VDD_MAIN");
    expect(topology.classification).toBe(NetClassification.POWER_MAIN);
    expect(topology.localPins).toHaveLength(2);
    expect(topology.interposerJunctions).toHaveLength(1);
  });

  it("should resolve connected pins bidirectionally from Top board pin", () => {
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

    const connected = topology.resolveConnectedPins("SUB_TOP", "TOP_U2700_A12");
    expect(connected).toEqual([
      { subBoardId: "SUB_BOT", padId: "BOT_UBBPMU_C4", pinRef: "U_BB_PMU.C4" },
    ]);
  });

  it("should resolve all pins and net metadata from interposer pad ID", () => {
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

    const result = topology.resolveFromInterposerPad("INT_PAD_084");
    expect(result).toBeDefined();
    expect(result?.canonicalNetName).toBe("PP_VDD_MAIN");
    expect(result?.classification).toBe(NetClassification.POWER_MAIN);
    expect(result?.connectedPads).toHaveLength(2);
    expect(result?.connectedPads.map((p) => p.padId)).toContain("TOP_U2700_A12");
    expect(result?.connectedPads.map((p) => p.padId)).toContain("BOT_UBBPMU_C4");
  });

  it("should return undefined when resolving unknown interposer pad", () => {
    const topology = new NetTopology({
      id: "NET_1",
      canonicalNetName: "PP_1",
      classification: NetClassification.POWER_MAIN,
    });

    expect(topology.resolveFromInterposerPad("UNKNOWN_PAD")).toBeUndefined();
  });
});
