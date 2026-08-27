function roundPrecision(val: number, decimals: number = 4): number {
  const factor = Math.pow(10, decimals);
  return Math.round(val * factor) / factor;
}

export interface MultimeterProfileProps {
  meterModel: string;
  scaleFactor?: number;
  offsetVolts?: number;
}

export class MultimeterProfile {
  public readonly name: string;
  public readonly scaleFactor: number;
  public readonly offsetVolts: number;

  constructor(name: string, scaleFactor: number = 1.0, offsetVolts: number = 0.0) {
    if (!name || name.trim().length === 0) {
      throw new Error("MultimeterProfile name cannot be empty");
    }
    this.name = name.trim();
    this.scaleFactor = scaleFactor;
    this.offsetVolts = offsetVolts;
  }

  public normalize(measuredVolts: number): number {
    return roundPrecision(measuredVolts * this.scaleFactor + this.offsetVolts, 4);
  }

  public static readonly FLUKE_115_STANDARD = new MultimeterProfile("FLUKE_115_STANDARD", 1.0, 0.0);
  public static readonly SUNSHINE_DT17N = new MultimeterProfile("SUNSHINE_DT17N", 1.0, 0.035);
  public static readonly UNI_T_UT61E = new MultimeterProfile("UNI_T_UT61E", 1.0, 0.0);
  public static readonly ANENG_Q1 = new MultimeterProfile("ANENG_Q1", 1.0, 0.0);
}
