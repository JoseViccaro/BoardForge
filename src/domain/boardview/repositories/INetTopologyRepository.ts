import { NetTopology } from "../aggregates/NetTopology.js";

export interface INetTopologyRepository {
  findById(id: string): Promise<NetTopology | null>;
  findByCanonicalNetName(boardId: string, netName: string): Promise<NetTopology | null>;
  findByPadId(boardId: string, padId: string): Promise<NetTopology | null>;
  save(topology: NetTopology): Promise<void>;
}
