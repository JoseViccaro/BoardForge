import { describe, it, expect } from "vitest";
import { CompositeBoard } from "../../../src/domain/catalog/entities/CompositeBoard.js";
import { SubBoardEntity, SubBoardRole } from "../../../src/domain/catalog/entities/SubBoardEntity.js";
import { BoardStackType } from "../../../src/domain/catalog/value-objects/BoardStackType.js";

describe("CompositeBoard (domain root spec)", () => {
  it("should instantiate CompositeBoard aggregate with sub-boards", () => {
    const board = new CompositeBoard({
      id: "BRD_820_02106",
      boardNumber: "820-02106",
      stackType: BoardStackType.SANDWICH_INTERPOSER,
      subBoards: [
        new SubBoardEntity({
          id: "SUB_TOP",
          label: "Top Board",
          role: SubBoardRole.TOP_LOGIC,
          layerCount: 10,
        }),
        new SubBoardEntity({
          id: "SUB_BOT",
          label: "Bottom Board",
          role: SubBoardRole.BOTTOM_RF,
          layerCount: 8,
        }),
      ],
    });

    expect(board.subBoards).toHaveLength(2);
    expect(board.getSubBoard("SUB_TOP")?.role).toBe(SubBoardRole.TOP_LOGIC);
  });
});
