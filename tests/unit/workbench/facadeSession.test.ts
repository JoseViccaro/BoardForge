import { describe, it, expect, vi } from "vitest";
import { WorkbenchFacade } from "../../../src/application/workbench/WorkbenchFacade.js";
import { WorkbenchEventBus } from "../../../src/application/workbench/WorkbenchEventBus.js";
import {
  SessionStore,
  type ISessionStoragePort,
  type SessionState,
} from "../../../src/application/workbench/SessionStore.js";
import { MeasurementLogStore } from "../../../src/application/workbench/MeasurementLogStore.js";
import { DiagnosticBoardState } from "../../../src/domain/measurements/value-objects/DiagnosticBoardState.js";
import { EntityNotFoundError } from "../../../src/interfaces/http/errors/HttpErrors.js";

/* in-memory storage port fake (node-testable roundtrip, mirrors WorkbenchFacade.test.ts) */
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

/** Builds a facade + harness sharing an in-memory session port. */
function createHarness(port = new MemoryPort()) {
  const bus = new WorkbenchEventBus();
  const sessionStore = new SessionStore(port);
  const measurementLogStore = new MeasurementLogStore();
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
    recordMeasurement: vi.fn(),
  };

  const facade = new WorkbenchFacade({
    boardViewFacade,
    schematicsFacade,
    measurementsFacade,
    bus,
    sessionStore,
    measurementLogStore,
    defaultBoardModel: "iPhone13",
  });

  return { facade, bus, sessionStore, port, measurementLogStore, boardViewFacade };
}

/** Writes a full session (all slices populated) directly into the storage port. */
function seedFullSession(port: ISessionStoragePort, session: SessionState): void {
  void port.write("boardforge.session.v1", JSON.stringify(session));
}

/** A complete session state exercising positions, selection, history, measurements and pairing. */
function makeFullSession(overrides: Partial<SessionState> = {}): SessionState {
  const base: SessionState = {
    version: 1,
    panels: [
      { id: "boardview", visible: true, position: { x: 10, y: 20 }, size: { width: 50, height: 100 }, order: 0 },
      { id: "schematics", visible: true, order: 1 },
    ],
    selection: { boardId: "BRD_820_02106", net: "PP_VDD_MAIN", pin: "A12" },
    searchHistory: ["PP_VDD_MAIN", "U2700"],
    pairing: { boardId: "BRD_820_02106", schematicId: "DOC_IPHONE13_820_02106", diagnostic: "OK" },
    measurements: [
      {
        padId: "INT_PAD_084",
        netName: "PP_VDD_MAIN",
        outcome: "PASS",
        measuredVolts: 0.42,
        normalizedVolts: 0.425,
        recordedAt: "2026-01-01T00:00:00.000Z",
        boardState: DiagnosticBoardState.SPLIT_TOP,
        meterModel: "FLUKE_115",
      },
    ],
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
  return { ...base, ...overrides };
}

describe("WorkbenchFacade session wiring (unit 6E)", () => {
  it("saveSession persists the current facade/app state to the storage port", async () => {
    const { facade, port } = createHarness();
    await facade.openBoard("BRD_820_02106", { boardModel: "iPhone13", boardRevision: "820-02106" });
    facade.select({ boardId: "BRD_820_02106", net: "PP_VDD_MAIN", pin: "A12" });

    await facade.saveSession();

    const raw = await port.read("boardforge.session.v1");
    expect(raw).not.toBeNull();
    const persisted = JSON.parse(raw as string);
    expect(persisted.pairing?.boardId).toBe("BRD_820_02106");
    expect(persisted.selection?.net).toBe("PP_VDD_MAIN");
  });

  it("loadSession restores positions, selection, history, measurements and pairing (6D integration)", async () => {
    const { facade, port } = createHarness();
    seedFullSession(port, makeFullSession());

    const result = await facade.loadSession();

    expect(result.recovered).toBe(false);
    const state = facade.sessionStore.getSnapshot();
    // positions
    expect(state.panels[0].position).toEqual({ x: 10, y: 20 });
    // selection
    expect(state.selection?.net).toBe("PP_VDD_MAIN");
    // history
    expect(state.searchHistory).toEqual(["PP_VDD_MAIN", "U2700"]);
    // pairing
    expect(state.pairing?.diagnostic).toBe("OK");
    // measurements slice returned by the restore pipeline
    expect(result.measurements).toHaveLength(1);
  });

  it("re-resolves the companion on restore and preserves NO_COMPANION where unresolvable", async () => {
    const { facade, bus, port } = createHarness();
    seedFullSession(port, makeFullSession({ pairing: { boardId: "BRD_UNKNOWN", diagnostic: "NO_COMPANION" } }));
    const pairingEvents = vi.fn();
    bus.subscribe("pairing.resolved", pairingEvents);

    await facade.loadSession();

    const state = facade.sessionStore.getSnapshot();
    expect(state.pairing?.diagnostic).toBe("NO_COMPANION");
    expect(pairingEvents).toHaveBeenCalledWith(
      expect.objectContaining({ diagnostic: "NO_COMPANION", boardId: "BRD_UNKNOWN" })
    );
  });

  it("re-resolves a resolvable companion to OK on restore", async () => {
    const { facade, bus, port } = createHarness();
    seedFullSession(port, makeFullSession({ pairing: { boardId: "BRD_820_02106", diagnostic: "NO_COMPANION" } }));
    const pairingEvents = vi.fn();
    bus.subscribe("pairing.resolved", pairingEvents);

    await facade.loadSession();

    const state = facade.sessionStore.getSnapshot();
    expect(state.pairing?.diagnostic).toBe("OK");
    expect(state.pairing?.schematicId).toBe("DOC_IPHONE13_820_02106");
    expect(pairingEvents).toHaveBeenCalledWith(
      expect.objectContaining({ diagnostic: "OK", schematicId: "DOC_IPHONE13_820_02106" })
    );
  });

  it("restores the selection onto the currently open panel via the bus", async () => {
    const { facade, bus, port } = createHarness();
    seedFullSession(port, makeFullSession());
    const selectionEvents = vi.fn();
    bus.subscribe("selection.change", selectionEvents);

    await facade.loadSession();

    expect(selectionEvents).toHaveBeenCalledWith(
      expect.objectContaining({ boardId: "BRD_820_02106", net: "PP_VDD_MAIN", pin: "A12" })
    );
  });

  it("loadSession hydrates the MeasurementLogStore from the restored measurements slice", async () => {
    const { facade, port, measurementLogStore } = createHarness();
    seedFullSession(port, makeFullSession());

    await facade.loadSession();

    const history = measurementLogStore.historyFor("INT_PAD_084");
    expect(history).toHaveLength(1);
    expect(history[0].outcome).toBe("PASS");
    expect(history[0].normalizedVolts).toBe(0.425);
  });
});
