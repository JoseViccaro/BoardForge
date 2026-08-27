import { PowerSequenceState } from "../value-objects/PowerSequenceState.js";
import { PowerRailType } from "../value-objects/PowerRailType.js";
import { PowerTree } from "../entities/PowerTree.js";
import { IllegalStateTransitionException } from "../exceptions/IllegalStateTransitionException.js";

export class BootSequenceStateMachine {
  private _currentState: PowerSequenceState;
  public readonly powerTree: PowerTree;

  // Allowed transitions map
  private static readonly VALID_TRANSITIONS: Record<PowerSequenceState, ReadonlyArray<PowerSequenceState>> = {
    [PowerSequenceState.S5_OFF]: [
      PowerSequenceState.S4_STANDBY,
    ],
    [PowerSequenceState.S4_STANDBY]: [
      PowerSequenceState.S3_TRIGGER,
      PowerSequenceState.S5_OFF,
    ],
    [PowerSequenceState.S3_TRIGGER]: [
      PowerSequenceState.S0_FULL_EXECUTION,
      PowerSequenceState.S5_OFF,
    ],
    [PowerSequenceState.S0_FULL_EXECUTION]: [
      PowerSequenceState.S2_SLEEP,
      PowerSequenceState.S5_OFF,
    ],
    [PowerSequenceState.S2_SLEEP]: [
      PowerSequenceState.S0_FULL_EXECUTION,
      PowerSequenceState.S5_OFF,
    ],
  };

  constructor(powerTree: PowerTree, initialState: PowerSequenceState = PowerSequenceState.S5_OFF) {
    this.powerTree = powerTree;
    this._currentState = initialState;
    this.applyRailStatesForCurrentState();
  }

  public get currentState(): PowerSequenceState {
    return this._currentState;
  }

  public canTransitionTo(targetState: PowerSequenceState): boolean {
    const allowed = BootSequenceStateMachine.VALID_TRANSITIONS[this._currentState];
    return allowed ? allowed.includes(targetState) : false;
  }

  public transitionTo(targetState: PowerSequenceState, reason?: string): void {
    if (!this.canTransitionTo(targetState)) {
      throw new IllegalStateTransitionException(this._currentState, targetState, reason);
    }

    this._currentState = targetState;
    this.applyRailStatesForCurrentState();
  }

  private applyRailStatesForCurrentState(): void {
    switch (this._currentState) {
      case PowerSequenceState.S5_OFF:
        for (const rail of this.powerTree.getAllRails()) {
          // In S5_OFF, only battery / primary ingestion root is active
          if (rail.railName === "PP_BATT_VCC" || (rail.parentRailName === null && rail.railType === PowerRailType.PRIMARY_BUS)) {
            rail.setPowered(true);
          } else {
            rail.setPowered(false);
          }
        }
        break;

      case PowerSequenceState.S4_STANDBY:
      case PowerSequenceState.S3_TRIGGER:
        for (const rail of this.powerTree.getAllRails()) {
          if (
            rail.railName === "PP_BATT_VCC" ||
            rail.railName === "PP_VDD_MAIN" ||
            rail.railType === PowerRailType.ALWAYS_ON_S2
          ) {
            rail.setPowered(true);
          } else {
            rail.setPowered(false);
          }
        }
        break;

      case PowerSequenceState.S2_SLEEP:
        for (const rail of this.powerTree.getAllRails()) {
          if (
            rail.railName === "PP_BATT_VCC" ||
            rail.railName === "PP_VDD_MAIN" ||
            rail.railType === PowerRailType.ALWAYS_ON_S2
          ) {
            rail.setPowered(true);
          } else {
            // Core bucks and high current rails deactivated in S2 sleep
            rail.setPowered(false);
          }
        }
        break;

      case PowerSequenceState.S0_FULL_EXECUTION:
        for (const rail of this.powerTree.getAllRails()) {
          rail.setPowered(true);
        }
        break;
    }
  }
}
