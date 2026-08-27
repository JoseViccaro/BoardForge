import { describe, it, expect } from "vitest";
import { CoordinateTransformer } from "../../../../src/domain/boardview/services/CoordinateTransformer.js";
import { LayerCoordinate } from "../../../../src/domain/boardview/value-objects/LayerCoordinate.js";
import { LayerSide } from "../../../../src/domain/boardview/value-objects/LayerSide.js";

describe("CoordinateTransformer Service", () => {
  describe("flipHorizontal", () => {
    it("should flip X coordinate across vertical centerline when viewing bottom side (X=15.25, W=60.0 -> X'=44.75, Y unchanged)", () => {
      const topCoord = new LayerCoordinate(15.25, 45.5, LayerSide.TOP_SIDE, 0);
      const flipped = CoordinateTransformer.flipHorizontal(topCoord, 60.0);

      expect(flipped.x).toBe(44.75);
      expect(flipped.y).toBe(45.5);
      expect(flipped.side).toBe(LayerSide.BOTTOM_SIDE);
      expect(flipped.zIndex).toBe(0);
    });

    it("should be idempotent when coordinate is already on BOTTOM_SIDE", () => {
      const bottomCoord = new LayerCoordinate(44.75, 45.5, LayerSide.BOTTOM_SIDE, 0);
      const flippedAgain = CoordinateTransformer.flipHorizontal(bottomCoord, 60.0);

      expect(flippedAgain.x).toBe(44.75);
      expect(flippedAgain.y).toBe(45.5);
      expect(flippedAgain.side).toBe(LayerSide.BOTTOM_SIDE);
      expect(flippedAgain.zIndex).toBe(0);
    });
  });

  describe("translate", () => {
    it("should translate coordinates by dx and dy with precision rounding", () => {
      const coord = new LayerCoordinate(10.1234, 20.5678, LayerSide.TOP_SIDE, 0);
      const translated = CoordinateTransformer.translate(coord, 5.0, -10.0);

      expect(translated.x).toBe(15.1234);
      expect(translated.y).toBe(10.5678);
      expect(translated.side).toBe(LayerSide.TOP_SIDE);
      expect(translated.zIndex).toBe(0);
    });
  });

  describe("stackTransform", () => {
    it("should calculate 3D exploded displacement coordinate", () => {
      const coord = new LayerCoordinate(15.0, 30.0, LayerSide.TOP_SIDE, 2);
      const transformed = CoordinateTransformer.stackTransform(coord, 5.0);

      expect(transformed).toEqual({
        x: 15.0,
        y: 30.0,
        z: 10.0, // 2 * 5.0
      });
    });
  });
});
