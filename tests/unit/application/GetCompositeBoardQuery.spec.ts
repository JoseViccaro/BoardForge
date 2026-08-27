import { describe, it, expect, beforeEach } from "vitest";
import { CompositeBoard } from "../../../src/domain/catalog/entities/CompositeBoard.js";
import { SubBoardEntity, SubBoardRole } from "../../../src/domain/catalog/entities/SubBoardEntity.js";
import { BoardStackType } from "../../../src/domain/catalog/value-objects/BoardStackType.js";
import { ICompositeBoardRepository } from "../../../src/domain/catalog/repositories/ICompositeBoardRepository.js";
import { GetCompositeBoardHandler, GetCompositeBoardQuery } from "../../../src/application/catalog/queries/GetCompositeBoardHandler.js";

class MockCompositeBoardRepository implements ICompositeBoardRepository {
  private boards = new Map<string, CompositeBoard>();

  async findById(id: any): Promise<CompositeBoard | null> {
    const key = typeof id === "string" ? id : id.value;
    return this.boards.get(key) ?? null;
  }

  async findByBoardNumber(boardNumber: string): Promise<CompositeBoard | null> {
    for (const b of this.boards.values()) {
      if (b.boardNumber === boardNumber) return b;
    }
    return null;
  }

  async save(board: CompositeBoard): Promise<void> {
    this.boards.set(board.id.value, board);
  }

  async delete(id: any): Promise<void> {
    const key = typeof id === "string" ? id : id.value;
    this.boards.delete(key);
  }
}

describe("GetCompositeBoardHandler", () => {
  let repository: MockCompositeBoardRepository;
  let handler: GetCompositeBoardHandler;

  beforeEach(() => {
    repository = new MockCompositeBoardRepository();
    handler = new GetCompositeBoardHandler(repository);
  });

  it("should return CompositeBoardDto for an existing composite board by id", async () => {
    const board = new CompositeBoard({
      id: "BRD_820_02106",
      boardNumber: "820-02106",
      stackType: BoardStackType.SANDWICH_INTERPOSER,
      subBoards: [
        new SubBoardEntity({
          id: "SUB_TOP_AP",
          label: "Top AP Board",
          role: SubBoardRole.TOP_LOGIC,
          layerCount: 10,
          dimensions: { width: 60, height: 120 },
        }),
        new SubBoardEntity({
          id: "SUB_INTERPOSER",
          label: "Interposer Frame",
          role: SubBoardRole.INTERPOSER_FRAME,
          layerCount: 2,
        }),
        new SubBoardEntity({
          id: "SUB_BOTTOM_RF",
          label: "Bottom RF Board",
          role: SubBoardRole.BOTTOM_RF,
          layerCount: 8,
        }),
      ],
    });
    await repository.save(board);

    const query: GetCompositeBoardQuery = { boardId: "BRD_820_02106" };
    const result = await handler.execute(query);

    expect(result).toBeDefined();
    expect(result.id).toBe("BRD_820_02106");
    expect(result.boardNumber).toBe("820-02106");
    expect(result.stackType).toBe(BoardStackType.SANDWICH_INTERPOSER);
    expect(result.subBoards).toHaveLength(3);
    expect(result.subBoards[0].id).toBe("SUB_TOP_AP");
    expect(result.subBoards[0].role).toBe(SubBoardRole.TOP_LOGIC);
    expect(result.subBoards[0].layerCount).toBe(10);
    expect(result.subBoards[0].dimensions).toEqual({ width: 60, height: 120 });
    expect(result.subBoards[1].id).toBe("SUB_INTERPOSER");
    expect(result.subBoards[2].id).toBe("SUB_BOTTOM_RF");
  });

  it("should throw error if board not found", async () => {
    const query: GetCompositeBoardQuery = { boardId: "NON_EXISTING" };
    await expect(handler.execute(query)).rejects.toThrow("Composite board not found: NON_EXISTING");
  });
});
