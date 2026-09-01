/**
 * PR 3D (boardforge-redesign) — Page-navigation core.
 * Strict-TDD specs.
 *
 * Pure logic tests (no DOM, node env): jumpToRefDes lowers the panel onto a
 * multi-page component's first page and reports the full page list, and the
 * SchematicNavigator advances/recedes across the document's pages while
 * clamping at the first and last page (schematics R3 — page navigation).
 */
import { describe, it, expect } from "vitest";
import { MultiPageSymbolAggregate } from "../../../../src/domain/schematics/aggregates/MultiPageSymbolAggregate.js";
import { SchematicSymbol } from "../../../../src/domain/schematics/entities/SchematicSymbol.js";
import { BoundingBox2D } from "../../../../src/domain/schematics/value-objects/BoundingBox2D.js";
import { jumpToRefDes, SchematicNavigator } from "../../../../src/ui/schematics/schematic-nav.js";

function sym(id: string, pageNumber: number, refDes = "U2700"): SchematicSymbol {
  return new SchematicSymbol({
    id,
    refDes,
    pageNumber,
    bounds: new BoundingBox2D(0, 0, 100, 100),
  });
}

/** U2700 banks on pages 12, 13, 14 — registered 14, 12, 13 (unordered). */
function u2700Aggregate(): MultiPageSymbolAggregate {
  const agg = new MultiPageSymbolAggregate("U2700");
  agg.addSymbolBank(sym("c", 14));
  agg.addSymbolBank(sym("a", 12));
  agg.addSymbolBank(sym("b", 13));
  return agg;
}

describe("jumpToRefDes — jump to a multi-page component (R3)", () => {
  it("jumps to U2700's first page and reports the full page list", () => {
    const target = jumpToRefDes(u2700Aggregate());
    expect(target.pageNumber).toBe(12);
    expect(target.pageList).toEqual([12, 13, 14]);
  });

  it("orders the page list ascending regardless of bank registration order", () => {
    expect(jumpToRefDes(u2700Aggregate()).pageList).toEqual([12, 13, 14]);
  });

  it("jumps to a single-page component's only page", () => {
    const agg = new MultiPageSymbolAggregate("R100");
    agg.addSymbolBank(sym("a", 3, "R100"));
    const target = jumpToRefDes(agg);
    expect(target.pageNumber).toBe(3);
    expect(target.pageList).toEqual([3]);
  });
});

describe("SchematicNavigator — next/previous with bounds (R3)", () => {
  it("starts at the initial page", () => {
    const nav = new SchematicNavigator(20, 12);
    expect(nav.currentPage).toBe(12);
    expect(nav.totalPages).toBe(20);
  });

  it("advances to the next page and reports hasNext", () => {
    const nav = new SchematicNavigator(20, 12);
    expect(nav.hasNext).toBe(true);
    expect(nav.next()).toBe(13);
    expect(nav.currentPage).toBe(13);
  });

  it("clamps next at the last page", () => {
    const nav = new SchematicNavigator(20, 20);
    expect(nav.hasNext).toBe(false);
    expect(nav.next()).toBe(20);
  });

  it("steps back to the previous page and reports hasPrevious", () => {
    const nav = new SchematicNavigator(20, 13);
    expect(nav.hasPrevious).toBe(true);
    expect(nav.previous()).toBe(12);
  });

  it("clamps previous at the first page", () => {
    const nav = new SchematicNavigator(20, 1);
    expect(nav.hasPrevious).toBe(false);
    expect(nav.previous()).toBe(1);
  });

  it("jumps to an absolute page, clamping to the document bounds", () => {
    const nav = new SchematicNavigator(20, 1);
    expect(nav.jumpTo(13)).toBe(13);
    expect(nav.jumpTo(99)).toBe(20);
    expect(nav.jumpTo(0)).toBe(1);
  });
});
