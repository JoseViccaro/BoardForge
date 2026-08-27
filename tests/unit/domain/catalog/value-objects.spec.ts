import { describe, it, expect } from "vitest";
import { BoardId } from "../../../../src/domain/catalog/value-objects/BoardId.js";
import { SubBoardId } from "../../../../src/domain/catalog/value-objects/SubBoardId.js";
import { BoardStackType } from "../../../../src/domain/catalog/value-objects/BoardStackType.js";

describe("Catalog Value Objects", () => {
  describe("BoardId", () => {
    it("should instantiate with valid string value", () => {
      const boardId = new BoardId("BRD_820_02106");
      expect(boardId.value).toBe("BRD_820_02106");
      expect(boardId.toString()).toBe("BRD_820_02106");
    });

    it("should throw error if initialized with empty or whitespace string", () => {
      expect(() => new BoardId("")).toThrow("BoardId cannot be empty");
      expect(() => new BoardId("   ")).toThrow("BoardId cannot be empty");
    });

    it("should correctly compare equality", () => {
      const id1 = new BoardId("BRD_820_02106");
      const id2 = new BoardId("BRD_820_02106");
      const id3 = new BoardId("BRD_820_00165");

      expect(id1.equals(id2)).toBe(true);
      expect(id1.equals(id3)).toBe(false);
      expect(id1.equals(null as any)).toBe(false);
      expect(id1.equals(undefined as any)).toBe(false);
    });
  });

  describe("SubBoardId", () => {
    it("should instantiate with valid string value", () => {
      const subBoardId = new SubBoardId("SUB_IPHONE13_TOP_LOGIC");
      expect(subBoardId.value).toBe("SUB_IPHONE13_TOP_LOGIC");
      expect(subBoardId.toString()).toBe("SUB_IPHONE13_TOP_LOGIC");
    });

    it("should throw error if initialized with empty or whitespace string", () => {
      expect(() => new SubBoardId("")).toThrow("SubBoardId cannot be empty");
      expect(() => new SubBoardId("   ")).toThrow("SubBoardId cannot be empty");
    });

    it("should correctly compare equality", () => {
      const id1 = new SubBoardId("SUB_IPHONE13_TOP_LOGIC");
      const id2 = new SubBoardId("SUB_IPHONE13_TOP_LOGIC");
      const id3 = new SubBoardId("SUB_IPHONE13_BOTTOM_RF");

      expect(id1.equals(id2)).toBe(true);
      expect(id1.equals(id3)).toBe(false);
    });
  });

  describe("BoardStackType", () => {
    it("should define all valid board stack types", () => {
      expect(BoardStackType.SINGLE_LAYER).toBe("SINGLE_LAYER");
      expect(BoardStackType.DOUBLE_SIDED).toBe("DOUBLE_SIDED");
      expect(BoardStackType.SANDWICH_INTERPOSER).toBe("SANDWICH_INTERPOSER");
      expect(BoardStackType.RIGID_FLEX).toBe("RIGID_FLEX");
    });
  });
});
