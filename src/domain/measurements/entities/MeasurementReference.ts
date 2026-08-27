import { DiagnosticBoardState } from "../value-objects/DiagnosticBoardState.js";
import { ToleranceWindow } from "../value-objects/ToleranceWindow.js";
import { EvaluationOutcome } from "../value-objects/EvaluationOutcome.js";
import { DiodeReading } from "../value-objects/DiodeReading.js";

export interface MeasurementReferenceProps {
  id: string;
  padId: string;
  boardState: DiagnosticBoardState;
  toleranceWindow?: ToleranceWindow;
  nominal?: number;
  min?: number;
  max?: number;
  tolerancePct?: number;
  netName?: string | null;
  meterBaseline?: string;
  notes?: string | null;
}

export class MeasurementReference {
  public readonly id: string;
  public readonly padId: string;
  public readonly boardState: DiagnosticBoardState;
  public readonly toleranceWindow: ToleranceWindow;
  public readonly netName: string | null;
  public readonly meterBaseline: string;
  public readonly notes: string | null;

  constructor(props: MeasurementReferenceProps) {
    if (!props.id || props.id.trim().length === 0) {
      throw new Error("id cannot be empty");
    }
    if (!props.padId || props.padId.trim().length === 0) {
      throw new Error("padId cannot be empty");
    }
    if (!props.boardState || !Object.values(DiagnosticBoardState).includes(props.boardState)) {
      throw new Error(`Invalid DiagnosticBoardState: ${props.boardState}`);
    }

    this.id = props.id.trim();
    this.padId = props.padId.trim();
    this.boardState = props.boardState;

    if (props.toleranceWindow) {
      this.toleranceWindow = props.toleranceWindow;
    } else {
      if (props.nominal === undefined) {
        throw new Error("Either toleranceWindow or nominal must be provided");
      }
      this.toleranceWindow = new ToleranceWindow({
        nominal: props.nominal,
        min: props.min,
        max: props.max,
        tolerancePct: props.tolerancePct,
      });
    }

    this.netName = props.netName ? props.netName.trim() : null;
    this.meterBaseline = props.meterBaseline ? props.meterBaseline.trim() : "FLUKE_115_STANDARD";
    this.notes = props.notes ? props.notes.trim() : null;
  }

  public get nominal(): number {
    return this.toleranceWindow.nominal;
  }

  public evaluate(measured: number | DiodeReading): EvaluationOutcome {
    return this.toleranceWindow.evaluate(measured);
  }

  public calculateDeviationPct(measured: number | DiodeReading): number {
    return this.toleranceWindow.calculateDeviationPct(measured);
  }
}
