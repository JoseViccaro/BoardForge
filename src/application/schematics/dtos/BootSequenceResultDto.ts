import { PowerSequenceState } from "../../../domain/schematics/value-objects/PowerSequenceState.js";

export interface BootStepDto {
  fromState: PowerSequenceState;
  toState: PowerSequenceState;
  activeRails: string[];
}

export interface BootSequenceResultDto {
  success: boolean;
  finalState: PowerSequenceState;
  steps: BootStepDto[];
  activeRails: string[];
}
