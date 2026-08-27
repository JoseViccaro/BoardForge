import { describe, it, expect } from "vitest";
import { PadEntity } from "../../../src/domain/boardview/entities/PadEntity.js";
import { LayerCoordinate } from "../../../src/domain/boardview/value-objects/LayerCoordinate.js";
import { LayerSide } from "../../../src/domain/boardview/value-objects/LayerSide.js";
import { SubBoardId } from "../../../src/domain/catalog/value-objects/SubBoardId.js";

describe("PadEntity", () => {
  it("should create a PadEntity with valid parameters", () => {
    const pad = new PadEntity({
      id: "TOP_U2700_A12",
      padNumber: "A12",
      subBoardId: new SubBoardId("SUB_IPHONE13_TOP_LOGIC"),
      coordinate: new LayerCoordinate(15.25, 45.5, LayerSide.TOP_SIDE, 0),
      netName: "PP_VDD_MAIN",
      componentId: "U2700",
      pinName: "VDD_MAIN_IN",
    });

    expect(pad.id).toBe("TOP_U2700_A12");
    expect(pad.padNumber).toBe("A12");
    expect(pad.subBoardId.value).toBe("SUB_IPHONE13_TOP_LOGIC");
    expect(pad.coordinate.x).toBe(15.25);
    expect(pad.coordinate.y).toBe(45.5);
    expect(pad.netName).toBe("PP_VDD_MAIN");
    expect(pad.componentId).toBe("U2700");
    expect(pad.pinName).toBe("VDD_MAIN_IN");
    expect(pad.isInterposerPad).toBe(false);
  });

  it("should create an interposer ring pad entity", () => {
    const pad = new PadEntity({
      id: "INT_PAD_084",
      padNumber: "84",
      subBoardId: "SUB_IPHONE13_INTERPOSER",
      coordinate: new LayerCoordinate(0.5, 30.0, LayerSide.TOP_SIDE, 1),
      netName: "PP_VDD_MAIN",
      isInterposerPad: true,
    });

    expect(pad.id).toBe("INT_PAD_084");
    expect(pad.isInterposerPad).toBe(true);
    expect(pad.componentId).toBeNull();
  });

  it("should throw if id or padNumber or subBoardId is empty", () => {
    expect(() => {
      new PadEntity({
        id: "",
        padNumber: "1",
        subBoardId: "SUB_1",
        coordinate: new LayerCoordinate(0, 0, LayerSide.TOP_SIDE, 0),
      });
    }).toThrow("id cannot be empty");

    expect(() => {
      new PadEntity({
        id: "PAD_1",
        padNumber: "",
        subBoardId: "SUB_1",
        coordinate: new LayerCoordinate(0, 0, LayerSide.TOP_SIDE, 0),
      });
    }).toThrow("padNumber cannot be empty");
  });
});
