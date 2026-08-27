import { INetTopologyRepository } from "../../../domain/boardview/repositories/INetTopologyRepository.js";
import { BidirectionalNetResolver } from "../../../domain/boardview/services/BidirectionalNetResolver.js";
import { NetResolutionDto } from "../dtos/NetResolutionDto.js";

export interface ResolveNetPathQuery {
  boardId: string;
  padId?: string;
  interposerPadId?: string;
}

export class ResolveNetCrossJunctionHandler {
  private readonly resolver = new BidirectionalNetResolver();

  constructor(private readonly topologyRepository: INetTopologyRepository) {}

  public async execute(query: ResolveNetPathQuery): Promise<NetResolutionDto> {
    const targetPadId = query.interposerPadId ?? query.padId;
    if (!targetPadId) {
      throw new Error("Either padId or interposerPadId must be specified");
    }

    const topology = await this.topologyRepository.findByPadId(query.boardId, targetPadId);
    if (!topology) {
      throw new Error(`Net topology not found for pad: ${targetPadId}`);
    }

    if (query.interposerPadId) {
      const resolved = this.resolver.resolveFromInterposerPad(topology, query.interposerPadId);
      if (!resolved) {
        throw new Error(`Failed to resolve interposer pad: ${query.interposerPadId}`);
      }
      return {
        canonicalNetName: resolved.canonicalNetName,
        classification: resolved.classification,
        interposerPadId: resolved.interposerPadId,
        connectedPins: resolved.connectedPins.map((p) => ({
          subBoardId: p.subBoardId,
          padId: p.padId,
          pinRef: p.pinRef,
        })),
      };
    }

    const resolved = this.resolver.resolvePath(topology, query.padId!);
    return {
      canonicalNetName: resolved.canonicalNetName,
      classification: resolved.classification,
      originPadId: resolved.originPadId,
      interposerPadId: resolved.interposerPadId,
      connectedPins: resolved.connectedPins.map((p) => ({
        subBoardId: p.subBoardId,
        padId: p.padId,
        pinRef: p.pinRef,
      })),
    };
  }
}
