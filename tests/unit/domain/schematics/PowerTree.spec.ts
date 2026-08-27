import { describe, it, expect, beforeEach } from "vitest";
import { PowerTree } from "../../../../src/domain/schematics/entities/PowerTree.js";
import { PowerRailNode } from "../../../../src/domain/schematics/entities/PowerRailNode.js";
import { PowerRailType } from "../../../../src/domain/schematics/value-objects/PowerRailType.js";

describe("PowerTree Entity", () => {
  let tree: PowerTree;

  beforeEach(() => {
    tree = new PowerTree("IPHONE13_POWER_TREE");
  });

  it("should create an empty power tree with an identifier", () => {
    expect(tree.id).toBe("IPHONE13_POWER_TREE");
    expect(tree.getAllRails()).toHaveLength(0);
  });

  it("should build hierarchical iPhone 13 power tree structure", () => {
    const battVcc = new PowerRailNode({
      railName: "PP_BATT_VCC",
      nominalVoltage: 3.8,
      voltageMin: 3.2,
      voltageMax: 4.4,
      railType: PowerRailType.PRIMARY_BUS,
      isPowered: true,
      sourceRegulator: "Battery / Tigris Charger",
    });

    const vddMain = new PowerRailNode({
      railName: "PP_VDD_MAIN",
      nominalVoltage: 4.0,
      voltageMin: 3.7,
      voltageMax: 4.4,
      railType: PowerRailType.PRIMARY_BUS,
      parentRailName: "PP_BATT_VCC",
      isPowered: true,
      sourceRegulator: "Charger IC (Islander/Hydra)",
    });

    const vddBoost = new PowerRailNode({
      railName: "PP_VDD_BOOST",
      nominalVoltage: 5.0,
      voltageMin: 4.8,
      voltageMax: 5.2,
      railType: PowerRailType.BOOST,
      parentRailName: "PP_VDD_MAIN",
      isPowered: false,
      sourceRegulator: "Boost IC",
    });

    const s2Rail = new PowerRailNode({
      railName: "PP1V8_S2",
      nominalVoltage: 1.8,
      voltageMin: 1.7,
      voltageMax: 1.9,
      railType: PowerRailType.ALWAYS_ON_S2,
      parentRailName: "PP_VDD_MAIN",
      isPowered: true,
      sourceRegulator: "Main PMIC LDO",
    });

    const cpuCore = new PowerRailNode({
      railName: "PP_VDD_CPU_CORE",
      nominalVoltage: 0.85,
      voltageMin: 0.75,
      voltageMax: 0.95,
      railType: PowerRailType.CORE_BUCK,
      parentRailName: "PP_VDD_MAIN",
      isPowered: false,
      sourceRegulator: "Main PMIC Buck",
    });

    tree.addRail(battVcc);
    tree.addRail(vddMain);
    tree.addRail(vddBoost);
    tree.addRail(s2Rail);
    tree.addRail(cpuCore);

    expect(tree.getAllRails()).toHaveLength(5);
    expect(tree.getRail("PP_VDD_MAIN")).toBeDefined();
    expect(tree.getChildren("PP_VDD_MAIN")).toHaveLength(3);
    expect(tree.getRoots()).toHaveLength(1);
    expect(tree.getRoots()[0].railName).toBe("PP_BATT_VCC");
  });

  it("should reject duplicate rail names", () => {
    const rail1 = new PowerRailNode({
      railName: "PP_VDD_MAIN",
      nominalVoltage: 4.0,
      voltageMin: 3.7,
      voltageMax: 4.4,
      railType: PowerRailType.PRIMARY_BUS,
    });
    const rail2 = new PowerRailNode({
      railName: "PP_VDD_MAIN",
      nominalVoltage: 4.0,
      voltageMin: 3.7,
      voltageMax: 4.4,
      railType: PowerRailType.PRIMARY_BUS,
    });

    tree.addRail(rail1);
    expect(() => tree.addRail(rail2)).toThrow("Duplicate power rail");
  });

  it("should validate rail dependency when parent rail is active", () => {
    const vddMain = new PowerRailNode({
      railName: "PP_VDD_MAIN",
      nominalVoltage: 4.0,
      voltageMin: 3.7,
      voltageMax: 4.4,
      railType: PowerRailType.PRIMARY_BUS,
      isPowered: true,
    });

    const vddBoost = new PowerRailNode({
      railName: "PP_VDD_BOOST",
      nominalVoltage: 5.0,
      voltageMin: 4.8,
      voltageMax: 5.2,
      railType: PowerRailType.BOOST,
      parentRailName: "PP_VDD_MAIN",
      isPowered: true,
    });

    tree.addRail(vddMain);
    tree.addRail(vddBoost);

    const validation = tree.validateRailDependency("PP_VDD_BOOST");
    expect(validation.isValid).toBe(true);
  });

  it("should fail validation if child rail is active but parent rail is inactive/faulted", () => {
    const vddMain = new PowerRailNode({
      railName: "PP_VDD_MAIN",
      nominalVoltage: 4.0,
      voltageMin: 3.7,
      voltageMax: 4.4,
      railType: PowerRailType.PRIMARY_BUS,
      isPowered: false, // Inactive / faulted parent
    });

    const vddBoost = new PowerRailNode({
      railName: "PP_VDD_BOOST",
      nominalVoltage: 5.0,
      voltageMin: 4.8,
      voltageMax: 5.2,
      railType: PowerRailType.BOOST,
      parentRailName: "PP_VDD_MAIN",
      isPowered: true, // Invalid active state
    });

    tree.addRail(vddMain);
    tree.addRail(vddBoost);

    const validation = tree.validateRailDependency("PP_VDD_BOOST");
    expect(validation.isValid).toBe(false);
    expect(validation.reason).toContain("Parent rail PP_VDD_MAIN inactive");
  });

  it("should evaluate expected state asserting 0.0V / unpowered when parent rail is in fault", () => {
    const vddMain = new PowerRailNode({
      railName: "PP_VDD_MAIN",
      nominalVoltage: 4.0,
      voltageMin: 3.7,
      voltageMax: 4.4,
      railType: PowerRailType.PRIMARY_BUS,
      isPowered: false,
    });

    const vddBoost = new PowerRailNode({
      railName: "PP_VDD_BOOST",
      nominalVoltage: 5.0,
      voltageMin: 4.8,
      voltageMax: 5.2,
      railType: PowerRailType.BOOST,
      parentRailName: "PP_VDD_MAIN",
      isPowered: false,
    });

    tree.addRail(vddMain);
    tree.addRail(vddBoost);

    const evalResult = tree.evaluateExpectedState("PP_VDD_BOOST");
    expect(evalResult.expectedPowered).toBe(false);
    expect(evalResult.reason).toContain("Parent rail PP_VDD_MAIN inactive");
  });
});
