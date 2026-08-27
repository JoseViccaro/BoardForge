import { describe, it, expect } from "vitest";
import { CoordinateTransformer } from "../../../src/domain/boardview/services/CoordinateTransformer.js";
import { LayerCoordinate } from "../../../src/domain/boardview/value-objects/LayerCoordinate.js";
import { LayerSide } from "../../../src/domain/boardview/value-objects/LayerSide.js";

describe("CoordinateTransformer (Domain Service)", () => {
  it("should flip coordinate horizontally", () => {
    const coord = new LayerCoordinate(15.25, 45.5, LayerSide.TOP_SIDE, 0);
    const flipped = CoordinateTransformer.flipHorizontal(coord, 60.0);
    expect(flipped.x).toBe(44.75);
    expect(flipped.y).toBe(45.5);
    expect(flipped.side).toBe(LayerSide.BOTTOM_SIDE);
  });
});
