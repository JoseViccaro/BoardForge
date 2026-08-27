import { describe, it, expect } from "vitest";
import { LayerCoordinate } from "../../../src/domain/boardview/value-objects/LayerCoordinate.js";
import { LayerSide } from "../../../src/domain/boardview/value-objects/LayerSide.js";

describe("LayerCoordinate (Domain VO)", () => {
  it("should create LayerCoordinate with 4-decimal precision", () => {
    const coord = new LayerCoordinate(1.234567, 2.345678, LayerSide.TOP_SIDE, 0);
    expect(coord.x).toBe(1.2346);
    expect(coord.y).toBe(2.3457);
  });
});
