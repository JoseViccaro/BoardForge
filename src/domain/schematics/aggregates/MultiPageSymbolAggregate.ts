import { SchematicSymbol } from "../entities/SchematicSymbol.js";
import { SchematicPinLocation } from "../entities/SchematicPinLocation.js";

export class MultiPageSymbolAggregate {
  public readonly refDes: string;
  private readonly _symbols: SchematicSymbol[] = [];

  constructor(refDes: string) {
    if (!refDes || refDes.trim().length === 0) {
      throw new Error("refDes cannot be empty");
    }
    this.refDes = refDes.trim().toUpperCase();
  }

  public get symbols(): ReadonlyArray<SchematicSymbol> {
    return Object.freeze([...this._symbols]);
  }

  public addSymbolBank(symbol: SchematicSymbol): void {
    if (symbol.refDes.toUpperCase() !== this.refDes) {
      throw new Error(`refDes mismatch: expected ${this.refDes}, got ${symbol.refDes}`);
    }
    this._symbols.push(symbol);
  }

  public getAllPages(): number[] {
    const pages = Array.from(new Set(this._symbols.map((s) => s.pageNumber)));
    return pages.sort((a, b) => a - b);
  }

  public findPin(pinNumber: string): { symbol: SchematicSymbol; pin: SchematicPinLocation } | undefined {
    const normPin = pinNumber.trim();
    for (const sym of this._symbols) {
      const pin = sym.findPin(normPin);
      if (pin) {
        return { symbol: sym, pin };
      }
    }
    return undefined;
  }

  public getAllPins(): SchematicPinLocation[] {
    const allPins: SchematicPinLocation[] = [];
    for (const sym of this._symbols) {
      allPins.push(...sym.pins);
    }
    return allPins;
  }
}
