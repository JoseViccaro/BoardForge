import { PowerRailType } from "../value-objects/PowerRailType.js";

function roundPrecision(val: number, decimals: number = 4): number {
  const factor = Math.pow(10, decimals);
  return Math.round(val * factor) / factor;
}

export interface PowerRailNodeProps {
  railName: string;
  nominalVoltage: number;
  voltageMin?: number;
  voltageMax?: number;
  railType: PowerRailType;
  parentRailName?: string | null;
  isPowered?: boolean;
  sourceRegulator?: string | null;
}

export class PowerRailNode {
  public readonly railName: string;
  public readonly nominalVoltage: number;
  public readonly voltageMin: number;
  public readonly voltageMax: number;
  public readonly railType: PowerRailType;
  public readonly parentRailName: string | null;
  private _isPowered: boolean;
  public readonly sourceRegulator: string | null;

  constructor(props: PowerRailNodeProps) {
    if (!props.railName || props.railName.trim().length === 0) {
      throw new Error("railName cannot be empty");
    }
    if (props.nominalVoltage < 0) {
      throw new Error("nominalVoltage cannot be negative");
    }

    const min = props.voltageMin !== undefined ? props.voltageMin : props.nominalVoltage * 0.9;
    const max = props.voltageMax !== undefined ? props.voltageMax : props.nominalVoltage * 1.1;

    if (min < 0) {
      throw new Error("voltageMin cannot be negative");
    }
    if (min > props.nominalVoltage) {
      throw new Error("voltageMin cannot exceed nominalVoltage");
    }
    if (props.nominalVoltage > max) {
      throw new Error("nominalVoltage cannot exceed voltageMax");
    }
    if (!props.railType) {
      throw new Error("railType is required");
    }

    this.railName = props.railName.trim();
    this.nominalVoltage = roundPrecision(props.nominalVoltage, 4);
    this.voltageMin = roundPrecision(min, 4);
    this.voltageMax = roundPrecision(max, 4);
    this.railType = props.railType;
    this.parentRailName = props.parentRailName ? props.parentRailName.trim() : null;
    this._isPowered = props.isPowered ?? false;
    this.sourceRegulator = props.sourceRegulator ? props.sourceRegulator.trim() : null;
  }

  public get isPowered(): boolean {
    return this._isPowered;
  }

  public setPowered(isPowered: boolean): void {
    this._isPowered = isPowered;
  }
}
