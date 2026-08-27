import { describe, it, expect, beforeEach } from "vitest";
import { NetTopology } from "../../../src/domain/boardview/aggregates/NetTopology.js";
import { NetClassification } from "../../../src/domain/boardview/value-objects/NetClassification.js";
import { InterposerJunction } from "../../../src/domain/boardview/value-objects/InterposerJunction.js";
import { INetTopologyRepository } from "../../../src/domain/boardview/repositories/INetTopologyRepository.js";
import { ResolveNetPathQuery, ResolveNetCrossJunctionHandler } from "../../../src/application/boardview/queries/ResolveNetCrossJunctionHandler.js";

class MockNetTopologyRepository implements INetTopologyRepository {
  private topologies = new Map<string, NetTopology>();

  async findById(id: string): Promise<NetTopology | null> {
    return this.topologies.get(id) ?? null;
  }

  async findByCanonicalNetName(boardId: string, netName: string): Promise<NetTopology | null> {
    for (const t of this.topologies.values()) {
      if (t.canonicalNetName === netName) return t;
    }
    return null;
  }

  async findByPadId(boardId: string, padId: string): Promise<NetTopology | null> {
    for (const t of this.topologies.values()) {
      const hasLocal = t.localPins.some((p) => p.padId === padId);
      const hasJunc = t.interposerJunctions.some(
        (j) => j.interposerPadId === padId || j.topPadId === padId || j.bottomPadId === padId
      );
      if (hasLocal || hasJunc) return t;
    }
    return null;
  }

  async save(topology: NetTopology): Promise<void> {
    this.topologies.set(topology.id, topology);
  }
}

describe("ResolveNetCrossJunctionHandler", () => {
  let repository: MockNetTopologyRepository;
  let handler: ResolveNetCrossJunctionHandler;

  beforeEach(() => {
    repository = new MockNetTopologyRepository();
    handler = new ResolveNetCrossJunctionHandler(repository);
  });

  it("should resolve net path across interposer junction when given a top pad", async () => {
    const topology = new NetTopology({
      id: "NET_VDD_MAIN",
      canonicalNetName: "PP_VDD_MAIN",
      classification: NetClassification.POWER_MAIN,
      localPins: [
        { subBoardId: "SUB_TOP_AP", padId: "TOP_U2700_A12", pinRef: "U2700.A12" },
        { subBoardId: "SUB_BOTTOM_RF", padId: "BOT_UBBPMU_C4", pinRef: "U_BB_PMU.C4" },
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
    await repository.save(topology);

    const query: ResolveNetPathQuery = {
      boardId: "BRD_820_02106",
      padId: "TOP_U2700_A12",
    };

    const result = await handler.execute(query);

    expect(result).toBeDefined();
    expect(result.canonicalNetName).toBe("PP_VDD_MAIN");
    expect(result.classification).toBe(NetClassification.POWER_MAIN);
    expect(result.originPadId).toBe("TOP_U2700_A12");
    expect(result.interposerPadId).toBe("INT_PAD_084");
    expect(result.connectedPins).toHaveLength(1);
    expect(result.connectedPins[0].padId).toBe("BOT_UBBPMU_C4");
    expect(result.connectedPins[0].subBoardId).toBe("SUB_BOTTOM_RF");
  });

  it("should resolve net path when given an interposer pad directly", async () => {
    const topology = new NetTopology({
      id: "NET_VDD_MAIN",
      canonicalNetName: "PP_VDD_MAIN",
      classification: NetClassification.POWER_MAIN,
      localPins: [
        { subBoardId: "SUB_TOP_AP", padId: "TOP_U2700_A12", pinRef: "U2700.A12" },
        { subBoardId: "SUB_BOTTOM_RF", padId: "BOT_UBBPMU_C4", pinRef: "U_BB_PMU.C4" },
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
    await repository.save(topology);

    const query: ResolveNetPathQuery = {
      boardId: "BRD_820_02106",
      interposerPadId: "INT_PAD_084",
    };

    const result = await handler.execute(query);

    expect(result).toBeDefined();
    expect(result.canonicalNetName).toBe("PP_VDD_MAIN");
    expect(result.interposerPadId).toBe("INT_PAD_084");
    expect(result.connectedPins).toHaveLength(2);
  });

  it("should throw error if net topology is not found", async () => {
    const query: ResolveNetPathQuery = {
      boardId: "BRD_820_02106",
      padId: "UNKNOWN_PAD",
    };
    await expect(handler.execute(query)).rejects.toThrow("Net topology not found for pad: UNKNOWN_PAD");
  });
});
