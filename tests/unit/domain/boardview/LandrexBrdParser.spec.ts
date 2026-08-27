import { describe, it, expect } from "vitest";
import { LandrexBrdParser } from "../../../../src/infrastructure/boardview/parsers/LandrexBrdParser.js";
import { BoardViewFormat } from "../../../../src/domain/boardview/value-objects/BoardViewFormat.js";
import { LayerSide } from "../../../../src/domain/boardview/value-objects/LayerSide.js";

describe("LandrexBrdParser", () => {
  const parser = new LandrexBrdParser();

  it("should have supportedFormat set to LANDREX_BRD", () => {
    expect(parser.supportedFormat).toBe(BoardViewFormat.LANDREX_BRD);
  });

  it("should detect Landrex signature in canParse", () => {
    const brdMagic = new TextEncoder().encode("BRD2\x00\x00");
    expect(parser.canParse(brdMagic)).toBe(true);
    expect(parser.canParse(new Uint8Array([1, 2, 3]), "test.brd")).toBe(true);
  });

  it("should decode Landrex binary records (outline, components, pins, nails)", async () => {
    // Construct a synthetic Landrex BRD binary buffer
    // Header: "BRD2" (4 bytes) + numPoints(uint32), numNails(uint32), numComponents(uint32), numPins(uint32)
    // Points: [x: int32, y: int32] * numPoints (scale: 1000 units = 1 mm)
    // Nails: [id: 16 bytes cstring, x: int32, y: int32, side: uint8, netName: 32 bytes cstring]
    // Components: [refDes: 16 bytes cstring, x: int32, y: int32, rotation: float32, side: uint8]
    // Pins: [compRef: 16 bytes, pinRef: 8 bytes, x: int32, y: int32, side: uint8, netName: 32 bytes]

    const buffer = new ArrayBuffer(512);
    const view = new DataView(buffer);
    const uint8 = new Uint8Array(buffer);

    // Magic "BRD2"
    uint8[0] = 0x42; uint8[1] = 0x52; uint8[2] = 0x44; uint8[3] = 0x32;
    view.setUint32(4, 4, true); // 4 outline points
    view.setUint32(8, 1, true); // 1 nail
    view.setUint32(12, 1, true); // 1 component
    view.setUint32(16, 2, true); // 2 pins

    let offset = 20;

    // 4 Outline points: (0,0), (100000, 0), (100000, 50000), (0, 50000) -> 100mm x 50mm
    const pts = [[0,0], [100000, 0], [100000, 50000], [0, 50000]];
    for (const [x, y] of pts) {
      view.setInt32(offset, x, true);
      view.setInt32(offset + 4, y, true);
      offset += 8;
    }

    // 1 Nail: TP1 at (10000, 20000) -> (10mm, 20mm), side TOP(0), net PP_BATT_VCC
    const nailId = new TextEncoder().encode("TP1\0");
    uint8.set(nailId, offset);
    offset += 16;
    view.setInt32(offset, 10000, true);
    view.setInt32(offset + 4, 20000, true);
    uint8[offset + 8] = 0; // Top
    offset += 9;
    const nailNet = new TextEncoder().encode("PP_BATT_VCC\0");
    uint8.set(nailNet, offset);
    offset += 32;

    // 1 Component: U2700 at (30000, 25000) -> (30mm, 25mm), rotation 90, side TOP(0)
    const compRef = new TextEncoder().encode("U2700\0");
    uint8.set(compRef, offset);
    offset += 16;
    view.setInt32(offset, 30000, true);
    view.setInt32(offset + 4, 25000, true);
    view.setFloat32(offset + 8, 90.0, true);
    uint8[offset + 12] = 0; // Top
    offset += 13;

    // Pin 1: U2700.1 at (29000, 25000) -> (29mm, 25mm), side TOP, net PP_BATT_VCC
    uint8.set(new TextEncoder().encode("U2700\0"), offset);
    offset += 16;
    uint8.set(new TextEncoder().encode("1\0"), offset);
    offset += 8;
    view.setInt32(offset, 29000, true);
    view.setInt32(offset + 4, 25000, true);
    uint8[offset + 8] = 0; // Top
    offset += 9;
    uint8.set(new TextEncoder().encode("PP_BATT_VCC\0"), offset);
    offset += 32;

    // Pin 2: U2700.2 at (31000, 25000) -> (31mm, 25mm), side TOP, net GND
    uint8.set(new TextEncoder().encode("U2700\0"), offset);
    offset += 16;
    uint8.set(new TextEncoder().encode("2\0"), offset);
    offset += 8;
    view.setInt32(offset, 31000, true);
    view.setInt32(offset + 4, 25000, true);
    uint8[offset + 8] = 0; // Top
    offset += 9;
    uint8.set(new TextEncoder().encode("GND\0"), offset);
    offset += 32;

    const payload = new Uint8Array(buffer, 0, offset);
    const result = await parser.parse(payload, { subBoardName: "LandrexLogicBoard" });

    expect(result.success).toBe(true);
    expect(result.document.format).toBe("LANDREX_BRD");
    expect(result.document.outline.width).toBe(100.0);
    expect(result.document.outline.height).toBe(50.0);

    expect(result.document.nails.length).toBe(1);
    expect(result.document.nails[0].id).toBe("TP1");
    expect(result.document.nails[0].x).toBe(10.0);
    expect(result.document.nails[0].y).toBe(20.0);
    expect(result.document.nails[0].netName).toBe("PP_BATT_VCC");

    expect(result.document.components.length).toBe(1);
    const comp = result.document.components[0];
    expect(comp.refDes).toBe("U2700");
    expect(comp.x).toBe(30.0);
    expect(comp.y).toBe(25.0);
    expect(comp.rotation).toBe(90.0);
    expect(comp.pins.length).toBe(2);
    expect(comp.pins[0].pinRef).toBe("1");
    expect(comp.pins[0].x).toBe(29.0);
    expect(comp.pins[0].netName).toBe("PP_BATT_VCC");
  });
});
