import { describe, it, expect } from "vitest";
import { SubBoardEntity, SubBoardRole } from "../../../../src/domain/catalog/entities/SubBoardEntity.js";
import { SubBoardId } from "../../../../src/domain/catalog/value-objects/SubBoardId.js";

describe("SubBoardEntity", () => {
  it("should successfully instantiate with valid properties", () => {
    const subBoard = new SubBoardEntity({
      id: new SubBoardId("SUB_IPHONE13_TOP_LOGIC"),
      label: "iPhone 13 Top Logic Board",
      role: SubBoardRole.TOP_LOGIC,
      layerCount: 10,
      dimensions: { width: 60.0, height: 120.0 },
    });

    expect(subBoard.id.value).toBe("SUB_IPHONE13_TOP_LOGIC");
    expect(subBoard.label).toBe("iPhone 13 Top Logic Board");
    expect(subBoard.role).toBe(SubBoardRole.TOP_LOGIC);
    expect(subBoard.layerCount).toBe(10);
    expect(subBoard.dimensions).toEqual({ width: 60.0, height: 120.0 });
    expect(subBoard.pads).toEqual([]);
    expect(subBoard.components).toEqual([]);
  });

  it("should accept string id and convert to SubBoardId", () => {
    const subBoard = new SubBoardEntity({
      id: "SUB_IPHONE13_BOTTOM_RF",
      label: "iPhone 13 Bottom RF Board",
      role: SubBoardRole.BOTTOM_RF,
      layerCount: 8,
      dimensions: { width: 60.0, height: 120.0 },
    });

    expect(subBoard.id).toBeInstanceOf(SubBoardId);
    expect(subBoard.id.value).toBe("SUB_IPHONE13_BOTTOM_RF");
  });

  it("should throw if layerCount is not a positive integer", () => {
    expect(() => {
      new SubBoardEntity({
        id: "SUB_TEST",
        label: "Test Board",
        role: SubBoardRole.DAUGHTER_BOARD,
        layerCount: 0,
      });
    }).toThrow("layerCount must be a positive integer");

    expect(() => {
      new SubBoardEntity({
        id: "SUB_TEST",
        label: "Test Board",
        role: SubBoardRole.DAUGHTER_BOARD,
        layerCount: 2.5,
      });
    }).toThrow("layerCount must be a positive integer");
  });

  it("should throw if dimensions are negative or zero", () => {
    expect(() => {
      new SubBoardEntity({
        id: "SUB_TEST",
        label: "Test Board",
        role: SubBoardRole.DAUGHTER_BOARD,
        layerCount: 2,
        dimensions: { width: -10, height: 100 },
      });
    }).toThrow("dimensions width and height must be positive numbers");

    expect(() => {
      new SubBoardEntity({
        id: "SUB_TEST",
        label: "Test Board",
        role: SubBoardRole.DAUGHTER_BOARD,
        layerCount: 2,
        dimensions: { width: 50, height: 0 },
      });
    }).toThrow("dimensions width and height must be positive numbers");
  });

  it("should throw if label is empty", () => {
    expect(() => {
      new SubBoardEntity({
        id: "SUB_TEST",
        label: "",
        role: SubBoardRole.DAUGHTER_BOARD,
        layerCount: 4,
      });
    }).toThrow("label cannot be empty");
  });
});
