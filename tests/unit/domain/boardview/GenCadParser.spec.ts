import { describe, it, expect } from "vitest";
import { GenCadParser } from "../../../../src/infrastructure/boardview/parsers/GenCadParser.js";
import { BoardViewFormat, DiagnosticSeverity } from "../../../../src/domain/boardview/value-objects/BoardViewFormat.js";
import { LayerSide } from "../../../../src/domain/boardview/value-objects/LayerSide.js";

describe("GenCadParser", () => {
  const parser = new GenCadParser();

  it("should have supportedFormat set to GENCAD", () => {
    expect(parser.supportedFormat).toBe(BoardViewFormat.GENCAD);
  });

  it("should validate canParse correctly", () => {
    const bytes = new TextEncoder().encode("$HEADER\nGENCAD 1.4\n");
    expect(parser.canParse(bytes)).toBe(true);
    expect(parser.canParse(new Uint8Array([1, 2, 3]))).toBe(false);
  });

  it("should parse standard GenCAD sections ($HEADER, $BOARD, $COMPONENTS, $PINS, $SIGNALS)", async () => {
    const gencadContent = `
$HEADER
GENCAD 1.4
UNITS MM
$ENDHEADER

$BOARD
LINE 0.0 0.0 50.0 0.0
LINE 50.0 0.0 50.0 30.0
LINE 50.0 30.0 0.0 30.0
LINE 0.0 30.0 0.0 0.0
$ENDBOARD

$COMPONENTS
COMPONENT U1
DEVICE BGA
PLACE 15.0 20.0
LAYER TOP
ROTATION 0
$ENDCOMPONENTS

$PINS
PIN U1 1 14.5 19.5 TOP
PIN U1 2 15.5 19.5 TOP
PIN U1 A1 14.5 20.5 BOTTOM
$ENDPINS

$SIGNALS
SIGNAL PP_VDD_MAIN
NODE U1 1
SIGNAL GND
NODE U1 2
$ENDSIGNALS
`;

    const result = await parser.parse(gencadContent, { subBoardName: "MainBoard" });
    expect(result.success).toBe(true);
    expect(result.document.format).toBe("GENCAD");
    expect(result.document.outline.width).toBe(50.0);
    expect(result.document.outline.height).toBe(30.0);
    expect(result.document.outline.polygon.length).toBe(4);

    expect(result.document.components.length).toBe(1);
    const u1 = result.document.components[0];
    expect(u1.refDes).toBe("U1");
    expect(u1.x).toBe(15.0);
    expect(u1.y).toBe(20.0);
    expect(u1.side).toBe(LayerSide.TOP_SIDE);

    expect(u1.pins.length).toBe(3);
    const pin1 = u1.pins.find(p => p.pinRef === "1");
    expect(pin1?.netName).toBe("PP_VDD_MAIN");
    expect(pin1?.side).toBe(LayerSide.TOP_SIDE);

    const pin2 = u1.pins.find(p => p.pinRef === "2");
    expect(pin2?.netName).toBe("GND");

    const pinA1 = u1.pins.find(p => p.pinRef === "A1");
    expect(pinA1?.side).toBe(LayerSide.BOTTOM_SIDE);
    expect(pinA1?.netName).toBe("UNCONNECTED");
  });

  it("should record diagnostic warning for unknown sections but continue parsing", async () => {
    const content = `
$HEADER
GENCAD 1.4
$ENDHEADER
$UNKNOWN_CUSTOM_SECTION
FOO BAR BAZ
$ENDUNKNOWN_CUSTOM_SECTION
$COMPONENTS
COMPONENT R1
PLACE 5.0 5.0
LAYER BOTTOM
$ENDCOMPONENTS
`;
    const result = await parser.parse(content);
    expect(result.success).toBe(true);
    expect(result.document.components.length).toBe(1);
    expect(result.document.components[0].refDes).toBe("R1");
    expect(result.diagnostics.some(d => d.severity === DiagnosticSeverity.WARNING && d.code === "UNKNOWN_GENCAD_SECTION")).toBe(true);
  });
});
