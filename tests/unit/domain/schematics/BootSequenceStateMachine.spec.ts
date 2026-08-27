import { describe, it, expect, beforeEach } from "vitest";
import { BootSequenceStateMachine } from "../../../../src/domain/schematics/services/BootSequenceStateMachine.js";
import { PowerSequenceState } from "../../../../src/domain/schematics/value-objects/PowerSequenceState.js";
import { PowerRailType } from "../../../../src/domain/schematics/value-objects/PowerRailType.js";
import { PowerTree } from "../../../../src/domain/schematics/entities/PowerTree.js";
import { PowerRailNode } from "../../../../src/domain/schematics/entities/PowerRailNode.js";
import { IllegalStateTransitionException } from "../../../../src/domain/schematics/exceptions/IllegalStateTransitionException.js";

function createIPhone13PowerTree(): PowerTree {
  const tree = new PowerTree("IPHONE13_POWER_TREE");
  tree.addRail(new PowerRailNode({
    railName: "PP_BATT_VCC",
    nominalVoltage: 3.8,
    voltageMin: 3.2,
    voltageMax: 4.4,
    railType: PowerRailType.PRIMARY_BUS,
  }));
  tree.addRail(new PowerRailNode({
    railName: "PP_VDD_MAIN",
    nominalVoltage: 4.0,
    voltageMin: 3.7,
    voltageMax: 4.4,
    railType: PowerRailType.PRIMARY_BUS,
    parentRailName: "PP_BATT_VCC",
  }));
  tree.addRail(new PowerRailNode({
    railName: "PP1V8_S2",
    nominalVoltage: 1.8,
    voltageMin: 1.7,
    voltageMax: 1.9,
    railType: PowerRailType.ALWAYS_ON_S2,
    parentRailName: "PP_VDD_MAIN",
  }));
  tree.addRail(new PowerRailNode({
    railName: "PP_VDD_CPU_CORE",
    nominalVoltage: 0.85,
    voltageMin: 0.75,
    voltageMax: 0.95,
    railType: PowerRailType.CORE_BUCK,
    parentRailName: "PP_VDD_MAIN",
  }));
  tree.addRail(new PowerRailNode({
    railName: "PP_VDD_GPU",
    nominalVoltage: 0.85,
    voltageMin: 0.75,
    voltageMax: 0.95,
    railType: PowerRailType.CORE_BUCK,
    parentRailName: "PP_VDD_MAIN",
  }));
  tree.addRail(new PowerRailNode({
    railName: "PP0V85_LPDDR5",
    nominalVoltage: 0.85,
    voltageMin: 0.75,
    voltageMax: 0.95,
    railType: PowerRailType.CORE_BUCK,
    parentRailName: "PP_VDD_MAIN",
  }));
  return tree;
}

describe("BootSequenceStateMachine Domain Service", () => {
  let sm: BootSequenceStateMachine;
  let powerTree: PowerTree;

  beforeEach(() => {
    powerTree = createIPhone13PowerTree();
    sm = new BootSequenceStateMachine(powerTree);
  });

  it("should initialize in state S5_OFF with only PP_BATT_VCC powered", () => {
    expect(sm.currentState).toBe(PowerSequenceState.S5_OFF);
    expect(powerTree.getRail("PP_BATT_VCC")?.isPowered).toBe(true);
    expect(powerTree.getRail("PP_VDD_MAIN")?.isPowered).toBe(false);
    expect(powerTree.getRail("PP1V8_S2")?.isPowered).toBe(false);
    expect(powerTree.getRail("PP_VDD_CPU_CORE")?.isPowered).toBe(false);
  });

  it("should execute legal forward boot sequence S5_OFF -> S4_STANDBY -> S3_TRIGGER -> S0_FULL_EXECUTION", () => {
    // S5_OFF -> S4_STANDBY
    sm.transitionTo(PowerSequenceState.S4_STANDBY);
    expect(sm.currentState).toBe(PowerSequenceState.S4_STANDBY);
    expect(powerTree.getRail("PP_VDD_MAIN")?.isPowered).toBe(true);
    expect(powerTree.getRail("PP1V8_S2")?.isPowered).toBe(true);
    expect(powerTree.getRail("PP_VDD_CPU_CORE")?.isPowered).toBe(false);

    // S4_STANDBY -> S3_TRIGGER
    sm.transitionTo(PowerSequenceState.S3_TRIGGER);
    expect(sm.currentState).toBe(PowerSequenceState.S3_TRIGGER);

    // S3_TRIGGER -> S0_FULL_EXECUTION
    sm.transitionTo(PowerSequenceState.S0_FULL_EXECUTION);
    expect(sm.currentState).toBe(PowerSequenceState.S0_FULL_EXECUTION);
    expect(powerTree.getRail("PP_VDD_CPU_CORE")?.isPowered).toBe(true);
    expect(powerTree.getRail("PP_VDD_GPU")?.isPowered).toBe(true);
    expect(powerTree.getRail("PP0V85_LPDDR5")?.isPowered).toBe(true);
  });

  it("should transition between S0_FULL_EXECUTION and S2_SLEEP bidirectionally", () => {
    sm.transitionTo(PowerSequenceState.S4_STANDBY);
    sm.transitionTo(PowerSequenceState.S3_TRIGGER);
    sm.transitionTo(PowerSequenceState.S0_FULL_EXECUTION);

    // S0 -> S2_SLEEP
    sm.transitionTo(PowerSequenceState.S2_SLEEP);
    expect(sm.currentState).toBe(PowerSequenceState.S2_SLEEP);
    expect(powerTree.getRail("PP_VDD_MAIN")?.isPowered).toBe(true);
    expect(powerTree.getRail("PP1V8_S2")?.isPowered).toBe(true);
    expect(powerTree.getRail("PP_VDD_CPU_CORE")?.isPowered).toBe(false);

    // S2_SLEEP -> S0_FULL_EXECUTION (Wake event)
    sm.transitionTo(PowerSequenceState.S0_FULL_EXECUTION);
    expect(sm.currentState).toBe(PowerSequenceState.S0_FULL_EXECUTION);
    expect(powerTree.getRail("PP_VDD_CPU_CORE")?.isPowered).toBe(true);
  });

  it("should support fault / power-cut recovery to S5_OFF from any state", () => {
    sm.transitionTo(PowerSequenceState.S4_STANDBY);
    sm.transitionTo(PowerSequenceState.S5_OFF);
    expect(sm.currentState).toBe(PowerSequenceState.S5_OFF);
    expect(powerTree.getRail("PP_VDD_MAIN")?.isPowered).toBe(false);

    sm.transitionTo(PowerSequenceState.S4_STANDBY);
    sm.transitionTo(PowerSequenceState.S3_TRIGGER);
    sm.transitionTo(PowerSequenceState.S5_OFF);
    expect(sm.currentState).toBe(PowerSequenceState.S5_OFF);

    sm.transitionTo(PowerSequenceState.S4_STANDBY);
    sm.transitionTo(PowerSequenceState.S3_TRIGGER);
    sm.transitionTo(PowerSequenceState.S0_FULL_EXECUTION);
    sm.transitionTo(PowerSequenceState.S5_OFF);
    expect(sm.currentState).toBe(PowerSequenceState.S5_OFF);
    expect(powerTree.getRail("PP_VDD_CPU_CORE")?.isPowered).toBe(false);
  });

  it("should reject illegal transition from S5_OFF directly to S0_FULL_EXECUTION", () => {
    expect(() => {
      sm.transitionTo(PowerSequenceState.S0_FULL_EXECUTION);
    }).toThrow(IllegalStateTransitionException);

    expect(sm.currentState).toBe(PowerSequenceState.S5_OFF);
  });

  it("should reject illegal transition from S5_OFF to S3_TRIGGER", () => {
    expect(() => {
      sm.transitionTo(PowerSequenceState.S3_TRIGGER);
    }).toThrow(IllegalStateTransitionException);

    expect(sm.currentState).toBe(PowerSequenceState.S5_OFF);
  });

  it("should reject illegal transition from S4_STANDBY to S2_SLEEP", () => {
    sm.transitionTo(PowerSequenceState.S4_STANDBY);
    expect(() => {
      sm.transitionTo(PowerSequenceState.S2_SLEEP);
    }).toThrow(IllegalStateTransitionException);

    expect(sm.currentState).toBe(PowerSequenceState.S4_STANDBY);
  });

  it("should include fromState and toState in IllegalStateTransitionException", () => {
    try {
      sm.transitionTo(PowerSequenceState.S0_FULL_EXECUTION);
      expect.fail("Expected exception not thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(IllegalStateTransitionException);
      const ex = err as IllegalStateTransitionException;
      expect(ex.fromState).toBe(PowerSequenceState.S5_OFF);
      expect(ex.toState).toBe(PowerSequenceState.S0_FULL_EXECUTION);
      expect(ex.message).toContain("Cannot transition from S5_OFF to S0_FULL_EXECUTION");
    }
  });
});
