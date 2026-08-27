import { describe, it, expect } from "vitest";
import { PowerTree } from "../../../src/domain/schematics/entities/PowerTree.js";
import { PowerRailNode } from "../../../src/domain/schematics/entities/PowerRailNode.js";
import { PowerRailType } from "../../../src/domain/schematics/value-objects/PowerRailType.js";
import { PowerSequenceState } from "../../../src/domain/schematics/value-objects/PowerSequenceState.js";
import {
  SimulateBootSequenceCommand,
  SimulateBootSequenceHandler,
} from "../../../src/application/schematics/commands/SimulateBootSequenceHandler.js";

describe("SimulateBootSequenceHandler", () => {
  it("should simulate cold boot forward sequence successfully", async () => {
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
    const command: SimulateBootSequenceCommand = {
      powerTree,
      targetState: PowerSequenceState.S0_FULL_EXECUTION,
    };

    const result = await handler.execute(command);

    expect(result).toBeDefined();
    expect(result.finalState).toBe(PowerSequenceState.S0_FULL_EXECUTION);
    expect(result.success).toBe(true);
    expect(result.steps.length).toBe(3);
    expect(result.activeRails).toContain("PP_VDD_MAIN");
    expect(result.activeRails).toContain("PP_VDD_CPU_CORE");
  });

  it("should handle single transition or specific target state", async () => {
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

    const handler = new SimulateBootSequenceHandler();
    const command: SimulateBootSequenceCommand = {
      powerTree,
      targetState: PowerSequenceState.S4_STANDBY,
    };

    const result = await handler.execute(command);

    expect(result.finalState).toBe(PowerSequenceState.S4_STANDBY);
    expect(result.success).toBe(true);
    expect(result.activeRails).toContain("PP_VDD_MAIN");
  });
});
