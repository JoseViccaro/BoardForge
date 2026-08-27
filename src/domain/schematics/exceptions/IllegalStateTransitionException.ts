import { PowerSequenceState } from "../value-objects/PowerSequenceState.js";

export class IllegalStateTransitionException extends Error {
  public readonly fromState: PowerSequenceState;
  public readonly toState: PowerSequenceState;

  constructor(fromState: PowerSequenceState, toState: PowerSequenceState, details?: string) {
    const msg = `Cannot transition from ${fromState} to ${toState}${details ? `: ${details}` : ""}`;
    super(msg);
    this.name = "IllegalStateTransitionException";
    this.fromState = fromState;
    this.toState = toState;
    Object.setPrototypeOf(this, IllegalStateTransitionException.prototype);
  }
}
