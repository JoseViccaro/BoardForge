import { MultimeterProfile } from "./MultimeterProfile.js";

function roundPrecision(val: number, decimals: number = 4): number {
  const factor = Math.pow(10, decimals);
  return Math.round(val * factor) / factor;
}

export class DiodeReading {
  public readonly forwardVoltageVolts: number;
  public readonly isOpenLoop: boolean;
  public readonly meterProfile?: MultimeterProfile;

  constructor(
    forwardVoltageVolts: number,
    isOpenLoop: boolean = false,
    meterProfile?: MultimeterProfile
  ) {
    if (forwardVoltageVolts < 0) {
      throw new Error("forwardVoltageVolts cannot be negative");
    }
    this.forwardVoltageVolts = roundPrecision(forwardVoltageVolts, 4);
    this.isOpenLoop = isOpenLoop;
    this.meterProfile = meterProfile;
  }

  public normalizedVolts(): number {
    if (this.isOpenLoop) {
      return this.forwardVoltageVolts;
    }
    if (this.meterProfile) {
      return this.meterProfile.normalize(this.forwardVoltageVolts);
    }
    return this.forwardVoltageVolts;
  }

  public static createOpenLoop(meterProfile?: MultimeterProfile): DiodeReading {
    return new DiodeReading(2.999, true, meterProfile);
  }
}
