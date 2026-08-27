import { ICompositeBoardRepository } from "../../../domain/catalog/repositories/ICompositeBoardRepository.js";
import { CompositeBoardDto } from "../dtos/CompositeBoardDto.js";

export interface GetCompositeBoardQuery {
  boardId: string;
}

export class GetCompositeBoardHandler {
  constructor(private readonly boardRepository: ICompositeBoardRepository) {}

  public async execute(query: GetCompositeBoardQuery): Promise<CompositeBoardDto> {
    const board = await this.boardRepository.findById(query.boardId);
    if (!board) {
      throw new Error(`Composite board not found: ${query.boardId}`);
    }

    return {
      id: board.id.value,
      boardNumber: board.boardNumber,
      stackType: board.stackType,
      subBoards: board.subBoards.map((sb) => ({
        id: sb.id.value,
        label: sb.label,
        role: sb.role,
        layerCount: sb.layerCount,
        dimensions: sb.dimensions ? { ...sb.dimensions } : undefined,
        padCount: sb.pads.length,
        componentCount: sb.components.length,
      })),
    };
  }
}
