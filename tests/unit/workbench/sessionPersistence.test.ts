import { describe, it, expect, beforeEach } from "vitest";
import {
  SessionStore,
  createInitialSessionState,
  type ISessionStoragePort,
  type SessionState,
} from "../../../src/application/workbench/SessionStore.js";
import { EvaluationOutcome } from "../../../src/domain/measurements/value-objects/EvaluationOutcome.js";
import { DiagnosticBoardState } from "../../../src/domain/measurements/value-objects/DiagnosticBoardState.js";

/* ── in-memory port fake (node-testable roundtrip) ── */

class FakeSessionPort implements ISessionStoragePort {
  private readonly data = new Map<string, string>();

  async read(key: string): Promise<string | null> {
    return this.data.get(key) ?? null;
  }

  async write(key: string, value: string): Promise<void> {
    this.data.set(key, value);
  }

  async delete(key: string): Promise<void> {
    this.data.delete(key);
  }
}

/* ── test helpers ── */

/** Builds a complete session state with all slices populated. */
function makeFullSession(overrides?: Partial<SessionState>): SessionState {
  return {
    version: 1,
    panels: [
      {
        id: "boardview",
        visible: true,
        position: { x: 0, y: 0 },
        size: { width: 50, height: 100 },
        order: 0,
      },
      {
        id: "schematics",
        visible: true,
        position: { x: 50, y: 0 },
        size: { width: 50, height: 100 },
        order: 1,
      },
    ],
    selection: {
      boardId: "BRD_820_02106",
      net: "PP_VDD_MAIN",
      refDes: "U2700",
      pin: "A12",
    },
    searchHistory: ["VDD_MAIN", "U2700", "short to ground"],
    pairing: {
      boardId: "BRD_820_02106",
      schematicId: "DOC_IPHONE13_820_02106",
      diagnostic: "OK",
    },
    measurements: [
      {
        padId: "INT_PAD_084",
        netName: "PP_VDD_MAIN",
        outcome: EvaluationOutcome.PASS,
        measuredVolts: 0.42,
        normalizedVolts: 0.42,
        recordedAt: "2026-01-01T00:00:00.000Z",
        boardState: DiagnosticBoardState.SPLIT_TOP,
        meterModel: "FLUKE_115_STANDARD",
      },
      {
        padId: "INT_PAD_085",
        netName: "PP_VDD_CORE",
        outcome: EvaluationOutcome.PASS,
        measuredVolts: 0.5,
        normalizedVolts: 0.5,
        recordedAt: "2026-01-01T00:00:01.000Z",
        boardState: DiagnosticBoardState.SPLIT_TOP,
        meterModel: "SUNSHINE_DT17N",
      },
    ],
    updatedAt: "2026-09-01T00:00:00.000Z",
    ...overrides,
  };
}

/* ════════════════════════════════════════════════════════════════════════
   Unit 6D — Full session restore pipeline + ASVS L2 schema validation
   Session specs: R1 (both), R2, R3 (both), R4 (both)
   ════════════════════════════════════════════════════════════════════════ */

describe("SessionStore — full session restore pipeline (6D)", () => {
  let port: FakeSessionPort;
  let store: SessionStore;

  beforeEach(() => {
    port = new FakeSessionPort();
    store = new SessionStore(port);
  });

  /* ── R1: full restore ── */

  it("restores all session slices: positions, selection, history, measurements, pairing", async () => {
    const full = makeFullSession();
    await port.write("boardforge.session.v1", JSON.stringify(full));

    const result = await store.restoreFullSession();

    expect(result.recovered).toBe(false);
    expect(result.session.panels).toEqual(full.panels);
    expect(result.session.selection).toEqual(full.selection);
    expect(result.session.searchHistory).toEqual(full.searchHistory);
    expect(result.session.pairing).toEqual(full.pairing);
    expect(result.measurements).toEqual(full.measurements);
  });

  it("roundtrips measurements through save → restoreFullSession preserving all fields", async () => {
    store.update(makeFullSession());
    await store.save();

    const freshStore = new SessionStore(port);
    const result = await freshStore.restoreFullSession();

    expect(result.measurements).toHaveLength(2);
    expect(result.measurements[0].padId).toBe("INT_PAD_084");
    expect(result.measurements[0].outcome).toBe("PASS");
    expect(result.measurements[0].boardState).toBe("SPLIT_TOP");
    expect(result.measurements[1].meterModel).toBe("SUNSHINE_DT17N");
  });

  /* ── R2: corrupt recovery + diagnostic ── */

  it("recovers a fresh session from corrupt JSON with diagnostic (R2)", async () => {
    await port.write("boardforge.session.v1", "{{{ corrupt");

    const result = await store.restoreFullSession();

    expect(result.recovered).toBe(true);
    expect(result.diagnostic).toBe("CORRUPT_STATE_RESET");
    expect(result.session).toEqual(createInitialSessionState());
    expect(result.measurements).toEqual([]);
  });

  it("recovers a fresh session from schema-invalid payload (R2)", async () => {
    await port.write(
      "boardforge.session.v1",
      JSON.stringify({ version: 99, panels: [] })
    );

    const result = await store.restoreFullSession();

    expect(result.recovered).toBe(true);
    expect(result.diagnostic).toBe("CORRUPT_STATE_RESET");
    expect(result.session).toEqual(createInitialSessionState());
  });

  /* ── R3: pairing / companion handling ── */

  it("preserves NO_COMPANION pairing through restore (R3)", async () => {
    const session = makeFullSession({
      pairing: { boardId: "BRD_UNKNOWN", diagnostic: "NO_COMPANION" },
    });
    await port.write("boardforge.session.v1", JSON.stringify(session));

    const result = await store.restoreFullSession();

    expect(result.recovered).toBe(false);
    expect(result.session.pairing).toEqual({
      boardId: "BRD_UNKNOWN",
      diagnostic: "NO_COMPANION",
    });
    expect(result.session.pairing?.schematicId).toBeUndefined();
  });

  /* ── R3: gone-net → cleared selection ── */

  it("clears selection.net when the net is gone (R3 gone-net)", async () => {
    const session = makeFullSession({
      selection: { boardId: "BRD_820_02106", net: "PP_REMOVED_NET" },
    });
    await port.write("boardforge.session.v1", JSON.stringify(session));

    const existingNets = new Set(["PP_VDD_MAIN", "PP_VDD_CORE"]);
    const result = await store.restoreFullSession({
      checkNet: async (_boardId, net) => existingNets.has(net),
    });

    expect(result.recovered).toBe(false);
    expect(result.session.selection).toBeDefined();
    expect(result.session.selection?.net).toBeUndefined();
    expect(result.session.selection?.boardId).toBe("BRD_820_02106");
  });

  it("keeps selection.net when the net still exists", async () => {
    const session = makeFullSession({
      selection: { boardId: "BRD_820_02106", net: "PP_VDD_MAIN" },
    });
    await port.write("boardforge.session.v1", JSON.stringify(session));

    const existingNets = new Set(["PP_VDD_MAIN", "PP_VDD_CORE"]);
    const result = await store.restoreFullSession({
      checkNet: async (_boardId, net) => existingNets.has(net),
    });

    expect(result.session.selection?.net).toBe("PP_VDD_MAIN");
  });

  /* ── ASVS L2: full-schema validation ── */

  it("reverts to fresh session when measurements have invalid shape (ASVS L2)", async () => {
    const session = makeFullSession({
      measurements: [
        {
          padId: "X",
          netName: null,
          outcome: "TOTALLY_INVALID_OUTCOME" as unknown as EvaluationOutcome,
          measuredVolts: 0.42,
          normalizedVolts: 0.42,
          recordedAt: "2026-01-01T00:00:00.000Z",
          boardState: DiagnosticBoardState.SPLIT_TOP,
          meterModel: "FLUKE",
        },
      ],
    });
    await port.write("boardforge.session.v1", JSON.stringify(session));

    const result = await store.restoreFullSession();

    expect(result.recovered).toBe(true);
    expect(result.diagnostic).toBe("CORRUPT_STATE_RESET");
    expect(result.session).toEqual(createInitialSessionState());
    expect(result.measurements).toEqual([]);
  });

  it("rejects extra top-level fields per ASVS L2 strict schema", async () => {
    const smuggled = { ...makeFullSession(), smuggledField: "injection" };
    await port.write("boardforge.session.v1", JSON.stringify(smuggled));

    const result = await store.restoreFullSession();

    expect(result.recovered).toBe(true);
    expect(result.diagnostic).toBe("CORRUPT_STATE_RESET");
  });

  /* ── R4: default when nothing persisted ── */

  it("returns default session when nothing is persisted", async () => {
    const result = await store.restoreFullSession();

    expect(result.recovered).toBe(false);
    expect(result.session).toEqual(createInitialSessionState());
    expect(result.measurements).toEqual([]);
  });
});
