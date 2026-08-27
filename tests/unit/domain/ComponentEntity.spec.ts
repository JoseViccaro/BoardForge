import { describe, it, expect } from "vitest";
import { ComponentEntity } from "../../../src/domain/boardview/entities/ComponentEntity.js";
import { PadEntity } from "../../../src/domain/boardview/entities/PadEntity.js";
import { LayerCoordinate } from "../../../src/domain/boardview/value-objects/LayerCoordinate.js";
import { LayerSide } from "../../../src/domain/boardview/value-objects/LayerSide.js";

describe("ComponentEntity", () => {
  it("should create a ComponentEntity with pins", () => {
    const pinA1 = new PadEntity({
      id: "PAD_U2700_A1",
      padNumber: "A1",
      subBoardId: "SUB_TOP",
      coordinate: new LayerCoordinate(10.0, 20.0, LayerSide.TOP_SIDE, 0),
      componentId: "U2700",
      pinName: "GND",
    });

    const comp = new ComponentEntity({
      id: "U2700",
      designator: "U2700",
      subBoardId: "SUB_TOP",
      coordinate: new LayerCoordinate(10.0, 20.0, LayerSide.TOP_SIDE, 0),
      packageType: "BGA_144",
      pins: [pinA1],
    });

    expect(comp.id).toBe("U2700");
    expect(comp.designator).toBe("U2700");
    expect(comp.packageType).toBe("BGA_144");
    expect(comp.pins).toHaveLength(1);
    expect(comp.getPin("A1")?.id).toBe("PAD_U2700_A1");
  });

  it("should allow dynamically adding pins", () => {
    const comp = new ComponentEntity({
      id: "U0100",
      designator: "U0100",
      subBoardId: "SUB_TOP",
      coordinate: new LayerCoordinate(30.0, 60.0, LayerSide.TOP_SIDE, 0),
    });

    const pin = new PadEntity({
      id: "PAD_U0100_B2",
      padNumber: "B2",
      subBoardId: "SUB_TOP",
      coordinate: new LayerCoordinate(30.2, 60.2, LayerSide.TOP_SIDE, 0),
      componentId: "U0100",
    });

    comp.addPin(pin);
    expect(comp.pins).toHaveLength(1);
    expect(comp.getPin("B2")?.id).toBe("PAD_U0100_B2");
  });

  it("should throw if designator is empty", () => {
    expect(() => {
      new ComponentEntity({
        id: "U1",
        designator: "",
        subBoardId: "SUB_TOP",
        coordinate: new LayerCoordinate(0, 0, LayerSide.TOP_SIDE, 0),
      });
    }).toThrow("designator cannot be empty");
  });
});
