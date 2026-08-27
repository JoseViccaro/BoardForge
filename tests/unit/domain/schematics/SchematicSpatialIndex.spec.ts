import { describe, it, expect, beforeEach } from "vitest";
import { SchematicSpatialIndex } from "../../../../src/domain/schematics/services/SchematicSpatialIndex.js";
import { BoundingBox2D } from "../../../../src/domain/schematics/value-objects/BoundingBox2D.js";
import { VectorToken, TokenType } from "../../../../src/domain/schematics/value-objects/VectorToken.js";

describe("SchematicSpatialIndex 2D Spatial Engine", () => {
  let index: SchematicSpatialIndex<VectorToken>;

  beforeEach(() => {
    index = new SchematicSpatialIndex<VectorToken>();
  });

  it("should insert items and query by point", () => {
    const token1 = new VectorToken({
      text: "U2700",
      pageNumber: 12,
      bounds: new BoundingBox2D(150, 200, 180, 212),
      fontSize: 10,
      tokenType: TokenType.DESIGNATOR,
    });
    const token2 = new VectorToken({
      text: "PP_VDD_MAIN",
      pageNumber: 12,
      bounds: new BoundingBox2D(210, 205, 280, 217),
      fontSize: 8,
      tokenType: TokenType.NET_LABEL,
    });
    const token3 = new VectorToken({
      text: "A12",
      pageNumber: 12,
      bounds: new BoundingBox2D(185, 206, 195, 214),
      fontSize: 7,
      tokenType: TokenType.PIN_NUM,
    });

    index.insert(token1.bounds, token1);
    index.insert(token2.bounds, token2);
    index.insert(token3.bounds, token3);

    const hit = index.queryPoint(160, 205);
    expect(hit).toHaveLength(1);
    expect(hit[0].text).toBe("U2700");

    const miss = index.queryPoint(0, 0);
    expect(miss).toHaveLength(0);
  });

  it("should query by bounding box range", () => {
    const token1 = new VectorToken({
      text: "U2700",
      pageNumber: 12,
      bounds: new BoundingBox2D(150, 200, 180, 212),
      fontSize: 10,
    });
    const token2 = new VectorToken({
      text: "PP_VDD_MAIN",
      pageNumber: 12,
      bounds: new BoundingBox2D(210, 205, 280, 217),
      fontSize: 8,
    });
    const token3 = new VectorToken({
      text: "A12",
      pageNumber: 12,
      bounds: new BoundingBox2D(185, 206, 195, 214),
      fontSize: 7,
    });

    index.insert(token1.bounds, token1);
    index.insert(token2.bounds, token2);
    index.insert(token3.bounds, token3);

    const searchBox = new BoundingBox2D(181, 200, 300, 220);
    const results = index.queryBox(searchBox);

    expect(results).toHaveLength(2);
    const texts = results.map((r) => r.text);
    expect(texts).toContain("PP_VDD_MAIN");
    expect(texts).toContain("A12");
    expect(texts).not.toContain("U2700");
  });

  it("should find nearest token within radial boundary", () => {
    const token1 = new VectorToken({
      text: "U2700",
      pageNumber: 12,
      bounds: new BoundingBox2D(100, 100, 120, 120),
      fontSize: 10,
    });
    const token2 = new VectorToken({
      text: "R1201",
      pageNumber: 12,
      bounds: new BoundingBox2D(200, 200, 220, 220),
      fontSize: 10,
    });

    index.insert(token1.bounds, token1);
    index.insert(token2.bounds, token2);

    const nearest = index.findNearest(105, 105, 30);
    expect(nearest).toBeDefined();
    expect(nearest?.text).toBe("U2700");

    const noneInRange = index.findNearest(0, 0, 10);
    expect(noneInRange).toBeUndefined();
  });

  it("should return all indexed items and count", () => {
    expect(index.count).toBe(0);
    const token = new VectorToken({
      text: "T1",
      pageNumber: 1,
      bounds: new BoundingBox2D(0, 0, 10, 10),
      fontSize: 8,
    });
    index.insert(token.bounds, token);
    expect(index.count).toBe(1);
    expect(index.all()).toHaveLength(1);
    index.clear();
    expect(index.count).toBe(0);
  });
});
