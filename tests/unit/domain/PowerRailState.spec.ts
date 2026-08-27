import { describe, it, expect } from "vitest";
import { PowerRailState } from "../../../src/domain/schematics/value-objects/PowerRailState.js";
import { PowerRailType } from "../../../src/domain/schematics/value-objects/PowerRailType.js";

describe("PowerRailState (Domain VO)", () => {
  it("should create PowerRailState and toggle powered status", () => {
    const rail = new PowerRailState({
      railName: "PP_VDD_MAIN",
      nominalVoltage: 4.0,
      voltageMin: 3.7,
      voltageMax: 4.4,
      railType: PowerRailType.PRIMARY_BUS,
      isPowered: false,
    });
    expect(rail.isPowered).toBe(false);
    expect(rail.withPowered(true).isPowered).toBe(true);
  });
});
