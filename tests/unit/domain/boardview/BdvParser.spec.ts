import { describe, it, expect } from "vitest";
import { BdvParser } from "../../../../src/infrastructure/boardview/parsers/BdvParser.js";
import { BoardViewFormat } from "../../../../src/domain/boardview/value-objects/BoardViewFormat.js";
import { LayerSide } from "../../../../src/domain/boardview/value-objects/LayerSide.js";

describe("BdvParser", () => {
  const parser = new BdvParser();

  it("should have supportedFormat set to BDV", () => {
    expect(parser.supportedFormat).toBe(BoardViewFormat.BDV);
  });

  it("should detect BDV header or tokens in canParse", () => {
    const bdvHead = new TextEncoder().encode("#FORMAT: BDV\n#OUTLINE");
    expect(parser.canParse(bdvHead)).toBe(true);
    expect(parser.canParse(new Uint8Array([1, 2, 3]), "board.bdv")).toBe(true);
  });

  it("should parse text BDV sections (#OUTLINE, #COMPONENTS, #PINS, #NAILS)", async () => {
    const bdvContent = `
#FORMAT: BDV
#OUTLINE
0.0 0.0
80.0 0.0
80.0 40.0
0.0 40.0

#COMPONENTS
U1 10.0 20.0 0 TOP BGA100
U2 30.0 20.0 90 BOTTOM QFN32

#PINS
U1 1 9.0 19.0 TOP PP_VDD_MAIN
U1 2 11.0 19.0 TOP GND
U2 1 30.0 21.0 BOTTOM PP_BATT_VCC

#NAILS
TP1 50.0 10.0 TOP PP_VDD_MAIN
TP2 55.0 10.0 BOTTOM GND
`;

    const result = await parser.parse(bdvContent, { subBoardName: "BdvLogicBoard" });
    expect(result.success).toBe(true);
    expect(result.document.format).toBe("BDV");
    expect(result.document.outline.width).toBe(80.0);
    expect(result.document.outline.height).toBe(40.0);

    expect(result.document.components.length).toBe(2);
    const u1 = result.document.components.find(c => c.refDes === "U1")!;
    expect(u1.x).toBe(10.0);
    expect(u1.y).toBe(20.0);
    expect(u1.side).toBe(LayerSide.TOP_SIDE);
    expect(u1.pins.length).toBe(2);
    expect(u1.pins[0].netName).toBe("PP_VDD_MAIN");

    const u2 = result.document.components.find(c => c.refDes === "U2")!;
    expect(u2.side).toBe(LayerSide.BOTTOM_SIDE);
    expect(u2.rotation).toBe(90);

    expect(result.document.nails.length).toBe(2);
    expect(result.document.nails[0].id).toBe("TP1");
    expect(result.document.nails[0].netName).toBe("PP_VDD_MAIN");
  });
});
