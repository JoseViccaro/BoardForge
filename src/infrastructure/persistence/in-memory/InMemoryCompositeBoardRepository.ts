import { CompositeBoard } from "../../../domain/catalog/entities/CompositeBoard.js";
import { BoardId } from "../../../domain/catalog/value-objects/BoardId.js";
import { ICompositeBoardRepository } from "../../../domain/catalog/repositories/ICompositeBoardRepository.js";

export class InMemoryCompositeBoardRepository implements ICompositeBoardRepository {
  private readonly _boards: Map<string, CompositeBoard> = new Map();

  public async findById(id: BoardId | string): Promise<CompositeBoard | null> {
    const key = id instanceof BoardId ? id.value : id;
    return this._boards.get(key) ?? null;
  }

  public async findByBoardNumber(boardNumber: string): Promise<CompositeBoard | null> {
    for (const board of this._boards.values()) {
      if (board.boardNumber === boardNumber) {
        return board;
      }
    }
    return null;
  }

  public async save(board: CompositeBoard): Promise<void> {
    this._boards.set(board.id.value, board);
  }

  public async delete(id: BoardId | string): Promise<void> {
    const key = id instanceof BoardId ? id.value : id;
    this._boards.delete(key);
  }

  public clear(): void {
    this._boards.clear();
  }
}
