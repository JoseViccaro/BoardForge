import { ICompositeBoardRepository } from "../../domain/catalog/repositories/ICompositeBoardRepository.js";
import { INetTopologyRepository } from "../../domain/boardview/repositories/INetTopologyRepository.js";
import { IBoardViewParserFactory } from "../../domain/boardview/ports/IBoardViewParser.js";
import { BoardViewToCanonicalTransformer } from "../../domain/boardview/services/BoardViewToCanonicalTransformer.js";
import { IngestBoardViewHandler } from "./commands/IngestBoardViewHandler.js";
import { IngestBoardViewCommand } from "./commands/IngestBoardViewCommand.js";
import { IngestBoardViewResultDto } from "./dtos/IngestBoardViewResultDto.js";
import { EntityNotFoundError } from "../../interfaces/http/errors/HttpErrors.js";
import { BoardId } from "../../domain/catalog/value-objects/BoardId.js";

export class BoardViewFacade {
  private readonly ingestHandler: IngestBoardViewHandler;

  constructor(
    private readonly boardRepo: ICompositeBoardRepository,
    private readonly topologyRepo: INetTopologyRepository,
    private readonly parserFactory: IBoardViewParserFactory,
    private readonly transformer: BoardViewToCanonicalTransformer
  ) {
    this.ingestHandler = new IngestBoardViewHandler(
      boardRepo,
      topologyRepo,
      parserFactory,
      transformer
    );
  }

  public async uploadBoardView(
    command: IngestBoardViewCommand,
    organizationId?: string
  ): Promise<IngestBoardViewResultDto> {
    return await this.ingestHandler.execute(command);
  }

  public async getBoardView(boardId: string, organizationId?: string): Promise<any> {
    const board = await this.boardRepo.findById(new BoardId(boardId));
    if (!board) {
      throw new EntityNotFoundError(`Board '${boardId}' not found.`);
    }

    return {
      boardId: board.id.value,
      boardNumber: board.boardNumber,
      stackType: board.stackType,
      subBoards: board.subBoards.map((sb) => ({
        id: sb.id.value,
        label: sb.label,
        role: sb.role,
        layerCount: sb.layerCount,
        components: sb.components.map((c) => ({
          id: c.id,
          designator: c.designator,
          packageType: c.packageType,
          coordinate: c.coordinate,
        })),
        pads: sb.pads.map((p) => ({
          id: p.id,
          padNumber: p.padNumber,
          netName: p.netName,
          pinName: p.pinName,
          coordinate: p.coordinate,
          isInterposerPad: p.isInterposerPad,
        })),
      })),
    };
  }

  public async getNets(
    boardId: string,
    search?: string,
    organizationId?: string
  ): Promise<{ nets: string[] }> {
    const board = await this.boardRepo.findById(new BoardId(boardId));
    if (!board) {
      throw new EntityNotFoundError(`Board '${boardId}' not found.`);
    }

    const netSet = new Set<string>();
    for (const sb of board.subBoards) {
      for (const pad of sb.pads) {
        if (pad.netName && pad.netName.trim().length > 0) {
          if (!search || pad.netName.toLowerCase().includes(search.toLowerCase())) {
            netSet.add(pad.netName);
          }
        }
      }
    }

    return { nets: Array.from(netSet) };
  }

  public async getNetDetails(
    boardId: string,
    netName: string,
    organizationId?: string
  ): Promise<any> {
    const board = await this.boardRepo.findById(new BoardId(boardId));
    if (!board) {
      throw new EntityNotFoundError(`Board '${boardId}' not found.`);
    }

    const topology = await this.topologyRepo.findByCanonicalNetName(board.id, netName);
    if (!topology) {
      // Return synthetic topology if not explicitly saved as aggregate
      const localPins: any[] = [];
      for (const sb of board.subBoards) {
        for (const pad of sb.pads) {
          if (pad.netName === netName) {
            localPins.push({
              subBoardId: sb.id.value,
              padId: pad.id,
              pinRef: `${pad.componentId || "PAD"}.${pad.padNumber}`,
            });
          }
        }
      }
      return {
        id: `NET_${netName}`,
        canonicalNetName: netName,
        classification: "UNKNOWN",
        localPins,
        interposerJunctions: [],
      };
    }

    return {
      id: topology.id,
      canonicalNetName: topology.canonicalNetName,
      classification: topology.classification,
      localPins: topology.localPins,
      interposerJunctions: topology.interposerJunctions.map((j) => ({
        junctionId: j.junctionId,
        interposerPadId: j.interposerPadId,
        topPadId: j.topPadId,
        bottomPadId: j.bottomPadId,
        canonicalNetName: j.canonicalNetName,
        classification: j.classification,
      })),
    };
  }
}
