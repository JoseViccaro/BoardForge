import { PowerTree } from "../../domain/schematics/entities/PowerTree.js";
import { PowerSequenceState } from "../../domain/schematics/value-objects/PowerSequenceState.js";
import { SimulateBootSequenceHandler } from "./commands/SimulateBootSequenceHandler.js";
import { EntityNotFoundError } from "../../interfaces/http/errors/HttpErrors.js";

export class PmuSimulationFacade {
  private readonly trees: Map<string, PowerTree> = new Map();
  private readonly handler = new SimulateBootSequenceHandler();

  public registerPowerTree(boardId: string, tree: PowerTree): void {
    this.trees.set(boardId, tree);
  }

  public async simulateSequence(
    boardId: string,
    trigger: string = "VBUS",
    organizationId?: string
  ): Promise<any> {
    const powerTree = this.trees.get(boardId);
    if (!powerTree) {
      throw new EntityNotFoundError(`Power tree for board '${boardId}' not found.`);
    }

    const result = await this.handler.execute({
      powerTree,
      initialState: PowerSequenceState.S5_OFF,
      targetState: PowerSequenceState.S0_FULL_EXECUTION,
    });

    return {
      boardId,
      trigger,
      success: result.success,
      finalState: result.finalState,
      stages: result.steps.map((s, idx) => ({
        step: idx + 1,
        fromState: s.fromState,
        toState: s.toState,
        activeRails: s.activeRails,
      })),
      activeRails: result.activeRails,
    };
  }
}
