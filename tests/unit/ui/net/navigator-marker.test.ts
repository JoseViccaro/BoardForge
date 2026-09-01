/**
 * Unit 5C — Net navigator marker helper (strict-TDD RED specs).
 * Pure logic tests: resolveNetMarker maps boardview net → schematic presence
 * marker (R2/R3 UI, R2 empty signal for "not-in-schematic").
 */
import { describe, it, expect } from "vitest";
import { SchematicCrossProbeIndex } from "../../../../src/domain/schematics/services/SchematicCrossProbeIndex.js";
import { SchematicDocument } from "../../../../src/domain/schematics/aggregates/SchematicDocument.js";
import { SchematicPage } from "../../../../src/domain/schematics/entities/SchematicPage.js";
import { NetLabelMatch } from "../../../../src/domain/schematics/value-objects/NetLabelMatch.js";
import { BoundingBox2D } from "../../../../src/domain/schematics/value-objects/BoundingBox2D.js";
import { resolveNetMarker, type NetMarker } from "../../../../src/ui/net/navigator-marker.js";

/** Index with PP_VDD_MAIN (pages 2, 12) and PP_GND (page 4). */
function makeTestIndex(): SchematicCrossProbeIndex {
  const index = new SchematicCrossProbeIndex();
  const doc = new SchematicDocument({ documentId: "doc-test", title: "Test", pageCount: 14 });

  const page2 = new SchematicPage({ pageNumber: 2, width: 800, height: 600 });
  page2.addNetLabel(new NetLabelMatch({ netName: "PP_VDD_MAIN", pageNumber: 2, bounds: new BoundingBox2D(80, 120, 180, 132) }));
  doc.addPage(page2);

  const page4 = new SchematicPage({ pageNumber: 4, width: 800, height: 600 });
  page4.addNetLabel(new NetLabelMatch({ netName: "PP_GND", pageNumber: 4, bounds: new BoundingBox2D(200, 300, 300, 312) }));
  doc.addPage(page4);

  const page12 = new SchematicPage({ pageNumber: 12, width: 800, height: 600 });
  page12.addNetLabel(new NetLabelMatch({ netName: "PP_VDD_MAIN", pageNumber: 12, bounds: new BoundingBox2D(100, 220, 200, 232) }));
  page12.addNetLabel(new NetLabelMatch({ netName: "PP_VDD_MAIN", pageNumber: 12, bounds: new BoundingBox2D(500, 700, 600, 712) }));
  doc.addPage(page12);

  index.registerSchematicDocument(doc);
  return index;
}

describe("resolveNetMarker — net → schematic presence marker (R2/R3 UI)", () => {
  it("returns 'mapped' with all canonical page numbers when net is present", () => {
    const marker: NetMarker = resolveNetMarker(makeTestIndex(), "PP_VDD_MAIN");
    expect(marker.type).toBe("mapped");
    expect(marker.netName).toBe("PP_VDD_MAIN");
    expect(marker.pageNumbers).toEqual([2, 12]);
  });

  it("returns 'not-in-schematic' when net has no occurrence (R2 empty signal)", () => {
    const marker = resolveNetMarker(makeTestIndex(), "PP_3V3_DIG");
    expect(marker.type).toBe("not-in-schematic");
    expect(marker.netName).toBe("PP_3V3_DIG");
    expect(marker.pageNumbers).toEqual([]);
  });

  it("resolves case-insensitively", () => {
    const index = makeTestIndex();
    const canonical = resolveNetMarker(index, "PP_VDD_MAIN");
    expect(resolveNetMarker(index, "pp_vdd_main").type).toBe("mapped");
    expect(resolveNetMarker(index, "pp_vdd_main").pageNumbers).toEqual(canonical.pageNumbers);
    expect(resolveNetMarker(index, "Pp_Vdd_Main").type).toBe("mapped");
    expect(resolveNetMarker(index, "Pp_Vdd_Main").pageNumbers).toEqual(canonical.pageNumbers);
  });

  it("trims surrounding whitespace before resolving", () => {
    const marker = resolveNetMarker(makeTestIndex(), "  PP_VDD_MAIN  ");
    expect(marker.type).toBe("mapped");
    expect(marker.netName).toBe("PP_VDD_MAIN");
    expect(marker.pageNumbers).toEqual([2, 12]);
  });

  it("does not match partial names — only exact occurrences count", () => {
    const marker = resolveNetMarker(makeTestIndex(), "PP_VDD");
    expect(marker.type).toBe("not-in-schematic");
    expect(marker.pageNumbers).toEqual([]);
  });

  it("returns a single-page marker for nets with one occurrence", () => {
    const marker = resolveNetMarker(makeTestIndex(), "PP_GND");
    expect(marker.type).toBe("mapped");
    expect(marker.pageNumbers).toEqual([4]);
  });
});
