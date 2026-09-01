/**
 * PR 3C (boardforge-redesign) — Overlay resolver core: cross-probe reverse map.
 * Strict-TDD RED specs.
 *
 * Pure logic tests (no DOM, node env): resolveNetOverlay reverse-maps a
 * selected boardview net through the domain SchematicCrossProbeIndex into the
 * schematic pages/regions the panel must highlight (schematics R2 — per-page
 * highlights on canonical pages, and the EMPTY + notInSchematic signal).
 */
import { describe, it, expect } from "vitest";
import { SchematicCrossProbeIndex } from "../../../../src/domain/schematics/services/SchematicCrossProbeIndex.js";
import { SchematicDocument } from "../../../../src/domain/schematics/aggregates/SchematicDocument.js";
import { SchematicPage } from "../../../../src/domain/schematics/entities/SchematicPage.js";
import { NetLabelMatch } from "../../../../src/domain/schematics/value-objects/NetLabelMatch.js";
import { BoundingBox2D } from "../../../../src/domain/schematics/value-objects/BoundingBox2D.js";
import { resolveNetOverlay } from "../../../../src/ui/schematics/overlay-resolve.js";

// ---------------------------------------------------------------------------
// Helpers — a registered cross-probe index over a small power-schematic doc
// ---------------------------------------------------------------------------

/**
 * Power-design document: net PP_VDD_MAIN appears on pages 2, 5, and 12
 * (page 12 twice — one label per region it must highlight).
 * Pages are registered out of order to prove canonical ordering is derived.
 */
function makePowerIndex(): SchematicCrossProbeIndex {
  const index = new SchematicCrossProbeIndex();
  const doc = new SchematicDocument({
    documentId: "doc-power",
    title: "Power Design",
    pageCount: 14,
  });

  const page12 = new SchematicPage({ pageNumber: 12, width: 1000, height: 800 });
  page12.addNetLabel(
    new NetLabelMatch({
      netName: "PP_VDD_MAIN",
      pageNumber: 12,
      bounds: new BoundingBox2D(100, 220, 200, 232),
    }),
  );
  page12.addNetLabel(
    new NetLabelMatch({
      netName: "PP_VDD_MAIN",
      pageNumber: 12,
      bounds: new BoundingBox2D(500, 700, 600, 712),
    }),
  );
  doc.addPage(page12);

  const page2 = new SchematicPage({ pageNumber: 2, width: 1000, height: 800 });
  page2.addNetLabel(
    new NetLabelMatch({
      netName: "PP_VDD_MAIN",
      pageNumber: 2,
      bounds: new BoundingBox2D(80, 120, 180, 132),
    }),
  );
  doc.addPage(page2);

  const page5 = new SchematicPage({ pageNumber: 5, width: 1000, height: 800 });
  page5.addNetLabel(
    new NetLabelMatch({
      netName: "PP_VDD_MAIN",
      pageNumber: 5,
      bounds: new BoundingBox2D(300, 400, 400, 412),
      rotation: 90,
    }),
  );
  doc.addPage(page5);

  index.registerSchematicDocument(doc);
  return index;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("resolveNetOverlay — boardview net → schematic highlights (R2)", () => {
  it("resolves every schematic occurrence into one highlight page per canonical page", () => {
    const overlay = resolveNetOverlay(makePowerIndex(), "PP_VDD_MAIN");

    expect(overlay.notInSchematic).toBe(false);
    expect(overlay.pageNumbers).toEqual([2, 5, 12]);
    expect(overlay.highlights.map((p) => p.pageNumber)).toEqual([2, 5, 12]);

    // Page 2 carries its single occurrence with the schematic's own bounds
    const page2 = overlay.highlights.find((p) => p.pageNumber === 2)!;
    expect(page2.regions).toHaveLength(1);
    expect(page2.regions[0].netName).toBe("PP_VDD_MAIN");
    expect(page2.regions[0].pageNumber).toBe(2);
    expect(page2.regions[0].bounds.equals(new BoundingBox2D(80, 120, 180, 132))).toBe(true);
  });

  it("groups repeated same-page occurrences into one page entry whose bounds cover all regions", () => {
    const overlay = resolveNetOverlay(makePowerIndex(), "PP_VDD_MAIN");

    const page12 = overlay.highlights.find((p) => p.pageNumber === 12)!;
    expect(page12.regions).toHaveLength(2);
    // Both PP_VDD_MAIN labels on page 12 must highlight
    expect(page12.regions.map((r) => r.bounds)).toEqual([
      new BoundingBox2D(100, 220, 200, 232),
      new BoundingBox2D(500, 700, 600, 712),
    ]);
    // The page highlight box unions both regions for a single repaint stroke
    expect(page12.bounds.equals(new BoundingBox2D(100, 220, 600, 712))).toBe(true);
  });

  it("preserves each occurrence's rotation from the schematic net label", () => {
    const overlay = resolveNetOverlay(makePowerIndex(), "PP_VDD_MAIN");

    const page5 = overlay.highlights.find((p) => p.pageNumber === 5)!;
    expect(page5.regions).toHaveLength(1);
    expect(page5.regions[0].rotation).toBe(90);
  });

  it("orders canonical pages ascending regardless of registration order", () => {
    // makePowerIndex registers 12 before 2 before 5; result must be [2, 5, 12]
    const overlay = resolveNetOverlay(makePowerIndex(), "PP_VDD_MAIN");

    expect(overlay.pageNumbers).toEqual([2, 5, 12]);
    expect(overlay.highlights.map((p) => p.pageNumber)).toEqual([2, 5, 12]);
  });

  it("resolves empty with the not-in-schematic signal when the net has no schematic occurrence", () => {
    // Index only knows PP_VDD_MAIN; the selected net PP_3V3_DIG has no labels
    const overlay = resolveNetOverlay(makePowerIndex(), "PP_3V3_DIG");

    expect(overlay.notInSchematic).toBe(true);
    expect(overlay.pageNumbers).toEqual([]);
    expect(overlay.highlights).toEqual([]);
  });

  it("resolves case-insensitively (net names normalize through the reverse map)", () => {
    const canonical = resolveNetOverlay(makePowerIndex(), "PP_VDD_MAIN");
    const lower = resolveNetOverlay(makePowerIndex(), "pp_vdd_main");
    const mixed = resolveNetOverlay(makePowerIndex(), "Pp_Vdd_Main");

    expect(lower.pageNumbers).toEqual(canonical.pageNumbers);
    expect(lower.notInSchematic).toBe(false);
    expect(mixed.highlights.map((p) => p.pageNumber)).toEqual([2, 5, 12]);
  });

  it("trims surrounding whitespace from the selected net before reverse-mapping", () => {
    const canonical = resolveNetOverlay(makePowerIndex(), "PP_VDD_MAIN");
    const padded = resolveNetOverlay(makePowerIndex(), "  PP_VDD_MAIN  ");

    expect(padded.notInSchematic).toBe(false);
    expect(padded.highlights.map((p) => p.pageNumber)).toEqual(canonical.highlights.map((p) => p.pageNumber));
  });

  it("does not resolve partial names — only exact net occurrences highlight", () => {
    // "PP_VDD" is a substring of PP_VDD_MAIN but not a registered net
    const partial = resolveNetOverlay(makePowerIndex(), "PP_VDD");

    expect(partial.notInSchematic).toBe(true);
    expect(partial.highlights).toEqual([]);
    expect(partial.pageNumbers).toEqual([]);
  });
});