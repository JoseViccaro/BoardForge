export class SymbolPinRef {
  public readonly refDes: string;
  public readonly pinNumber: string;
  public readonly pinName?: string;

  constructor(refDes: string, pinNumber: string, pinName?: string) {
    if (!refDes || refDes.trim().length === 0) {
      throw new Error("refDes cannot be empty");
    }
    if (!pinNumber || pinNumber.trim().length === 0) {
      throw new Error("pinNumber cannot be empty");
    }

    this.refDes = refDes.trim();
    this.pinNumber = pinNumber.trim();
    this.pinName = pinName ? pinName.trim() : undefined;
  }

  public get key(): string {
    return `${this.refDes}.${this.pinNumber}`;
  }
}
