import { describe, it, expect, beforeEach } from "vitest";
import { iPhone13SchematicFixtures } from "../../src/infrastructure/seeds/iPhone13SchematicFixtures.js";
import { SchematicCrossProbeIndex } from "../../src/domain/schematics/services/SchematicCrossProbeIndex.js";

describe("iPhone 13 Schematic Fixtures & Cross-Probing Integration", () => {
  let crossProbeIndex: SchematicCrossProbeIndex;

  beforeEach(() => {
    crossProbeIndex = new SchematicCrossProbeIndex();
    const fixtures = iPhone13SchematicFixtures.createFixtures();
    crossProbeIndex.registerSchematicDocument(fixtures.document);
    for (const topology of fixtures.topologies) {
      crossProbeIndex.registerBoardViewTopology(topology, fixtures.subBoards);
    }
  });

  it("should cross-probe U2700 Bank A (Page 12) pins from BoardView to Schematic", () => {
    // U2700 Pin A12 (PP_VDD_MAIN)
    const hitsA12 = crossProbeIndex.queryFromBoardViewPin("U2700", "A12");
    expect(hitsA12).toHaveLength(1);
    expect(hitsA12[0].pageNumber).toBe(12);
    expect(hitsA12[0].netName).toBe("PP_VDD_MAIN");

    // U2700 Pin C1 (PP_VDD_CPU_CORE)
    const hitsC1 = crossProbeIndex.queryFromBoardViewPin("U2700", "C1");
    expect(hitsC1).toHaveLength(1);
    expect(hitsC1[0].pageNumber).toBe(12);
    expect(hitsC1[0].netName).toBe("PP_VDD_CPU_CORE");
  });

  it("should cross-probe U2700 Bank B (Page 13) pins across multi-page aggregate", () => {
    // U2700 Pin E5 (PP1V8_S2)
    const hitsE5 = crossProbeIndex.queryFromBoardViewPin("U2700", "E5");
    expect(hitsE5).toHaveLength(1);
    expect(hitsE5[0].pageNumber).toBe(13);
    expect(hitsE5[0].netName).toBe("PP1V8_S2");

    // U2700 Pin F2 (BUTTON_TO_PMU_ONOFF_L)
    const hitsF2 = crossProbeIndex.queryFromBoardViewPin("U2700", "F2");
    expect(hitsF2).toHaveLength(1);
    expect(hitsF2[0].pageNumber).toBe(13);
    expect(hitsF2[0].netName).toBe("BUTTON_TO_PMU_ONOFF_L");
  });

  it("should cross-probe U3300 Charger (Page 25) and U_BB_PMU (Page 48)", () => {
    const hitsCharger = crossProbeIndex.queryFromBoardViewPin("U3300", "1");
    expect(hitsCharger).toHaveLength(1);
    expect(hitsCharger[0].pageNumber).toBe(25);
    expect(hitsCharger[0].netName).toBe("PP_BATT_VCC");

    const hitsBB = crossProbeIndex.queryFromBoardViewPin("U_BB_PMU", "C4");
    expect(hitsBB).toHaveLength(1);
    expect(hitsBB[0].pageNumber).toBe(48);
    expect(hitsBB[0].netName).toBe("PP_VDD_MAIN");
  });

  it("should resolve schematic coordinate on Page 12 to physical BoardView pads and Interposer junction", () => {
    // Coordinate clicking over net PP_VDD_MAIN on page 12
    const result = crossProbeIndex.queryFromSchematicCoordinate(12, 185, 207);
    expect(result.netName).toBe("PP_VDD_MAIN");
    expect(result.pinHits.length).toBeGreaterThanOrEqual(2);

    // Should include Top Logic pad and Bottom RF pad
    const padIds = result.pinHits.map((p) => p.padId);
    expect(padIds).toContain("PAD_TOP_U2700_A12");
    expect(padIds).toContain("PAD_BOT_UBB_C4");

    // Should include interposer bridge junction INT_PAD_084
    expect(result.interposerJunctions.some((j) => j.interposerPadId === "INT_PAD_084")).toBe(true);
  });
});
