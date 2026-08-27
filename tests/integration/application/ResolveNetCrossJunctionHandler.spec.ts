import { describe, it, expect, beforeEach } from "vitest";
import { ResolveNetCrossJunctionHandler } from "../../../src/application/boardview/queries/ResolveNetCrossJunctionHandler.js";
import { NetTopology } from "../../../src/domain/boardview/aggregates/NetTopology.js";
import { NetClassification } from "../../../src/domain/boardview/value-objects/NetClassification.js";
import { InterposerJunction } from "../../../src/domain/boardview/value-objects/InterposerJunction.js";
import { INetTopologyRepository } from "../../../src/domain/boardview/repositories/INetTopologyRepository.js";

class InMemoryTopologyRepo implements INetTopologyRepository {
  private items = new Map<string, NetTopology>();
  async findById(id: string): Promise<NetTopology | null> {
    return this.items.get(id) ?? null;
  }
  async findByCanonicalNetName(boardId: string, netName: string): Promise<NetTopology | null> {
    for (const t of this.items.values()) {
      if (t.canonicalNetName === netName) return t;
    }
    return null;
  }
  async findByPadId(boardId: string, padId: string): Promise<NetTopology | null> {
    for (const t of this.items.values()) {
      const hasLocal = t.localPins.some((p) => p.padId === padId);
      const hasJunc = t.interposerJunctions.some(
        (j) => j.interposerPadId === padId || j.topPadId === padId || j.bottomPadId === padId
      );
      if (hasLocal || hasJunc) return t;
    }
    return null;
  }
  async save(topology: NetTopology): Promise<void> {
    this.items.set(topology.id, topology);
  }
}

describe("ResolveNetCrossJunctionHandler Integration Test", () => {
  let repo: InMemoryTopologyRepo;
  let handler: ResolveNetCrossJunctionHandler;

  beforeEach(() => {
    repo = new InMemoryTopologyRepo();
    handler = new ResolveNetCrossJunctionHandler(repo);
  });

  it("should query ResolveNetCrossJunctionHandler by pin/pad reference and return NetResolutionDto with cross-layer trace path", async () => {
    const topology = new NetTopology({
      id: "NET_VDD_MAIN_820_02106",
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
    await repo.save(topology);

    const dto = await handler.execute({
      boardId: "BRD_820_02106",
      padId: "TOP_U2700_A12",
    });

    expect(dto.canonicalNetName).toBe("PP_VDD_MAIN");
    expect(dto.classification).toBe(NetClassification.POWER_MAIN);
    expect(dto.originPadId).toBe("TOP_U2700_A12");
    expect(dto.interposerPadId).toBe("INT_PAD_084");
    expect(dto.connectedPins).toHaveLength(1);
    expect(dto.connectedPins[0].padId).toBe("BOT_UBBPMU_C4");
  });
});
