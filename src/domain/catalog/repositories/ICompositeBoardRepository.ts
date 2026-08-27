import { CompositeBoard } from "../entities/CompositeBoard.js";
import { BoardId } from "../value-objects/BoardId.js";

export interface ICompositeBoardRepository {
  findById(id: BoardId | string): Promise<CompositeBoard | null>;
  findByBoardNumber(boardNumber: string): Promise<CompositeBoard | null>;
  save(board: CompositeBoard): Promise<void>;
  delete(id: BoardId | string): Promise<void>;
}
