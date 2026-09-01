/**
 * PR 3B (boardforge-redesign) — HitTester core: spatial index over token bounds.
 * Strict-TDD RED specs.
 *
 * Pure logic tests (no DOM, node env): the HitTester buckets VectorTokens into
 * a per-page cell grid and maps a schematic page coordinate back to the token
 * under the cursor (schematics R2 prerequisite: coord → token).
 */
import { describe, it, expect } from "vitest";
import { VectorToken, TokenType } from "../../../../src/domain/schematics/value-objects/VectorToken.js";
import { BoundingBox2D } from "../../../../src/domain/schematics/value-objects/BoundingBox2D.js";
import { HitTester } from "../../../../src/ui/schematics/HitTester.js";

// ---------------------------------------------------------------------------
// Helpers — build VectorTokens quickly (same style as VectorRenderer tests)
// ---------------------------------------------------------------------------

function token(
  text: string,
  page: number,
  x: number,
  y: number,
  w: number,
  h: number,
  fontSize = 12,
  tokenType: TokenType = TokenType.TEXT,
): VectorToken {
  return new VectorToken({
    text,
    pageNumber: page,
    bounds: new BoundingBox2D(x, y, x + w, y + h),
    fontSize,
    tokenType,
  });
}

// R1/R2 fixture — parsed schematic page 12 with U2700, PP_VDD_MAIN, A12
function makePage12Tokens(): VectorToken[] {
  return [
    token("U2700", 12, 100, 200, 60, 16, 14, TokenType.DESIGNATOR),
    token("PP_VDD_MAIN", 12, 100, 220, 100, 12, 10, TokenType.NET_LABEL),
    token("A12", 12, 300, 400, 30, 12, 9, TokenType.PIN_NUM),
  ];
}

// Sparse synthetic grid — tokens in far-apart cells (cell refinement)
function makeSparseGrid(): VectorToken[] {
  return [
    token("CELL_A", 1, 100, 100, 10, 10),
    token("CELL_B", 1, 600, 600, 20, 14),
  ];
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("HitTester — hitTest (coord → token, R2 prerequisite)", () => {
  it("returns the token whose bounds contain the point on the requested page", () => {
    const tester = new HitTester(makePage12Tokens());

    // Inside U2700 bounds (100,200)-(160,216), far from the other tokens
    const hit = tester.hitTest(110, 205, 12);

    expect(hit).not.toBeNull();
    expect(hit!.text).toBe("U2700");
    expect(hit!.pageNumber).toBe(12);
    expect(hit!.tokenType).toBe(TokenType.DESIGNATOR);
  });

  it("hits a point just outside the bounds when within the hit tolerance", () => {
    const tolerance = 4;
    const tester = new HitTester(makePage12Tokens(), { tolerance });

    // U2700 maxX = 160; 163 is 3px beyond, inside the 4px tolerance
    const hit = tester.hitTest(163, 200, 12);

    expect(hit).not.toBeNull();
    expect(hit!.text).toBe("U2700");
  });

  it("returns null when the point is beyond the hit tolerance", () => {
    const tolerance = 4;
    const tester = new HitTester(makePage12Tokens(), { tolerance });

    // U2700 maxX = 160; 165 is 5px beyond, outside the 4px tolerance
    expect(tester.hitTest(165, 200, 12)).toBeNull();
  });

  it("returns only tokens whose bounds intersect the query rect", () => {
    const tester = new HitTester(makePage12Tokens());

    // Box clips the right edge of U2700 (maxX 160) but sits above PP_VDD_MAIN (minY 220)
    const hits = tester.queryRect(new BoundingBox2D(150, 195, 170, 210), 12);

    expect(hits.map((t) => t.text)).toEqual(["U2700"]);
  });

  it("returns an empty list for a rect that covers no tokens", () => {
    const tester = new HitTester(makePage12Tokens());

    // Empty band below every token on page 12 (all tokens end at y <= 412)
    const hits = tester.queryRect(new BoundingBox2D(0, 500, 100, 600), 12);

    expect(hits).toEqual([]);
  });

  it("resolves tokens from their own cell in a sparse grid (cell refinement)", () => {
    // Explicit cellSize: CELL_A lives in cell (1,1), CELL_B lives in cell (9,9)
    const tester = new HitTester(makeSparseGrid(), { cellSize: 64 });

    expect(tester.hitTest(105, 105, 1)?.text).toBe("CELL_A");
    expect(tester.hitTest(610, 607, 1)?.text).toBe("CELL_B");
  });

  it("returns null for a point in an empty region of a populated page", () => {
    const tester = new HitTester(makePage12Tokens());

    // (500,500) sits between the token clusters — no bounds contain it
    expect(tester.hitTest(500, 500, 12)).toBeNull();
  });

  it("returns null when the point's page has no tokens (out-of-page)", () => {
    const tester = new HitTester(makePage12Tokens());
    const pointInU2700 = { x: 110, y: 205 };

    // Same coordinate, wrong page → no hit; correct page → hit
    expect(tester.hitTest(pointInU2700.x, pointInU2700.y, 13)).toBeNull();
    expect(tester.hitTest(pointInU2700.x, pointInU2700.y, 12)?.text).toBe("U2700");
  });
});