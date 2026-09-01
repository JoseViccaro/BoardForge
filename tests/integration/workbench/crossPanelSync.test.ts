/**
 * PR 4A (boardforge-redesign) — Cross-panel sync integration.
 * Strict-TDD RED specs.
 *
 * Boardview -> bus -> schematic: a boardview net selection propagates through
 * the WorkbenchEventBus `selection.change` event and is consumed by the
 * schematic panel handler (`applySelectionToSchematic`, the exact wiring the
 * SchematicPanel effect subscribes with) so it drives the cross-probe overlay
 * through `SchematicCrossProbeIndex.queryFromBoardViewNet` + `resolveNetOverlay`
 * (schematics R2 — per-page highlights on canonical pages, and the EMPTY +
 * not-in-schematic signal for nets with no counterpart).
 *
 * Pure node Vitest (no DOM/canvas): real bus + facade + cross-probe index,
 * the panel-equivalent handler probed directly. No domain logic duplicated —
 * the handler is the very function the panel's bus subscription calls.
 */
import { describe, it, expect, vi } from "vitest";
import { WorkbenchEventBus } from "../../../src/application/workbench/WorkbenchEventBus.js";
import { WorkbenchFacade } from "../../../src/application/workbench/WorkbenchFacade.js";
import { SessionStore } from "../../../src/application/workbench/SessionStore.js";
import { SchematicDocument } from "../../../src/domain/schematics/aggregates/SchematicDocument.js";
import { SchematicCrossProbeIndex } from "../../../src/domain/schematics/services/SchematicCrossProbeIndex.js";
import { iPhone13SchematicFixtures } from "../../../src/infrastructure/seeds/iPhone13SchematicFixtures.js";
import { SchematicNavigator } from "../../../src/ui/schematics/schematic-nav.js";
import {
  applySelectionToSchematic,
  type SchematicSyncReaction,
} from "../../../src/ui/schematics/schematic-sync.js";

// ---------------------------------------------------------------------------
// Assembly — realistic sine-qua-non wiring: facade + bus + cross-probe index
// ---------------------------------------------------------------------------

interface SyncRig {
  facade: WorkbenchFacade;
  bus: WorkbenchEventBus;
  document: SchematicDocument;
  crossProbe: SchematicCrossProbeIndex;
  /** The last reaction produced by the panel-equivalent bus subscription. */
  last: { value: SchematicSyncReaction | null };
  /** Panel-equivalent subscription representing SchematicPanel's useEffect. */
  subscribeAsPanel: () => void;
}

function buildSyncRig(): SyncRig {
  const bus = new WorkbenchEventBus();
  const sessionStore = new SessionStore({
    read: async () => null,
    write: async () => undefined,
    delete: async () => undefined,
  });
  const facade = new WorkbenchFacade({
    boardViewFacade: {
      uploadBoardView: vi.fn(),
      getBoardView: vi.fn(async () => ({
        boardId: "BRD_820_02106",
        boardNumber: "820-02106",
        stackType: "SANDWICH_INTERPOSER",
        subBoards: [],
      })),
      getNets: vi.fn(async () => ({ nets: [] })),
    },
    schematicsFacade: {
      saveDocument: vi.fn(),
      uploadSchematic: vi.fn(),
      searchSymbols: vi.fn(),
      getPage: vi.fn(),
    },
    measurementsFacade: {
      getReferences: vi.fn(),
      createReference: vi.fn(),
      recordMeasurement: vi.fn(),
    },
    bus,
    sessionStore,
    defaultBoardModel: "iPhone13",
  });

  const fixtures = iPhone13SchematicFixtures.createFixtures();
  const document = fixtures.document;
  const crossProbe = new SchematicCrossProbeIndex();
  crossProbe.registerSchematicDocument(document);

  const last: SyncRig["last"] = { value: null };
  const navigator = new SchematicNavigator(document.pageCount, 1);

  const subscribeAsPanel: SyncRig["subscribeAsPanel"] = () => {
    // Mirrors SchematicPanel's useEffect bus subscription (PR 3E wiring):
    // on every selection.change, react through the shared cross-probe index.
    bus.subscribe("selection.change", (selection) => {
      last.value = applySelectionToSchematic(crossProbe, document, navigator, selection);
    });
  };

  return { facade, bus, document, crossProbe, last, subscribeAsPanel };
}

// ---------------------------------------------------------------------------
// Tests — the cooperation of boardview emission and schematic consumption
// ---------------------------------------------------------------------------

describe("cross-panel sync (4A): boardview selection -> bus -> schematic overlay", () => {
  it("emits selection.change on the bus and the schematic handler resolves highlights via queryFromBoardViewNet", () => {
    const { facade, bus, subscribeAsPanel, last } = buildSyncRig();
    subscribeAsPanel();

    const seen = vi.fn();
    bus.subscribe("selection.change", seen);

    // Boardview emits a net selection through the shared facade (D2 flow).
    facade.select({ boardId: "BRD_820_02106", net: "PP_VDD_MAIN" });

    expect(seen).toHaveBeenCalledTimes(1);
    expect(seen).toHaveBeenCalledWith({ boardId: "BRD_820_02106", net: "PP_VDD_MAIN" });

    // The schematic handler consumed it and reverse-mapped via the index.
    const reaction = last.value!;
    expect(reaction.activeNet).toBe("PP_VDD_MAIN");
    expect(reaction.overlay.notInSchematic).toBe(false);
    expect(reaction.overlay.pageNumbers).toEqual([12]);
  });

  it("drives the overlay highlight from the canonical page region the index returns", () => {
    const { facade, subscribeAsPanel, last } = buildSyncRig();
    subscribeAsPanel();

    facade.select({ boardId: "BRD_820_02106", net: "PP_VDD_MAIN" });

    const reaction = last.value!;
    // The page 12 net label becomes one highlight region the panel strokes.
    expect(reaction.notInSchematic).toBe(false);
    expect(reaction.overlay.highlights).toHaveLength(1);
    expect(reaction.overlay.highlights[0].pageNumber).toBe(12);
  });

  it("navigates the schematic to the first canonical page of the selected net", () => {
    const { facade, subscribeAsPanel, last } = buildSyncRig();
    subscribeAsPanel();

    facade.select({ boardId: "BRD_820_02106", net: "PP_VDD_MAIN" });

    const reaction = last.value!;
    expect(reaction.pageToShow).toBe(12);
  });

  it("signals empty with no highlight and no navigation when the net has no schematic counterpart (R2 empty)", () => {
    const { facade, subscribeAsPanel, last } = buildSyncRig();
    subscribeAsPanel();

    // PP_3V3_DIG has no net label in the schematic fixtures.
    facade.select({ boardId: "BRD_820_02106", net: "PP_3V3_DIG" });

    const reaction = last.value!;
    expect(reaction.activeNet).toBe("PP_3V3_DIG");
    expect(reaction.notInSchematic).toBe(true);
    expect(reaction.overlay.notInSchematic).toBe(true);
    expect(reaction.overlay.highlights).toEqual([]);
    expect(reaction.overlay.pageNumbers).toEqual([]);
    // No page to navigate to — the panel shows the NOT-IN-SCHEMATIC marker.
    expect(reaction.pageToShow).toBeNull();
  });

  it("propagates a boardview pin click (net not in schematic + refDes) so the empty signal and detail both resolve", () => {
    const { facade, subscribeAsPanel, last } = buildSyncRig();
    subscribeAsPanel();

    // U2700.E5 is a boardview pin whose net (PP1V8_S2) has no schematic net
    // label; the refDes path still lowers the panel onto its first page.
    facade.select({ boardId: "BRD_820_02106", net: "PP1V8_S2", refDes: "U2700", pin: "E5" });

    const reaction = last.value!;
    // Net has no schematic net label -> empty signal.
    expect(reaction.notInSchematic).toBe(true);
    expect(reaction.overlay.notInSchematic).toBe(true);
    // The refDes still drives the detail panel.
    expect(reaction.detail).not.toBeNull();
    expect(reaction.detail!.refDes).toBe("U2700");
    expect(reaction.detail!.pageList).toEqual([12, 13]);
  });

  it("resolves a refDes-only selection into a component detail (pages + pins + nets)", () => {
    const { facade, subscribeAsPanel, last } = buildSyncRig();
    subscribeAsPanel();

    facade.select({ boardId: "BRD_820_02106", refDes: "U2700" });

    const reaction = last.value!;
    expect(reaction.detail).not.toBeNull();
    expect(reaction.detail!.refDes).toBe("U2700");
    expect(reaction.detail!.pageList).toEqual([12, 13]);
    expect(reaction.detail!.pageToShow).toBe(12);
    expect(reaction.detail!.pins).toHaveLength(8);
    expect(reaction.detail!.connectedNets).toContain("PP_VDD_MAIN");
    expect(reaction.detail!.connectedNets).toContain("PP1V8_S2");
  });
});
