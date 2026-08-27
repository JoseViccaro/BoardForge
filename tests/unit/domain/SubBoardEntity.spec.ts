import { describe, it, expect } from "vitest";
import { SubBoardEntity, SubBoardRole } from "../../../src/domain/catalog/entities/SubBoardEntity.js";

describe("SubBoardEntity (domain root spec)", () => {
  it("should create sub-board entity with role and properties", () => {
    const entity = new SubBoardEntity({
      id: "SUB_IPHONE13_INTERPOSER",
      label: "iPhone 13 Interposer Frame",
      role: SubBoardRole.INTERPOSER_FRAME,
      layerCount: 2,
      dimensions: { width: 60.0, height: 120.0 },
    });
    expect(entity.role).toBe(SubBoardRole.INTERPOSER_FRAME);
    expect(entity.layerCount).toBe(2);
  });
});
