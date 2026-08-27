import { EvaluationOutcome } from "../../../domain/measurements/value-objects/EvaluationOutcome.js";

export interface DiodeEvaluationResultDto {
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
