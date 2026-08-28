import type { EvaluationOutcome } from "../../domain/measurements/value-objects/EvaluationOutcome.js";

/**
 * MeasurementLogStore — STUB (PR 1 Platform Foundation).
 *
 * Owned by WorkbenchFacade so the composition contract is stable from PR 1.
 * The full frontend implementation (diode-mode entry validation against
 * MeasurementReference, per-net history/trends, CSV/JSON export, IndexedDB
 * persistence) lands in PR 6 (measurements + session).
 */
export interface MeasurementLogEntry {
  padId: string;
  netName: string | null;
  outcome: EvaluationOutcome;
  normalizedVolts: number;
  recordedAt: string;
}

export class MeasurementLogStore {
  private readonly entries: MeasurementLogEntry[] = [];

  /** Stub: records an in-memory entry only; IndexedDB persistence lands in PR 6. */
  public async record(input: {
    padId: string;
    netName?: string | null;
    outcome: EvaluationOutcome;
    normalizedVolts: number;
  }): Promise<MeasurementLogEntry> {
    const entry: MeasurementLogEntry = {
      padId: input.padId,
      netName: input.netName ?? null,
      outcome: input.outcome,
      normalizedVolts: input.normalizedVolts,
      recordedAt: new Date().toISOString(),
    };
    this.entries.push(entry);
    return entry;
  }

  /** Stub: returns the in-memory history for a pad. */
  public historyFor(padId: string): MeasurementLogEntry[] {
    return this.entries.filter((entry) => entry.padId === padId);
  }
}