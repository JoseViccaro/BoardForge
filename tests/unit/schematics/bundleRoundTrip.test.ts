import { describe, it, expect } from "vitest";
import { SchematicDocument } from "../../../src/domain/schematics/aggregates/SchematicDocument.js";
import { SchematicPage } from "../../../src/domain/schematics/entities/SchematicPage.js";
import { VectorToken, TokenType } from "../../../src/domain/schematics/value-objects/VectorToken.js";
import { BoundingBox2D } from "../../../src/domain/schematics/value-objects/BoundingBox2D.js";
import { NetLabelMatch } from "../../../src/domain/schematics/value-objects/NetLabelMatch.js";
import { SchematicBundleSerializer } from "../../../src/infrastructure/schematics/catalog/SchematicBundleSerializer.js";
import { HydrateBundle, classifyTokenType } from "../../../src/infrastructure/schematics/catalog/HydrateBundle.js";

function makeDocument(): SchematicDocument {
  const doc = new SchematicDocument({
    documentId: "SCH_iphone13_top",
    title: "iPhone 13 Top Schematic",
    pageCount: 2,
  });

  const page1 = new SchematicPage({ pageNumber: 1, width: 1000, height: 800 });
  page1.addToken(
    new VectorToken({
      text: "PP_VDD_MAIN",
      pageNumber: 1,
      bounds: new BoundingBox2D(120, 200, 175, 215),
      fontSize: 8,
      fontFamily: "Helvetica",
      tokenType: TokenType.NET_LABEL,
    })
  );
  page1.addToken(
    new VectorToken({
      text: "U2700",
      pageNumber: 1,
      bounds: new BoundingBox2D(300, 400, 360, 416),
      fontSize: 12,
      fontFamily: "Helvetica",
      tokenType: TokenType.DESIGNATOR,
    })
  );
  page1.addNetLabel(
    new NetLabelMatch({
      netName: "PP_VDD_MAIN",
      pageNumber: 1,
      bounds: new BoundingBox2D(120, 200, 175, 215),
    })
  );
  doc.addPage(page1);

  const page2 = new SchematicPage({ pageNumber: 2, width: 1000, height: 800 });
  page2.addToken(
    new VectorToken({
      text: "A12",
      pageNumber: 2,
      bounds: new BoundingBox2D(50, 80, 66, 92),
      fontSize: 9,
      tokenType: TokenType.PIN_NUM,
    })
  );
  page2.addToken(
    new VectorToken({
      text: "GND",
      pageNumber: 2,
      bounds: new BoundingBox2D(400, 100, 430, 112),
      fontSize: 8,
      tokenType: TokenType.NET_LABEL,
    })
  );
  doc.addPage(page2);

  return doc;
}

describe("SchematicBundleSerializer + HydrateBundle round-trip", () => {
  it("serializes a document and hydrates it back with matching token text/bounds/page/fontSize", () => {
    const doc = makeDocument();
    const bundle = SchematicBundleSerializer.serialize(doc, {
      sourceFilename: "iphone13_top.pdf",
    });

    expect(bundle.documentId).toBe("SCH_iphone13_top");
    expect(bundle.pageCount).toBe(2);

    const hydrated = HydrateBundle.hydrate(bundle);

    expect(hydrated).toBeInstanceOf(SchematicDocument);
    expect(hydrated.documentId).toBe("SCH_iphone13_top");
    expect(hydrated.pages.size).toBe(2);

    const p1 = hydrated.getPage(1)!;
    expect(p1.tokens.map((t) => t.text)).toEqual(["PP_VDD_MAIN", "U2700"]);
    const netToken = p1.tokens[0];
    expect(netToken.bounds.equals(new BoundingBox2D(120, 200, 175, 215))).toBe(true);
    expect(netToken.fontSize).toBe(8);
    expect(netToken.fontFamily).toBe("Helvetica");
    expect(netToken.pageNumber).toBe(1);

    const p2 = hydrated.getPage(2)!;
    expect(p2.tokens.map((t) => t.text)).toEqual(["A12", "GND"]);
    expect(p2.tokens[0].bounds.equals(new BoundingBox2D(50, 80, 66, 92))).toBe(true);
    expect(p2.tokens[0].fontSize).toBe(9);
    expect(p2.tokens[0].pageNumber).toBe(2);
  });

  it("hydrates net labels and preserves them on the page", () => {
    const hydrated = HydrateBundle.hydrate(
      SchematicBundleSerializer.serialize(makeDocument(), { sourceFilename: "x.pdf" })
    );
    const netLabels = hydrated.getPage(1)!.netLabels;
    expect(netLabels).toHaveLength(1);
    expect(netLabels[0].netName).toBe("PP_VDD_MAIN");
    expect(netLabels[0].pageNumber).toBe(1);
  });

  it("classifies net labels, designators, and pin numbers via the heuristic", () => {
    expect(classifyTokenType("PP_VDD_MAIN")).toBe(TokenType.NET_LABEL);
    expect(classifyTokenType("U2700")).toBe(TokenType.DESIGNATOR);
    expect(classifyTokenType("A12")).toBe(TokenType.PIN_NUM);
    expect(classifyTokenType("GND")).toBe(TokenType.NET_LABEL);
    expect(classifyTokenType("some text")).toBe(TokenType.TEXT);
  });
});
