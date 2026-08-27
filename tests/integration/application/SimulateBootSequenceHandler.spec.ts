import { describe, it, expect } from "vitest";
import { SimulateBootSequenceHandler } from "../../../src/application/schematics/commands/SimulateBootSequenceHandler.js";
import { PowerTree } from "../../../src/domain/schematics/entities/PowerTree.js";
import { PowerRailNode } from "../../../src/domain/schematics/entities/PowerRailNode.js";
import { PowerRailType } from "../../../src/domain/schematics/value-objects/PowerRailType.js";
import { PowerSequenceState } from "../../../src/domain/schematics/value-objects/PowerSequenceState.js";

describe("SimulateBootSequenceHandler Integration Test", () => {
  it("should execute SimulateBootSequenceHandler command and return step-by-step BootSequenceResultDto", async () => {
    const powerTree = new PowerTree("TREE_IPHONE13");
    powerTree.addRail(
      new PowerRailNode({
        railName: "PP_BATT_VCC",
        nominalVoltage: 3.8,
        voltageMin: 3.0,
        voltageMax: 4.4,
        railType: PowerRailType.PRIMARY_BUS,
      })
    );
    powerTree.addRail(
      new PowerRailNode({
        railName: "PP_VDD_MAIN",
        nominalVoltage: 4.0,
        voltageMin: 3.7,
        voltageMax: 4.5,
        railType: PowerRailType.PRIMARY_BUS,
        parentRailName: "PP_BATT_VCC",
      })
    );
    powerTree.addRail(
      new PowerRailNode({
        railName: "PP1V8_S2",
        nominalVoltage: 1.8,
        voltageMin: 1.7,
        voltageMax: 1.9,
        railType: PowerRailType.ALWAYS_ON_S2,
        parentRailName: "PP_VDD_MAIN",
      })
    );
    powerTree.addRail(
      new PowerRailNode({
        railName: "PP_VDD_CPU_CORE",
        nominalVoltage: 0.85,
        voltageMin: 0.7,
        voltageMax: 1.0,
        railType: PowerRailType.CORE_BUCK,
        parentRailName: "PP_VDD_MAIN",
      })
    );

    const handler = new SimulateBootSequenceHandler();
    const result = await handler.execute({
      powerTree,
      targetState: PowerSequenceState.S0_FULL_EXECUTION,
    });

    expect(result.success).toBe(true);
    expect(result.finalState).toBe(PowerSequenceState.S0_FULL_EXECUTION);
    expect(result.steps).toHaveLength(3);
    expect(result.steps[0].fromState).toBe(PowerSequenceState.S5_OFF);
    expect(result.steps[0].toState).toBe(PowerSequenceState.S4_STANDBY);
    expect(result.steps[1].toState).toBe(PowerSequenceState.S3_TRIGGER);
    expect(result.steps[2].toState).toBe(PowerSequenceState.S0_FULL_EXECUTION);
  });
});
