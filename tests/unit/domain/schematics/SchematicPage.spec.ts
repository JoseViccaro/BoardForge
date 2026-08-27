import { describe, it, expect, beforeEach } from "vitest";
import { SchematicPage } from "../../../../src/domain/schematics/entities/SchematicPage.js";
import { BoundingBox2D } from "../../../../src/domain/schematics/value-objects/BoundingBox2D.js";
import { VectorToken, TokenType } from "../../../../src/domain/schematics/value-objects/VectorToken.js";
import { NetLabelMatch } from "../../../../src/domain/schematics/value-objects/NetLabelMatch.js";
import { SchematicSymbol } from "../../../../src/domain/schematics/entities/SchematicSymbol.js";
import { SchematicPinLocation } from "../../../../src/domain/schematics/entities/SchematicPinLocation.js";

describe("SchematicPage Entity", () => {
  let page: SchematicPage;

  beforeEach(() => {
    page = new SchematicPage({
      pageNumber: 12,
      width: 1000,
      height: 800,
    });
  });

  it("should create SchematicPage with dimensions and empty collections", () => {
    expect(page.pageNumber).toBe(12);
    expect(page.width).toBe(1000);
    expect(page.height).toBe(800);
    expect(page.tokens).toHaveLength(0);
    expect(page.symbols).toHaveLength(0);
    expect(page.netLabels).toHaveLength(0);
  });

  it("should validate page number and positive dimensions", () => {
    expect(() => new SchematicPage({ pageNumber: 0, width: 100, height: 100 })).toThrow("pageNumber must be a positive integer");
    expect(() => new SchematicPage({ pageNumber: 1, width: 0, height: 100 })).toThrow("width and height must be positive");
  });

  it("should add tokens and query via spatial index", () => {
    const token = new VectorToken({
      text: "U2700",
      pageNumber: 12,
      bounds: new BoundingBox2D(100, 100, 150, 120),
      fontSize: 12,
      tokenType: TokenType.DESIGNATOR,
    });

    page.addToken(token);
    expect(page.tokens).toHaveLength(1);

    const hit = page.queryPoint(110, 110);
    expect(hit).toHaveLength(1);
    expect(hit[0].text).toBe("U2700");

    const boxHits = page.queryBox(new BoundingBox2D(90, 90, 160, 130));
    expect(boxHits).toHaveLength(1);

    const nearest = page.findNearestToken(120, 110, 20);
    expect(nearest).toBeDefined();
    expect(nearest?.text).toBe("U2700");
  });

  it("should add and retrieve symbols and net labels", () => {
    const symbol = new SchematicSymbol({
      id: "SYM_U2700_A",
      refDes: "U2700",
      bankDesignator: "A",
      pageNumber: 12,
      bounds: new BoundingBox2D(100, 100, 300, 300),
    });
    page.addSymbol(symbol);

    const netLabel = new NetLabelMatch({
      netName: "PP_VDD_MAIN",
      pageNumber: 12,
      bounds: new BoundingBox2D(250, 150, 320, 160),
    });
    page.addNetLabel(netLabel);

    expect(page.symbols).toHaveLength(1);
    expect(page.netLabels).toHaveLength(1);
    expect(page.getSymbolByRefDes("U2700")).toBeDefined();
    expect(page.getNetLabelsByName("PP_VDD_MAIN")).toHaveLength(1);
  });
});
