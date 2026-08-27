import { describe, it, expect } from "vitest";
import { SchematicSymbol } from "../../../../src/domain/schematics/entities/SchematicSymbol.js";
import { SchematicPinLocation } from "../../../../src/domain/schematics/entities/SchematicPinLocation.js";
import { BoundingBox2D } from "../../../../src/domain/schematics/value-objects/BoundingBox2D.js";

describe("SchematicSymbol & SchematicPinLocation Entities", () => {
  it("should create a SchematicPinLocation", () => {
    const pin = new SchematicPinLocation({
      id: "PIN_U2700_A12",
      refDes: "U2700",
      pinNumber: "A12",
      pinName: "PP_VDD_MAIN_IN",
      pageNumber: 12,
      bounds: new BoundingBox2D(180, 200, 195, 215),
      connectionPoint: { x: 180, y: 207.5 },
      connectedNetName: "PP_VDD_MAIN",
    });

    expect(pin.id).toBe("PIN_U2700_A12");
    expect(pin.refDes).toBe("U2700");
    expect(pin.pinNumber).toBe("A12");
    expect(pin.pinName).toBe("PP_VDD_MAIN_IN");
    expect(pin.pageNumber).toBe(12);
    expect(pin.connectionPoint).toEqual({ x: 180, y: 207.5 });
    expect(pin.connectedNetName).toBe("PP_VDD_MAIN");
  });

  it("should create SchematicSymbol and manage pins", () => {
    const symbol = new SchematicSymbol({
      id: "SYM_U2700_A",
      refDes: "U2700",
      bankDesignator: "A",
      pageNumber: 12,
      bounds: new BoundingBox2D(100, 100, 300, 300),
    });

    const pin1 = new SchematicPinLocation({
      id: "PIN_U2700_A12",
      refDes: "U2700",
      pinNumber: "A12",
      pageNumber: 12,
      bounds: new BoundingBox2D(180, 200, 195, 215),
      connectionPoint: { x: 180, y: 207.5 },
    });

    symbol.addPin(pin1);
    expect(symbol.pins).toHaveLength(1);
    expect(symbol.findPin("A12")).toBeDefined();
    expect(symbol.findPin("B1")).toBeUndefined();
  });

  it("should prevent adding duplicate pin numbers to symbol", () => {
    const symbol = new SchematicSymbol({
      id: "SYM_U2700_A",
      refDes: "U2700",
      pageNumber: 12,
      bounds: new BoundingBox2D(100, 100, 300, 300),
    });

    const pin1 = new SchematicPinLocation({
      id: "PIN1",
      refDes: "U2700",
      pinNumber: "1",
      pageNumber: 12,
      bounds: new BoundingBox2D(10, 10, 20, 20),
      connectionPoint: { x: 10, y: 10 },
    });

    const pin2 = new SchematicPinLocation({
      id: "PIN2",
      refDes: "U2700",
      pinNumber: "1",
      pageNumber: 12,
      bounds: new BoundingBox2D(20, 20, 30, 30),
      connectionPoint: { x: 20, y: 20 },
    });

    symbol.addPin(pin1);
    expect(() => symbol.addPin(pin2)).toThrow("Duplicate pin 1");
  });
});
