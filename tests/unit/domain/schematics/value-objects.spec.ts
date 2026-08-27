import { describe, it, expect } from "vitest";
import { PowerRailType } from "../../../../src/domain/schematics/value-objects/PowerRailType.js";
import { PowerSequenceState } from "../../../../src/domain/schematics/value-objects/PowerSequenceState.js";
import { PowerRailState } from "../../../../src/domain/schematics/value-objects/PowerRailState.js";

describe("Schematics Value Objects", () => {
  describe("PowerRailType", () => {
    it("should define all valid power rail types", () => {
      expect(PowerRailType.PRIMARY_BUS).toBe("PRIMARY_BUS");
      expect(PowerRailType.BOOST).toBe("BOOST");
      expect(PowerRailType.ALWAYS_ON_S2).toBe("ALWAYS_ON_S2");
      expect(PowerRailType.CORE_BUCK).toBe("CORE_BUCK");
      expect(PowerRailType.LDO_SWITCHED).toBe("LDO_SWITCHED");
    });
  });

  describe("PowerSequenceState", () => {
    it("should define all PMU cold boot states", () => {
      expect(PowerSequenceState.S5_OFF).toBe("S5_OFF");
      expect(PowerSequenceState.S4_STANDBY).toBe("S4_STANDBY");
      expect(PowerSequenceState.S3_TRIGGER).toBe("S3_TRIGGER");
      expect(PowerSequenceState.S2_SLEEP).toBe("S2_SLEEP");
      expect(PowerSequenceState.S0_FULL_EXECUTION).toBe("S0_FULL_EXECUTION");
    });
  });

  describe("PowerRailState", () => {
    it("should create PowerRailState with valid parameters", () => {
      const rail = new PowerRailState({
        railName: "PP_VDD_MAIN",
        nominalVoltage: 4.0,
        voltageMin: 3.7,
        voltageMax: 4.4,
        railType: PowerRailType.PRIMARY_BUS,
        parentRailName: "PP_BATT_VCC",
        isPowered: true,
      });

      expect(rail.railName).toBe("PP_VDD_MAIN");
      expect(rail.nominalVoltage).toBe(4.0);
      expect(rail.voltageMin).toBe(3.7);
      expect(rail.voltageMax).toBe(4.4);
      expect(rail.railType).toBe(PowerRailType.PRIMARY_BUS);
      expect(rail.parentRailName).toBe("PP_BATT_VCC");
      expect(rail.isPowered).toBe(true);
    });

    it("should allow creating immutable updated state with withPowered()", () => {
      const rail = new PowerRailState({
        railName: "PP_VDD_MAIN",
        nominalVoltage: 4.0,
        voltageMin: 3.7,
        voltageMax: 4.4,
        railType: PowerRailType.PRIMARY_BUS,
        isPowered: false,
      });

      const poweredRail = rail.withPowered(true);
      expect(poweredRail.isPowered).toBe(true);
      expect(rail.isPowered).toBe(false);
    });

    it("should validate voltage boundary invariants", () => {
      expect(() => new PowerRailState({
        railName: "PP_TEST",
        nominalVoltage: 5.0,
        voltageMin: 6.0,
        voltageMax: 4.0,
        railType: PowerRailType.BOOST,
        isPowered: true,
      })).toThrow("voltageMin cannot exceed nominalVoltage");

      expect(() => new PowerRailState({
        railName: "PP_TEST",
        nominalVoltage: 5.0,
        voltageMin: 4.0,
        voltageMax: 4.5,
        railType: PowerRailType.BOOST,
        isPowered: true,
      })).toThrow("nominalVoltage cannot exceed voltageMax");

      expect(() => new PowerRailState({
        railName: "",
        nominalVoltage: 4.0,
        voltageMin: 3.8,
        voltageMax: 4.2,
        railType: PowerRailType.PRIMARY_BUS,
        isPowered: true,
      })).toThrow("railName cannot be empty");
    });
  });
});
