import { BoundingBox2D } from "../value-objects/BoundingBox2D.js";
import { SchematicPinLocation } from "./SchematicPinLocation.js";

export interface SchematicSymbolProps {
  id: string;
  refDes: string;
  bankDesignator?: string;
  pageNumber?: number;
  sheetNumber?: number;
  bounds: BoundingBox2D;
  pins?: SchematicPinLocation[];
  value?: string;
  packageFootprint?: string;
  footprint?: string;
}

export class SchematicSymbol {
  public readonly id: string;
  public readonly refDes: string;
  public readonly bankDesignator?: string;
  public readonly pageNumber: number;
  public readonly bounds: BoundingBox2D;
  public readonly value?: string;
  public readonly packageFootprint?: string;
  private readonly _pins: SchematicPinLocation[] = [];

  constructor(props: SchematicSymbolProps) {
    if (!props.id || props.id.trim().length === 0) {
      throw new Error("id cannot be empty");
    }
    if (!props.refDes || props.refDes.trim().length === 0) {
      throw new Error("refDes cannot be empty");
    }
    const pageNum = props.sheetNumber ?? props.pageNumber;
    if (pageNum === undefined || !Number.isInteger(pageNum) || pageNum <= 0) {
      throw new Error("pageNumber must be a positive integer");
    }
    if (!props.bounds) {
      throw new Error("bounds is required");
    }

    this.id = props.id.trim();
    this.refDes = props.refDes.trim();
    this.bankDesignator = props.bankDesignator ? props.bankDesignator.trim() : undefined;
    this.pageNumber = pageNum;
    this.bounds = props.bounds;
    this.value = props.value?.trim();
    this.packageFootprint = (props.packageFootprint ?? props.footprint)?.trim();

    if (props.pins) {
      for (const pin of props.pins) {
        this.addPin(pin);
      }
    }
  }

  public get sheetNumber(): number {
    return this.pageNumber;
  }

  public get footprint(): string | undefined {
    return this.packageFootprint;
  }

  public get pins(): ReadonlyArray<SchematicPinLocation> {
    return Object.freeze([...this._pins]);
  }

  public addPin(pin: SchematicPinLocation): void {
    if (this._pins.some((p) => p.pinNumber === pin.pinNumber)) {
      throw new Error(`Duplicate pin ${pin.pinNumber} on symbol ${this.id}`);
    }
    this._pins.push(pin);
  }

  public findPin(pinNumber: string): SchematicPinLocation | undefined {
    const norm = pinNumber.trim();
    return this._pins.find((p) => p.pinNumber === norm);
  }
}
