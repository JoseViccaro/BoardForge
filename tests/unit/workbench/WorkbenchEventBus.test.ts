import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  WorkbenchEventBus,
  type SelectionChangePayload,
  type PairingResolvedPayload,
} from "../../../src/application/workbench/WorkbenchEventBus.js";

describe("WorkbenchEventBus", () => {
  let bus: WorkbenchEventBus;

  beforeEach(() => {
    bus = new WorkbenchEventBus();
  });

  it("delivers a published payload to matching subscribers", () => {
    const handler = vi.fn();
    bus.subscribe("selection.change", handler);

    bus.publish("selection.change", { boardId: "BRD_1", net: "PP_VDD_MAIN" });

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith({ boardId: "BRD_1", net: "PP_VDD_MAIN" });
  });

  it("isolates topics: publishing one topic does not fire handlers of another", () => {
    const selectionHandler = vi.fn();
    const pairingHandler = vi.fn();
    bus.subscribe("selection.change", selectionHandler);
    bus.subscribe("pairing.resolved", pairingHandler);

    bus.publish("pairing.resolved", {
      boardId: "BRD_1",
      schematicId: "DOC_1",
      diagnostic: "OK",
    });

    expect(pairingHandler).toHaveBeenCalledTimes(1);
    expect(selectionHandler).not.toHaveBeenCalled();
  });

  it("notifies all subscribers registered on the same topic", () => {
    const first = vi.fn();
    const second = vi.fn();
    bus.subscribe("selection.change", first);
    bus.subscribe("selection.change", second);

    bus.publish("selection.change", { boardId: "BRD_1" });

    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
  });

  it("stops delivering after unsubscribe", () => {
    const handler = vi.fn();
    const unsubscribe = bus.subscribe("selection.change", handler);

    unsubscribe();
    bus.publish("selection.change", { boardId: "BRD_1" });

    expect(handler).not.toHaveBeenCalled();
  });

  it("is safe to publish with zero subscribers", () => {
    expect(() => bus.publish("page.navigate", { pageNumber: 12 })).not.toThrow();
  });

  it("clears all handlers after dispose and remains safe to publish", () => {
    const handler = vi.fn();
    bus.subscribe("selection.change", handler);

    bus.dispose();

    expect(() => bus.publish("selection.change", { boardId: "BRD_1" })).not.toThrow();
    expect(handler).not.toHaveBeenCalled();
  });

  it("delivers typed payloads per topic (compile-time contract)", () => {
    const seen: SelectionChangePayload[] = [];
    bus.subscribe("selection.change", (payload) => {
      // Type-level assertion: payload is SelectionChangePayload, not any other topic payload.
      const net: string | undefined = payload.net;
      seen.push({ ...payload, net });
    });

    bus.publish("selection.change", { boardId: "BRD_1", net: "PP_VDD_MAIN", pin: "A12" });

    expect(seen[0]).toEqual({ boardId: "BRD_1", net: "PP_VDD_MAIN", pin: "A12" });
  });

  it("supports the full topic contract with per-topic payloads", () => {
    const handler = vi.fn();
    bus.subscribe("pairing.resolved", handler);
    const payload: PairingResolvedPayload = {
      boardId: "BRD_1",
      schematicId: "DOC_IPHONE13_820_02106",
      diagnostic: "OK",
    };

    bus.publish("pairing.resolved", payload);

    expect(handler).toHaveBeenCalledWith(payload);
  });
});