import { SchematicPinLocation } from "./SchematicPinLocation.js";

export interface SchematicNetProps {
  id: string;
  name: string;
  sheetNumbers?: number[];
  pins?: SchematicPinLocation[];
}

export class SchematicNet {
  public readonly id: string;
  public readonly name: string;
  public readonly sheetNumbers: number[];
  private readonly _pins: SchematicPinLocation[] = [];

  constructor(props: SchematicNetProps) {
    if (!props.id || props.id.trim().length === 0) {
      throw new Error("id cannot be empty");
    }
    if (!props.name || props.name.trim().length === 0) {
      throw new Error("name cannot be empty");
    }

    this.id = props.id.trim();
    this.name = props.name.trim();
    this.sheetNumbers = props.sheetNumbers ? [...props.sheetNumbers] : [];

    if (props.pins) {
      for (const pin of props.pins) {
        this.addPin(pin);
      }
    }
  }

  public get pins(): ReadonlyArray<SchematicPinLocation> {
    return Object.freeze([...this._pins]);
  }

  public addPin(pin: SchematicPinLocation): void {
    if (!this._pins.some((p) => p.id === pin.id)) {
      this._pins.push(pin);
    }
  }
}
