import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  SessionStore,
  createInitialSessionState,
  parseSessionState,
  type ISessionStoragePort,
  type SessionState,
} from "../../../src/application/workbench/SessionStore.js";

class InMemorySessionStoragePort implements ISessionStoragePort {
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

describe("parseSessionState", () => {
  it("parses a valid serialized session", () => {
    const parsed = parseSessionState(JSON.stringify(createInitialSessionState()));
    expect(parsed).not.toBeNull();
    expect(parsed?.version).toBe(1);
  });

  it("returns null on invalid JSON (corrupt storage)", () => {
    expect(parseSessionState("{not-json")).toBeNull();
    expect(parseSessionState("garbage")).toBeNull();
  });

  it("rejects schema-invalid payloads per ASVS L2 schema validation", () => {
    expect(parseSessionState(JSON.stringify({ version: 99 }))).toBeNull();
    expect(
      parseSessionState(JSON.stringify({ version: 1, panels: "nope", searchHistory: [] }))
    ).toBeNull();
  });

  it("rejects payloads carrying unexpected fields", () => {
    const smuggled = { ...createInitialSessionState(), smuggledField: "injection" };
    expect(parseSessionState(JSON.stringify(smuggled))).toBeNull();
  });
});

describe("SessionStore", () => {
  let port: InMemorySessionStoragePort;
  let store: SessionStore;

  beforeEach(() => {
    port = new InMemorySessionStoragePort();
    store = new SessionStore(port);
  });

  it("starts with a fresh default session", () => {
    const snapshot = store.getSnapshot();
    expect(snapshot.version).toBe(1);
    expect(snapshot.panels.map((p) => p.id)).toEqual([
      "boardview",
      "schematics",
      "navigator",
      "measurements",
    ]);
  });

  it("persists panel geometry, selection, and search history across reload", async () => {
    const mutated: SessionState = {
      ...store.getSnapshot(),
      panels: [
        {
          id: "schematics",
          visible: true,
          position: { x: 30, y: 0 },
          size: { width: 70, height: 100 },
          order: 1,
        },
      ],
      selection: { boardId: "BRD_820_02106", net: "PP_VDD_MAIN" },
      searchHistory: ["U2700", "VDD_MAIN"],
      updatedAt: "2026-08-28T00:00:00.000Z",
    };
    store.update(mutated);
    await store.save();

    const reloaded = new SessionStore(port);
    const result = await reloaded.load();

    expect(result.recovered).toBe(false);
    expect(result.state.panels).toEqual(mutated.panels);
    expect(result.state.selection).toEqual({ boardId: "BRD_820_02106", net: "PP_VDD_MAIN" });
    expect(result.state.searchHistory).toEqual(["U2700", "VDD_MAIN"]);
  });

  it("recovers a fresh session from corrupt JSON without crashing", async () => {
    await port.write("boardforge.session.v1", "{{{ not-json");

    const result = await store.load();

    expect(result.recovered).toBe(true);
    expect(result.state).toEqual(createInitialSessionState());
  });

  it("recovers a fresh session when schema validation fails", async () => {
    await port.write("boardforge.session.v1", JSON.stringify({ version: 999, panels: [] }));

    const result = await store.load();

    expect(result.recovered).toBe(true);
    expect(result.state).toEqual(createInitialSessionState());
  });

  it("records a recoverable diagnostic on corrupt state", async () => {
    await port.write("boardforge.session.v1", "corrupt");

    const result = await store.load();

    expect(result.recovered).toBe(true);
    expect(result.diagnostic).toBe("CORRUPT_STATE_RESET");
  });

  it("returns the current state when nothing is persisted", async () => {
    const result = await store.load();
    expect(result.recovered).toBe(false);
    expect(result.state).toEqual(createInitialSessionState());
  });

  it("notifies subscribers on update and when load changes the state", async () => {
    const listener = vi.fn();
    store.subscribe(listener);

    store.update({ ...store.getSnapshot(), searchHistory: ["VDD"] });
    expect(listener).toHaveBeenCalledTimes(1);

    // Loading with nothing persisted is a no-op: a store must not notify then.
    await store.load();
    expect(listener).toHaveBeenCalledTimes(1);

    await port.write(
      "boardforge.session.v1",
      JSON.stringify({ ...store.getSnapshot(), searchHistory: ["PERSISTED"] })
    );
    await store.load();
    expect(listener).toHaveBeenCalledTimes(2);
    expect(store.getSnapshot().searchHistory).toEqual(["PERSISTED"]);
  });

  it("isolates sessions by storage key", async () => {
    const alpha = new SessionStore(port, "boardforge.session.alpha");
    const beta = new SessionStore(port, "boardforge.session.beta");

    alpha.update({ ...alpha.getSnapshot(), searchHistory: ["ALPHA"] });
    await alpha.save();

    const betaResult = await beta.load();
    expect(betaResult.state.searchHistory).toEqual([]);

    const alphaResult = await alpha.load();
    expect(alphaResult.state.searchHistory).toEqual(["ALPHA"]);
  });
});