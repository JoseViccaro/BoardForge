import type { EvaluationOutcome } from "../../domain/measurements/value-objects/EvaluationOutcome.js";
import type { SearchHit } from "./WorkbenchSearchService.js";

/**
 * Typed in-process workbench event bus (D2).
 *
 * Panels and the facade communicate exclusively through these topics; the
 * payload of each topic is fixed by `WorkbenchEventMap` so cross-panel
 * contracts are compile-time safe. Zero dependencies.
 */

export type PairingDiagnostic = "OK" | "NO_COMPANION";

export interface SelectionChangePayload {
  boardId: string;
  net?: string;
  refDes?: string;
  pin?: string;
}

export interface PairingResolvedPayload {
  boardId: string;
  schematicId?: string;
  diagnostic: PairingDiagnostic;
}

export interface MeasurementRecordedPayload {
  padId: string;
  netName: string | null;
  outcome: EvaluationOutcome;
  normalizedVolts: number;
}

export interface SearchFocusPayload {
  query: string;
  hit?: SearchHit;
}

export interface PageNavigatePayload {
  pageNumber: number;
}

/** Topic name -> payload type mapping (the single source of truth). */
export interface WorkbenchEventMap {
  "selection.change": SelectionChangePayload;
  "pairing.resolved": PairingResolvedPayload;
  "measurement.recorded": MeasurementRecordedPayload;
  "search.focus": SearchFocusPayload;
  "page.navigate": PageNavigatePayload;
}

export type WorkbenchTopic = keyof WorkbenchEventMap;

export type WorkbenchEventHandler<Topic extends WorkbenchTopic> = (
  payload: WorkbenchEventMap[Topic]
) => void;

export class WorkbenchEventBus {
  private readonly subscriptions = new Map<WorkbenchTopic, Set<(payload: unknown) => void>>();

  /** Registers a handler for a topic; returns an unsubscribe function. */
  public subscribe<Topic extends WorkbenchTopic>(
    topic: Topic,
    handler: WorkbenchEventHandler<Topic>
  ): () => void {
    let handlers = this.subscriptions.get(topic);
    if (!handlers) {
      handlers = new Set();
      this.subscriptions.set(topic, handlers);
    }
    handlers.add(handler as (payload: unknown) => void);
    return () => {
      handlers!.delete(handler as (payload: unknown) => void);
    };
  }

  /** Publishes a payload to every handler registered on the topic (no-op if none). */
  public publish<Topic extends WorkbenchTopic>(
    topic: Topic,
    payload: WorkbenchEventMap[Topic]
  ): void {
    const handlers = this.subscriptions.get(topic);
    if (!handlers) return;
    for (const handler of handlers) {
      handler(payload);
    }
  }

  /** Removes all subscriptions. The bus remains usable (publish becomes a no-op). */
  public dispose(): void {
    this.subscriptions.clear();
  }
}