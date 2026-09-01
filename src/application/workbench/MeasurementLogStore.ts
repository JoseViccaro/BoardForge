import { DiodeReading } from "../../domain/measurements/value-objects/DiodeReading.js";
import { DiodeModeEvaluator } from "../../domain/measurements/services/DiodeModeEvaluator.js";
import type { MultimeterProfile } from "../../domain/measurements/value-objects/MultimeterProfile.js";
import type { DiagnosticBoardState } from "../../domain/measurements/value-objects/DiagnosticBoardState.js";
import type { EvaluationOutcome } from "../../domain/measurements/value-objects/EvaluationOutcome.js";
import type { MeasurementProfile } from "../../domain/measurements/aggregates/MeasurementProfile.js";

/**
 * MeasurementLogStore — per-net/pin diode reading log (measurements R1/R2/R3).
 *
 * The frontend owner of the measurement history/trends (design D4): records a
 * reading bound to a selected net/pin, normalizes it by the meter profile,
 * validates it against the matching MeasurementReference via the domain
 * DiodeModeEvaluator, and computes trend direction across the log. DOM-free and
 * pure node-testable; the facade consumes it for capture and re-export.
 */
export interface MeasurementLogEntry {
  padId: string;
  netName: string | null;
  outcome: EvaluationOutcome;
  measuredVolts: number;
  normalizedVolts: number;
  recordedAt: string;
  boardState: DiagnosticBoardState;
  meterModel: string;
}

/** Deviation direction across a pin's readings over time (R3). */
export type TrendDirection = "UP" | "DOWN" | "STABLE" | "NONE";

export interface RecordMeasurementInput {
  /** Reference source used to resolve the pad's MeasurementReference (R2). */
  profile: MeasurementProfile;
  padId: string;
  boardState: DiagnosticBoardState;
  /** Raw value read off the meter, in volts. */
  measuredVolts: number;
  meterProfile: MultimeterProfile;
  netName?: string | null;
  /** Injectable timestamp for deterministic, chronological tests. */
  recordedAt?: string;
}

const TREND_EPSILON = 0.005;

export class MeasurementLogStore {
  private readonly entries: MeasurementLogEntry[] = [];
  private readonly evaluator = new DiodeModeEvaluator();

  /**
   * Records a captured reading: normalizes by the meter profile, validates it
   * against the pad's reference in the given board state, and appends the
   * classified entry to that pin's history.
   */
  public async record(input: RecordMeasurementInput): Promise<MeasurementLogEntry> {
    const {
      profile,
      padId,
      boardState,
      measuredVolts,
      meterProfile,
      netName,
      recordedAt,
    } = input;

    const reference = profile.getReference(padId, boardState);
    if (!reference) {
      throw new Error(`No MeasurementReference for pad '${padId}' in state '${boardState}'`);
    }

    const reading = new DiodeReading(measuredVolts, false, meterProfile);
    const result = this.evaluator.evaluate(reading, reference, meterProfile);

    const entry: MeasurementLogEntry = {
      padId,
      netName: netName ?? reference.netName ?? null,
      outcome: result.outcome,
      measuredVolts,
      normalizedVolts: result.normalizedVolts,
      recordedAt: recordedAt ?? new Date().toISOString(),
      boardState,
      meterModel: meterProfile.name,
    };
    this.entries.push(entry);
    return entry;
  }

  /** Returns this pad's readings in chronological order. */
  public historyFor(padId: string): MeasurementLogEntry[] {
    return this.entries
      .filter((entry) => entry.padId === padId)
      .slice()
      .sort((a, b) => a.recordedAt.localeCompare(b.recordedAt));
  }

  /** Trend direction (UP/DOWN/STABLE) between the first and last reading; NONE when fewer than two. */
  public trendFor(padId: string): TrendDirection {
    const history = this.historyFor(padId);
    if (history.length < 2) {
      return "NONE";
    }
    const delta = history[history.length - 1].normalizedVolts - history[0].normalizedVolts;
    if (Math.abs(delta) <= TREND_EPSILON) {
      return "STABLE";
    }
    return delta > 0 ? "UP" : "DOWN";
  }
}
