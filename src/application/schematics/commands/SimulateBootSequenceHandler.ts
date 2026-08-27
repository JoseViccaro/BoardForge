import { PowerTree } from "../../../domain/schematics/entities/PowerTree.js";
import { PowerSequenceState } from "../../../domain/schematics/value-objects/PowerSequenceState.js";
import { BootSequenceStateMachine } from "../../../domain/schematics/services/BootSequenceStateMachine.js";
import { BootSequenceResultDto, BootStepDto } from "../dtos/BootSequenceResultDto.js";

export interface SimulateBootSequenceCommand {
  powerTree: PowerTree;
  initialState?: PowerSequenceState;
  targetState: PowerSequenceState;
}

export class SimulateBootSequenceHandler {
  public async execute(command: SimulateBootSequenceCommand): Promise<BootSequenceResultDto> {
    const initialState = command.initialState ?? PowerSequenceState.S5_OFF;
    const stateMachine = new BootSequenceStateMachine(command.powerTree, initialState);

    const sequenceOrder: PowerSequenceState[] = [
      PowerSequenceState.S5_OFF,
      PowerSequenceState.S4_STANDBY,
      PowerSequenceState.S3_TRIGGER,
      PowerSequenceState.S0_FULL_EXECUTION,
    ];

    const steps: BootStepDto[] = [];
    const currentIdx = sequenceOrder.indexOf(initialState);
    const targetIdx = sequenceOrder.indexOf(command.targetState);

    if (currentIdx !== -1 && targetIdx !== -1 && targetIdx >= currentIdx) {
      for (let i = currentIdx; i < targetIdx; i++) {
        const from = sequenceOrder[i];
        const to = sequenceOrder[i + 1];
        stateMachine.transitionTo(to);
        steps.push({
          fromState: from,
          toState: to,
          activeRails: command.powerTree
            .getAllRails()
            .filter((r) => r.isPowered)
            .map((r) => r.railName),
        });
      }
    } else {
      // Direct transition
      stateMachine.transitionTo(command.targetState);
      steps.push({
        fromState: initialState,
        toState: command.targetState,
        activeRails: command.powerTree
          .getAllRails()
          .filter((r) => r.isPowered)
          .map((r) => r.railName),
      });
    }

    const activeRails = command.powerTree
      .getAllRails()
      .filter((r) => r.isPowered)
      .map((r) => r.railName);

    return {
      success: true,
      finalState: stateMachine.currentState,
      steps,
      activeRails,
    };
  }
}
