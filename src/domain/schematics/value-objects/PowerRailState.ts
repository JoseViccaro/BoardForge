import { PowerRailType } from "./PowerRailType.js";

function roundPrecision(val: number, decimals: number = 4): number {
  const factor = Math.pow(10, decimals);
  return Math.round(val * factor) / factor;
}

export interface PowerRailStateProps {
  railName: string;
  nominalVoltage: number;
  voltageMin: number;
  voltageMax: number;
  railType: PowerRailType;
  parentRailName?: string | null;
  isPowered: boolean;
}

export class PowerRailState {
  public readonly railName: string;
  public readonly nominalVoltage: number;
  public readonly voltageMin: number;
  public readonly voltageMax: number;
  public readonly railType: PowerRailType;
  public readonly parentRailName: string | null;
  public readonly isPowered: boolean;

  constructor(props: PowerRailStateProps) {
    if (!props.railName || props.railName.trim().length === 0) {
      throw new Error("railName cannot be empty");
    }
    if (props.voltageMin < 0) {
      throw new Error("voltageMin cannot be negative");
    }
    if (props.voltageMin > props.nominalVoltage) {
      throw new Error("voltageMin cannot exceed nominalVoltage");
    }
    if (props.nominalVoltage > props.voltageMax) {
      throw new Error("nominalVoltage cannot exceed voltageMax");
    }
    if (!props.railType) {
      throw new Error("railType is required");
    }

    this.railName = props.railName.trim();
    this.nominalVoltage = roundPrecision(props.nominalVoltage, 4);
    this.voltageMin = roundPrecision(props.voltageMin, 4);
    this.voltageMax = roundPrecision(props.voltageMax, 4);
    this.railType = props.railType;
    this.parentRailName = props.parentRailName ? props.parentRailName.trim() : null;
    this.isPowered = props.isPowered;
  }

  public withPowered(isPowered: boolean): PowerRailState {
    return new PowerRailState({
      railName: this.railName,
      nominalVoltage: this.nominalVoltage,
      voltageMin: this.voltageMin,
      voltageMax: this.voltageMax,
      railType: this.railType,
      parentRailName: this.parentRailName,
      isPowered,
    });
  }
}
