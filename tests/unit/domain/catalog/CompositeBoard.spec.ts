import { describe, it, expect } from "vitest";
import { CompositeBoard } from "../../../../src/domain/catalog/entities/CompositeBoard.js";
import { SubBoardEntity, SubBoardRole } from "../../../../src/domain/catalog/entities/SubBoardEntity.js";
import { BoardId } from "../../../../src/domain/catalog/value-objects/BoardId.js";
import { BoardStackType } from "../../../../src/domain/catalog/value-objects/BoardStackType.js";
import { DuplicateSubBoardIdException } from "../../../../src/domain/catalog/exceptions/DuplicateSubBoardIdException.js";

describe("CompositeBoard Aggregate", () => {
  const topSubBoard = new SubBoardEntity({
    id: "SUB_IPHONE13_TOP_LOGIC",
    label: "iPhone 13 Top Logic Board",
    role: SubBoardRole.TOP_LOGIC,
    layerCount: 10,
    dimensions: { width: 60.0, height: 120.0 },
  });

  const interposerSubBoard = new SubBoardEntity({
    id: "SUB_IPHONE13_INTERPOSER",
    label: "iPhone 13 Interposer Frame",
    role: SubBoardRole.INTERPOSER_FRAME,
    layerCount: 2,
    dimensions: { width: 60.0, height: 120.0 },
  });

  const bottomSubBoard = new SubBoardEntity({
    id: "SUB_IPHONE13_BOTTOM_RF",
    label: "iPhone 13 Bottom RF Board",
    role: SubBoardRole.BOTTOM_RF,
    layerCount: 8,
    dimensions: { width: 60.0, height: 120.0 },
  });

  it("should successfully create an iPhone 13 composite board with 3 sub-boards", () => {
    const compositeBoard = new CompositeBoard({
      id: new BoardId("BRD_820_02106"),
      boardNumber: "820-02106",
      stackType: BoardStackType.SANDWICH_INTERPOSER,
      subBoards: [topSubBoard, interposerSubBoard, bottomSubBoard],
    });

    expect(compositeBoard.id.value).toBe("BRD_820_02106");
    expect(compositeBoard.boardNumber).toBe("820-02106");
    expect(compositeBoard.stackType).toBe(BoardStackType.SANDWICH_INTERPOSER);
    expect(compositeBoard.subBoards).toHaveLength(3);
    expect(compositeBoard.subBoards[0].id.value).toBe("SUB_IPHONE13_TOP_LOGIC");
    expect(compositeBoard.subBoards[1].id.value).toBe("SUB_IPHONE13_INTERPOSER");
    expect(compositeBoard.subBoards[2].id.value).toBe("SUB_IPHONE13_BOTTOM_RF");
  });

  it("should query sub-board by id and by role", () => {
    const compositeBoard = new CompositeBoard({
      id: "BRD_820_02106",
      boardNumber: "820-02106",
      stackType: BoardStackType.SANDWICH_INTERPOSER,
      subBoards: [topSubBoard, interposerSubBoard, bottomSubBoard],
    });

    const foundById = compositeBoard.getSubBoard("SUB_IPHONE13_INTERPOSER");
    expect(foundById).toBeDefined();
    expect(foundById?.role).toBe(SubBoardRole.INTERPOSER_FRAME);

    const foundByRole = compositeBoard.getSubBoardByRole(SubBoardRole.BOTTOM_RF);
    expect(foundByRole).toBeDefined();
    expect(foundByRole?.id.value).toBe("SUB_IPHONE13_BOTTOM_RF");
  });

  it("should enforce invariant: SANDWICH_INTERPOSER requires at least 2 sub-boards", () => {
    expect(() => {
      new CompositeBoard({
        id: "BRD_INVALID",
        boardNumber: "820-00000",
        stackType: BoardStackType.SANDWICH_INTERPOSER,
        subBoards: [topSubBoard],
      });
    }).toThrow("SANDWICH_INTERPOSER requires at least 2 sub-boards");
  });

  it("should throw DuplicateSubBoardIdException when sub-board IDs are duplicated", () => {
    const duplicateTop = new SubBoardEntity({
      id: "SUB_IPHONE13_TOP_LOGIC",
      label: "Duplicate Top Board",
      role: SubBoardRole.TOP_LOGIC,
      layerCount: 10,
    });

    expect(() => {
      new CompositeBoard({
        id: "BRD_DUPLICATE",
        boardNumber: "820-02106",
        stackType: BoardStackType.SANDWICH_INTERPOSER,
        subBoards: [topSubBoard, duplicateTop],
      });
    }).toThrow(DuplicateSubBoardIdException);
  });

  it("should throw DuplicateSubBoardIdException when adding a duplicate sub-board dynamically", () => {
    const compositeBoard = new CompositeBoard({
      id: "BRD_DYNAMIC",
      boardNumber: "820-02106",
      stackType: BoardStackType.SANDWICH_INTERPOSER,
      subBoards: [topSubBoard, interposerSubBoard],
    });

    expect(() => {
      compositeBoard.addSubBoard(topSubBoard);
    }).toThrow(DuplicateSubBoardIdException);
  });

  it("should return immutable readonly array for subBoards", () => {
    const compositeBoard = new CompositeBoard({
      id: "BRD_IMMUTABLE",
      boardNumber: "820-02106",
      stackType: BoardStackType.SANDWICH_INTERPOSER,
      subBoards: [topSubBoard, interposerSubBoard],
    });

    const subBoards = compositeBoard.subBoards;
    expect(Array.isArray(subBoards)).toBe(true);
    // Mutating returned array does not mutate internal state
    expect(() => {
      (subBoards as any).push(bottomSubBoard);
    }).toThrow();
  });
});
