import { DiodeReading } from "../value-objects/DiodeReading.js";
import { MultimeterProfile } from "../value-objects/MultimeterProfile.js";
import { EvaluationOutcome } from "../value-objects/EvaluationOutcome.js";
import { MeasurementReference } from "../entities/MeasurementReference.js";

function roundPrecision(val: number, decimals: number = 4): number {
  const factor = Math.pow(10, decimals);
  return Math.round(val * factor) / factor;
}

export interface DiodeEvaluationResult {
  outcome: EvaluationOutcome;
  isPass: boolean;
  measuredVolts: number;
  normalizedVolts: number;
  nominalVolts: number;
  deviationPct: number;
  message: string;
  padId: string;
  netName: string | null;
}

export class DiodeModeEvaluator {
  /**
   * Evaluates a measured diode reading against a golden reference.
   *
   * Normalization: Vf_norm = Vf * scale + offset
   * Classifications: PASS, WARNING_DEVIATION, CRITICAL_LOW_OR_SHORT, OPEN_LINE_OL, UNEXPECTED_HIGH
   */
  public evaluate(
    reading: DiodeReading | number,
    reference: MeasurementReference,
    meterProfile?: MultimeterProfile
  ): DiodeEvaluationResult {
    let diodeReading: DiodeReading;

    if (reading instanceof DiodeReading) {
      diodeReading = reading;
    } else {
      const isOpenLoop = reading >= 2.500;
      diodeReading = new DiodeReading(reading, isOpenLoop, meterProfile);
    }

    const measuredVolts = diodeReading.forwardVoltageVolts;
    const normalizedVolts = roundPrecision(diodeReading.normalizedVolts(), 4);
    const nominalVolts = reference.nominal;

    const outcome = reference.evaluate(diodeReading);
    const deviationPct = reference.calculateDeviationPct(diodeReading);
    const isPass = outcome === EvaluationOutcome.PASS;

    const label = reference.netName ?? reference.padId;
    let message: string;

    switch (outcome) {
      case EvaluationOutcome.CRITICAL_LOW_OR_SHORT:
        message = `Possible short circuit to ground on ${label} (Measured: ${normalizedVolts}V, Nominal: ${nominalVolts}V)`;
        break;
      case EvaluationOutcome.OPEN_LINE_OL:
        message = `Possible unseated pull-up resistor or open interposer trace on ${label} (Measured: ${diodeReading.isOpenLoop ? "OL" : normalizedVolts + "V"}, Nominal: ${nominalVolts}V)`;
        break;
      case EvaluationOutcome.WARNING_DEVIATION:
        message = `WARNING: Reading on ${label} deviates by ${deviationPct}% from nominal ${nominalVolts}V`;
        break;
      case EvaluationOutcome.UNEXPECTED_HIGH:
        message = `WARNING: Reading on ${label} is unexpectedly high (${normalizedVolts}V vs Nominal ${nominalVolts}V)`;
        break;
      case EvaluationOutcome.PASS:
      default:
        message = `PASS: Reading on ${label} is within nominal tolerance (Deviation: ${deviationPct}%)`;
        break;
    }

    return {
      outcome,
      isPass,
      measuredVolts,
      normalizedVolts,
      nominalVolts,
      deviationPct,
      message,
      padId: reference.padId,
      netName: reference.netName,
    };
  }
}
