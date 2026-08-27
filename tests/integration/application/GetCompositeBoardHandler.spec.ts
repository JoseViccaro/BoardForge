import { describe, it, expect, beforeEach } from "vitest";
import { GetCompositeBoardHandler } from "../../../src/application/catalog/queries/GetCompositeBoardHandler.js";
import { CompositeBoard } from "../../../src/domain/catalog/entities/CompositeBoard.js";
import { SubBoardEntity, SubBoardRole } from "../../../src/domain/catalog/entities/SubBoardEntity.js";
import { BoardStackType } from "../../../src/domain/catalog/value-objects/BoardStackType.js";
import { ICompositeBoardRepository } from "../../../src/domain/catalog/repositories/ICompositeBoardRepository.js";

class InMemoryTestRepo implements ICompositeBoardRepository {
  private items = new Map<string, CompositeBoard>();
  async findById(id: any): Promise<CompositeBoard | null> {
    const key = typeof id === "string" ? id : id.value;
    return this.items.get(key) ?? null;
  }
  async findByBoardNumber(boardNumber: string): Promise<CompositeBoard | null> {
    for (const b of this.items.values()) {
      if (b.boardNumber === boardNumber) return b;
    }
    return null;
  }
  async save(board: CompositeBoard): Promise<void> {
    this.items.set(board.id.value, board);
  }
  async delete(id: any): Promise<void> {
    const key = typeof id === "string" ? id : id.value;
    this.items.delete(key);
  }
}

describe("GetCompositeBoardHandler Integration Test", () => {
  let repo: InMemoryTestRepo;
  let handler: GetCompositeBoardHandler;

  beforeEach(() => {
    repo = new InMemoryTestRepo();
    handler = new GetCompositeBoardHandler(repo);
  });

  it("should query GetCompositeBoardHandler by BoardId and return fully structured CompositeBoardDto", async () => {
    const board = new CompositeBoard({
      id: "BRD_820_02106",
      boardNumber: "820-02106",
      stackType: BoardStackType.SANDWICH_INTERPOSER,
      subBoards: [
        new SubBoardEntity({
          id: "SUB_IPHONE13_TOP_LOGIC",
          label: "Top AP Logic Board",
          role: SubBoardRole.TOP_LOGIC,
          layerCount: 10,
          dimensions: { width: 60.0, height: 120.0 },
        }),
        new SubBoardEntity({
          id: "SUB_IPHONE13_INTERPOSER",
          label: "Interposer Frame",
          role: SubBoardRole.INTERPOSER_FRAME,
          layerCount: 2,
        }),
        new SubBoardEntity({
          id: "SUB_IPHONE13_BOTTOM_RF",
          label: "Bottom RF Board",
          role: SubBoardRole.BOTTOM_RF,
          layerCount: 8,
        }),
      ],
    });
    await repo.save(board);

    const dto = await handler.execute({ boardId: "BRD_820_02106" });

    expect(dto.id).toBe("BRD_820_02106");
    expect(dto.boardNumber).toBe("820-02106");
    expect(dto.stackType).toBe(BoardStackType.SANDWICH_INTERPOSER);
    expect(dto.subBoards).toHaveLength(3);
    expect(dto.subBoards[0].id).toBe("SUB_IPHONE13_TOP_LOGIC");
    expect(dto.subBoards[1].id).toBe("SUB_IPHONE13_INTERPOSER");
    expect(dto.subBoards[2].id).toBe("SUB_IPHONE13_BOTTOM_RF");
  });
});
