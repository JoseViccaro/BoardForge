import { describe, it, expect } from "vitest";
import { LayerSide } from "../../../../src/domain/boardview/value-objects/LayerSide.js";
import { NetClassification } from "../../../../src/domain/boardview/value-objects/NetClassification.js";
import { LayerCoordinate } from "../../../../src/domain/boardview/value-objects/LayerCoordinate.js";
import { InterposerJunction } from "../../../../src/domain/boardview/value-objects/InterposerJunction.js";

describe("BoardView Value Objects", () => {
  describe("LayerSide", () => {
    it("should define TOP_SIDE and BOTTOM_SIDE", () => {
      expect(LayerSide.TOP_SIDE).toBe("TOP_SIDE");
      expect(LayerSide.BOTTOM_SIDE).toBe("BOTTOM_SIDE");
    });
  });

  describe("NetClassification", () => {
    it("should define expected classifications", () => {
      expect(NetClassification.POWER_MAIN).toBe("POWER_MAIN");
      expect(NetClassification.POWER_BUCK).toBe("POWER_BUCK");
      expect(NetClassification.SIGNAL_I2C).toBe("SIGNAL_I2C");
      expect(NetClassification.SIGNAL_SPI).toBe("SIGNAL_SPI");
      expect(NetClassification.RF_ANTENNA).toBe("RF_ANTENNA");
      expect(NetClassification.GROUND).toBe("GROUND");
    });
  });

  describe("LayerCoordinate", () => {
    it("should create immutable LayerCoordinate and round to 4 decimal places (0.0001 mm)", () => {
      const coord = new LayerCoordinate(15.250049, 45.500099, LayerSide.TOP_SIDE, 0);
      expect(coord.x).toBe(15.25);
      expect(coord.y).toBe(45.5001);
      expect(coord.side).toBe(LayerSide.TOP_SIDE);
      expect(coord.zIndex).toBe(0);
    });

    it("should enforce integer and non-negative zIndex", () => {
      expect(() => new LayerCoordinate(10, 10, LayerSide.TOP_SIDE, -1)).toThrow("zIndex must be non-negative");
    });

    it("should provide withOffset returning a new coordinate", () => {
      const coord = new LayerCoordinate(10.0, 20.0, LayerSide.TOP_SIDE, 0);
      const translated = coord.withOffset(5.12345, -2.5);
      expect(translated.x).toBe(15.1235);
      expect(translated.y).toBe(17.5);
      expect(translated.side).toBe(LayerSide.TOP_SIDE);
      expect(translated.zIndex).toBe(0);
      // Original remains unchanged
      expect(coord.x).toBe(10.0);
    });

    it("should provide withSide returning mirrored side", () => {
      const coord = new LayerCoordinate(15.25, 45.5, LayerSide.TOP_SIDE, 0);
      const flipped = coord.withSide(LayerSide.BOTTOM_SIDE, 60.0);
      expect(flipped.x).toBe(44.75);
      expect(flipped.y).toBe(45.5);
      expect(flipped.side).toBe(LayerSide.BOTTOM_SIDE);
      expect(flipped.zIndex).toBe(0);
    });

    it("should compare equality accurately", () => {
      const c1 = new LayerCoordinate(15.25, 45.5, LayerSide.TOP_SIDE, 0);
      const c2 = new LayerCoordinate(15.25, 45.5, LayerSide.TOP_SIDE, 0);
      const c3 = new LayerCoordinate(15.25, 45.5, LayerSide.BOTTOM_SIDE, 0);
      const c4 = new LayerCoordinate(15.25, 45.5, LayerSide.TOP_SIDE, 1);

      expect(c1.equals(c2)).toBe(true);
      expect(c1.equals(c3)).toBe(false);
      expect(c1.equals(c4)).toBe(false);
    });
  });

  describe("InterposerJunction", () => {
    it("should create full bridge junction linking top and bottom pads", () => {
      const junction = new InterposerJunction({
        junctionId: "JUNC_084",
        interposerPadId: "INT_PAD_084",
        topPadId: "TOP_U2700_A12",
        bottomPadId: "BOT_UBBPMU_C4",
        canonicalNetName: "PP_VDD_MAIN",
        classification: NetClassification.POWER_MAIN,
      });

      expect(junction.junctionId).toBe("JUNC_084");
      expect(junction.interposerPadId).toBe("INT_PAD_084");
      expect(junction.topPadId).toBe("TOP_U2700_A12");
      expect(junction.bottomPadId).toBe("BOT_UBBPMU_C4");
      expect(junction.canonicalNetName).toBe("PP_VDD_MAIN");
      expect(junction.classification).toBe(NetClassification.POWER_MAIN);
      expect(junction.isBridge()).toBe(true);
    });

    it("should support one-sided junction without bridging", () => {
      const junction = new InterposerJunction({
        junctionId: "JUNC_099",
        interposerPadId: "INT_PAD_099",
        topPadId: "TOP_TEST_PAD",
        bottomPadId: null,
        canonicalNetName: "TEST_ONE_SIDE",
        classification: NetClassification.SIGNAL_I2C,
      });

      expect(junction.isBridge()).toBe(false);
      expect(junction.bottomPadId).toBeNull();
    });

    it("should validate required fields", () => {
      expect(() => new InterposerJunction({
        junctionId: "",
        interposerPadId: "INT_PAD_084",
        canonicalNetName: "PP_VDD_MAIN",
        classification: NetClassification.POWER_MAIN,
      })).toThrow("junctionId cannot be empty");

      expect(() => new InterposerJunction({
        junctionId: "JUNC_084",
        interposerPadId: "",
        canonicalNetName: "PP_VDD_MAIN",
        classification: NetClassification.POWER_MAIN,
      })).toThrow("interposerPadId cannot be empty");

      expect(() => new InterposerJunction({
        junctionId: "JUNC_084",
        interposerPadId: "INT_PAD_084",
        canonicalNetName: "",
        classification: NetClassification.POWER_MAIN,
      })).toThrow("canonicalNetName cannot be empty");
    });
  });
});
