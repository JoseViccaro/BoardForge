import { describe, it, expect, vi } from "vitest";
import { WorkbenchFacade } from "../../../src/application/workbench/WorkbenchFacade.js";
import { WorkbenchEventBus } from "../../../src/application/workbench/WorkbenchEventBus.js";
import {
  SessionStore,
  type ISessionStoragePort,
} from "../../../src/application/workbench/SessionStore.js";
import {
  WorkbenchSearchService,
  type SearchHit,
} from "../../../src/application/workbench/WorkbenchSearchService.js";
import { DiagnosticBoardState } from "../../../src/domain/measurements/value-objects/DiagnosticBoardState.js";
import { EntityNotFoundError } from "../../../src/interfaces/http/errors/HttpErrors.js";

class MemoryPort implements ISessionStoragePort {
  private readonly data = new Map<string, string>();

  public async read(key: string): Promise<string | null> {
    return this.data.get(key) ?? null;
  }

  public async write(key: string, value: string): Promise<void> {
    this.data.set(key, value);
  }

  public async delete(key: string): Promise<void> {
    this.data.delete(key);
  }
}

function createHarness() {
  const bus = new WorkbenchEventBus();
  const sessionStore = new SessionStore(new MemoryPort());
  const boardViewFacade = {
    uploadBoardView: vi.fn(),
    getBoardView: vi.fn(async (boardId: string) => {
      if (boardId !== "BRD_820_02106") {
        throw new EntityNotFoundError(`Board '${boardId}' not found.`);
      }
      return {
        boardId,
        boardNumber: "820-02106",
        stackType: "SANDWICH_INTERPOSER",
        subBoards: [],
      };
    }),
    getNets: vi.fn(async () => ({ nets: ["PP_VDD_MAIN"] })),
    getNetDetails: vi.fn(async () => ({
      id: "NET_PP_VDD_MAIN",
      canonicalNetName: "PP_VDD_MAIN",
      classification: "POWER_MAIN",
    })),
  };
  const schematicsFacade = {
    saveDocument: vi.fn(),
    uploadSchematic: vi.fn(async () => ({ schematicId: "DOC_IPHONE13_820_02106", filename: "x.pdf", pageCount: 1 })),
    searchSymbols: vi.fn(async () => ({ matches: [] })),
    getPage: vi.fn(async () => ({ pageNumber: 12, tokens: [] })),
  };
  const measurementsFacade = {
    getReferences: vi.fn(async () => ({ references: [] })),
    createReference: vi.fn(),
    recordMeasurement: vi.fn(async () => ({
      outcome: "PASS",
      isPass: true,
      measuredVolts: 0.42,
      normalizedVolts: 0.425,
      nominalVolts: 0.425,
      deviationPct: 0.7,
      message: "ok",
      padId: "INT_PAD_084",
      netName: "PP_VDD_MAIN",
    })),
  };

  const facade = new WorkbenchFacade({
    boardViewFacade,
    schematicsFacade,
    measurementsFacade,
    bus,
    sessionStore,
    defaultBoardModel: "iPhone13",
  });

  return { facade, bus, sessionStore, boardViewFacade, measurementsFacade, schematicsFacade };
}

const recordDto = {
  board_id: "BRD_820_02106",
  pad_id: "INT_PAD_084",
  board_state: DiagnosticBoardState.SPLIT_TOP,
  reading_mv: 425,
};

describe("WorkbenchFacade", () => {
  it("delegates openBoard to BoardViewFacade and resolves the companion", async () => {
    const { facade, boardViewFacade, bus } = createHarness();
    const pairingEvents = vi.fn();
    bus.subscribe("pairing.resolved", pairingEvents);

    const state = await facade.openBoard("BRD_820_02106", { boardModel: "iPhone13" });

    expect(boardViewFacade.getBoardView).toHaveBeenCalledWith("BRD_820_02106");
    expect(state.pairing?.diagnostic).toBe("OK");
    expect(state.pairing?.schematicId).toBe("DOC_IPHONE13_820_02106");
    expect(pairingEvents).toHaveBeenCalledWith({
      boardId: "BRD_820_02106",
      schematicId: "DOC_IPHONE13_820_02106",
      diagnostic: "OK",
    });
  });

  it("persists the resolved pairing into the session state", async () => {
    const { facade } = createHarness();

    await facade.openBoard("BRD_820_02106", { boardModel: "iPhone13" });

    expect(facade.sessionStore.getSnapshot().pairing?.diagnostic).toBe("OK");
  });

  it("emits NO_COMPANION when the board has no paired schematic", async () => {
    const { facade, bus } = createHarness();
    const pairingEvents = vi.fn();
    bus.subscribe("pairing.resolved", pairingEvents);

    await facade.openBoard("BRD_820_02106", { boardModel: "iPhone11", boardRevision: "820-01600" });

    expect(pairingEvents).toHaveBeenCalledWith({
      boardId: "BRD_820_02106",
      diagnostic: "NO_COMPANION",
    });
  });

  it("propagates unknown-board errors from BoardViewFacade", async () => {
    const { facade } = createHarness();

    await expect(facade.openBoard("BRD_NOPE")).rejects.toThrow(EntityNotFoundError);
  });

  it("emits selection.change on the bus when select is called", () => {
    const { facade, bus } = createHarness();
    const handler = vi.fn();
    bus.subscribe("selection.change", handler);

    facade.select({ boardId: "BRD_820_02106", net: "PP_VDD_MAIN", pin: "A12" });

    expect(handler).toHaveBeenCalledWith({ boardId: "BRD_820_02106", net: "PP_VDD_MAIN", pin: "A12" });
  });

  it("delegates search to the WorkbenchSearchService", () => {
    const { bus, sessionStore, boardViewFacade, schematicsFacade, measurementsFacade } = createHarness();
    const hit: SearchHit = { id: "HIT_1", field: "net", label: "PP_VDD_MAIN", boardId: "BRD_820_02106" };
    const searchService = new WorkbenchSearchService();
    const spy = vi.spyOn(searchService, "search").mockReturnValue([hit]);
    const facade = new WorkbenchFacade({
      boardViewFacade,
      schematicsFacade,
      measurementsFacade,
      bus,
      sessionStore,
      searchService,
      defaultBoardModel: "iPhone13",
    });

    const results = facade.search("VDD");

    expect(spy).toHaveBeenCalledWith("VDD");
    expect(results).toEqual([hit]);
  });

  it("publishes search.focus on hits but not on empty results", () => {
    const { bus, sessionStore, boardViewFacade, schematicsFacade, measurementsFacade } = createHarness();
    const hit: SearchHit = { id: "HIT_1", field: "net", label: "PP_VDD_MAIN", boardId: "BRD_820_02106" };
    const searchService = new WorkbenchSearchService();
    const searchSpy = vi.spyOn(searchService, "search").mockReturnValue([hit]);
    const facade = new WorkbenchFacade({
      boardViewFacade,
      schematicsFacade,
      measurementsFacade,
      bus,
      sessionStore,
      searchService,
      defaultBoardModel: "iPhone13",
    });
    const focusEvents = vi.fn();
    bus.subscribe("search.focus", focusEvents);

    facade.search("VDD");
    expect(focusEvents).toHaveBeenCalledWith({ query: "VDD", hit });

    searchSpy.mockReturnValue([]);
    facade.search("ZZZ_NOMATCH");
    expect(focusEvents).toHaveBeenCalledTimes(1);
  });

  it("delegates recordMeasurement to MeasurementsFacade and publishes measurement.recorded", async () => {
    const { facade, measurementsFacade, bus } = createHarness();
    const events = vi.fn();
    bus.subscribe("measurement.recorded", events);

    const result = await facade.recordMeasurement(recordDto);

    expect(measurementsFacade.recordMeasurement).toHaveBeenCalledWith(recordDto);
    expect(result.outcome).toBe("PASS");
    expect(events).toHaveBeenCalledWith({
      padId: "INT_PAD_084",
      netName: "PP_VDD_MAIN",
      outcome: "PASS",
      normalizedVolts: 0.425,
    });
  });

  it("saves and reloads the session through SessionStore", async () => {
    const { facade } = createHarness();

    await facade.openBoard("BRD_820_02106", { boardModel: "iPhone13" });
    await facade.saveSession();
    const result = await facade.loadSession();

    expect(result.recovered).toBe(false);
    expect(facade.sessionStore.getSnapshot().pairing?.boardId).toBe("BRD_820_02106");
  });
});