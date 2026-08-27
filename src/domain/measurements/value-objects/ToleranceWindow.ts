import { EvaluationOutcome } from "./EvaluationOutcome.js";
import { DiodeReading } from "./DiodeReading.js";

function roundPrecision(val: number, decimals: number = 4): number {
  const factor = Math.pow(10, decimals);
  return Math.round(val * factor) / factor;
}

export interface ToleranceWindowProps {
  nominal: number;
  min?: number;
  max?: number;
  tolerancePct?: number;
}

export class ToleranceWindow {
  public readonly nominal: number;
  public readonly min: number;
  public readonly max: number;
  public readonly tolerancePct: number;

  constructor(props: ToleranceWindowProps) {
    if (props.nominal < 0) {
      throw new Error("nominal cannot be negative");
    }
    this.nominal = roundPrecision(props.nominal, 4);

    const defaultTolerancePct = props.tolerancePct ?? 7.0;
    this.tolerancePct = roundPrecision(defaultTolerancePct, 2);

    if (props.min !== undefined && props.max !== undefined) {
      if (props.min > props.nominal) {
        throw new Error("min cannot exceed nominal");
      }
      if (props.nominal > props.max) {
        throw new Error("nominal cannot exceed max");
      }
      this.min = roundPrecision(props.min, 4);
      this.max = roundPrecision(props.max, 4);
      if (props.tolerancePct === undefined && this.nominal > 0) {
        this.tolerancePct = roundPrecision(((this.max - this.nominal) / this.nominal) * 100, 2);
      }
    } else {
      this.min = roundPrecision(this.nominal * (1 - this.tolerancePct / 100), 4);
      this.max = roundPrecision(this.nominal * (1 + this.tolerancePct / 100), 4);
    }
  }

  public calculateDeviationPct(measured: number | DiodeReading): number {
    const val = measured instanceof DiodeReading ? measured.normalizedVolts() : measured;
    if (this.nominal === 0) {
      return val === 0 ? 0 : 100;
    }
    return roundPrecision(((val - this.nominal) / this.nominal) * 100, 4);
  }

  public evaluate(measured: number | DiodeReading): EvaluationOutcome {
    const isOpenLoop = measured instanceof DiodeReading ? measured.isOpenLoop : false;
    const val = measured instanceof DiodeReading ? measured.normalizedVolts() : measured;

    // Open loop check
    if (isOpenLoop || val >= 2.500) {
      if (this.nominal < 2.500) {
        return EvaluationOutcome.OPEN_LINE_OL;
      }
      return EvaluationOutcome.PASS;
    }

    // Short circuit or severe low drop
    if (val <= 0.050 && this.nominal > 0.100) {
      return EvaluationOutcome.CRITICAL_LOW_OR_SHORT;
    }
    if (this.nominal > 0 && (this.nominal - val) / this.nominal >= 0.50) {
      return EvaluationOutcome.CRITICAL_LOW_OR_SHORT;
    }

    // Direct pass within window
    if (val >= this.min && val <= this.max) {
      return EvaluationOutcome.PASS;
    }

    // Warning window (1.0x to 1.5x of tolerance percentage)
    const warningFactor = 1.5;
    const warningTolerance = (this.tolerancePct / 100) * warningFactor;
    const warningMin = roundPrecision(this.nominal * (1 - warningTolerance), 4);
    const warningMax = roundPrecision(this.nominal * (1 + warningTolerance), 4);

    if (val >= warningMin && val <= warningMax) {
      return EvaluationOutcome.WARNING_DEVIATION;
    }

    if (val > warningMax) {
      return EvaluationOutcome.UNEXPECTED_HIGH;
    }

    return EvaluationOutcome.CRITICAL_LOW_OR_SHORT;
  }
}
