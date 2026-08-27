import { NetTopology } from "../../../domain/boardview/aggregates/NetTopology.js";
import { INetTopologyRepository } from "../../../domain/boardview/repositories/INetTopologyRepository.js";

export class InMemoryNetTopologyRepository implements INetTopologyRepository {
  private readonly _topologies: Map<string, NetTopology> = new Map();

  public async findById(id: string): Promise<NetTopology | null> {
    return this._topologies.get(id) ?? null;
  }

  public async findByCanonicalNetName(boardId: string, netName: string): Promise<NetTopology | null> {
    for (const topology of this._topologies.values()) {
      if (topology.canonicalNetName === netName) {
        return topology;
      }
    }
    return null;
  }

  public async findByPadId(boardId: string, padId: string): Promise<NetTopology | null> {
    for (const topology of this._topologies.values()) {
      const hasLocal = topology.localPins.some((p) => p.padId === padId);
      const hasJunction = topology.interposerJunctions.some(
        (j) => j.interposerPadId === padId || j.topPadId === padId || j.bottomPadId === padId
      );
      if (hasLocal || hasJunction) {
        return topology;
      }
    }
    return null;
  }

  public async save(topology: NetTopology): Promise<void> {
    this._topologies.set(topology.id, topology);
  }

  public clear(): void {
    this._topologies.clear();
  }
}
