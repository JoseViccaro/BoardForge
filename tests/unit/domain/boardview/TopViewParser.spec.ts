import { describe, it, expect } from "vitest";
import { TopViewParser } from "../../../../src/infrastructure/boardview/parsers/TopViewParser.js";
import { BoardViewFormat } from "../../../../src/domain/boardview/value-objects/BoardViewFormat.js";
import { LayerSide } from "../../../../src/domain/boardview/value-objects/LayerSide.js";

describe("TopViewParser", () => {
  const parser = new TopViewParser();

  it("should have supportedFormat set to TOPVIEW", () => {
    expect(parser.supportedFormat).toBe(BoardViewFormat.TOPVIEW);
  });

  it("should detect TopView headers in canParse", () => {
    const tvwHeader = new TextEncoder().encode("TVW_V1.0\0");
    expect(parser.canParse(tvwHeader)).toBe(true);
    expect(parser.canParse(new Uint8Array([1, 2, 3]), "test.tvw")).toBe(true);
  });

  it("should decode binary TVW blocks (outline, components, pins, nails)", async () => {
    // TVW binary layout:
    // Header: "TVW_" (4 bytes) + width(float32), height(float32), compCount(uint32), pinCount(uint32), nailCount(uint32)
    // Components: [refDes: 16b, x: float32, y: float32, rot: float32, side: uint8]
    // Pins: [compRef: 16b, pinRef: 8b, x: float32, y: float32, side: uint8, netName: 32b]
    // Nails: [id: 16b, x: float32, y: float32, side: uint8, netName: 32b]

    const buffer = new ArrayBuffer(512);
    const view = new DataView(buffer);
    const uint8 = new Uint8Array(buffer);

    // "TVW_"
    uint8.set(new TextEncoder().encode("TVW_"), 0);
    view.setFloat32(4, 75.0, true);
    view.setFloat32(8, 35.0, true);
    view.setUint32(12, 1, true); // 1 component
    view.setUint32(16, 1, true); // 1 pin
    view.setUint32(20, 1, true); // 1 nail

    let offset = 24;

    // Component: C1 at (15.0, 10.0), rot 0, side TOP(0)
    uint8.set(new TextEncoder().encode("C1\0"), offset);
    offset += 16;
    view.setFloat32(offset, 15.0, true);
    view.setFloat32(offset + 4, 10.0, true);
    view.setFloat32(offset + 8, 0.0, true);
    uint8[offset + 12] = 0;
    offset += 13;

    // Pin: C1.1 at (14.0, 10.0), side TOP(0), net PP_VDD_MAIN
    uint8.set(new TextEncoder().encode("C1\0"), offset);
    offset += 16;
    uint8.set(new TextEncoder().encode("1\0"), offset);
    offset += 8;
    view.setFloat32(offset, 14.0, true);
    view.setFloat32(offset + 4, 10.0, true);
    uint8[offset + 8] = 0;
    offset += 9;
    uint8.set(new TextEncoder().encode("PP_VDD_MAIN\0"), offset);
    offset += 32;

    // Nail: TP_TVW at (50.0, 20.0), side BOTTOM(1), net GND
    uint8.set(new TextEncoder().encode("TP_TVW\0"), offset);
    offset += 16;
    view.setFloat32(offset, 50.0, true);
    view.setFloat32(offset + 4, 20.0, true);
    uint8[offset + 8] = 1;
    offset += 9;
    uint8.set(new TextEncoder().encode("GND\0"), offset);
    offset += 32;

    const payload = new Uint8Array(buffer, 0, offset);
    const result = await parser.parse(payload, { subBoardName: "TopViewBoard" });

    expect(result.success).toBe(true);
    expect(result.document.format).toBe("TOPVIEW");
    expect(result.document.outline.width).toBe(75.0);
    expect(result.document.outline.height).toBe(35.0);

    expect(result.document.components.length).toBe(1);
    expect(result.document.components[0].refDes).toBe("C1");
    expect(result.document.components[0].pins.length).toBe(1);
    expect(result.document.components[0].pins[0].netName).toBe("PP_VDD_MAIN");

    expect(result.document.nails.length).toBe(1);
    expect(result.document.nails[0].id).toBe("TP_TVW");
    expect(result.document.nails[0].side).toBe(LayerSide.BOTTOM_SIDE);
    expect(result.document.nails[0].netName).toBe("GND");
  });
});
