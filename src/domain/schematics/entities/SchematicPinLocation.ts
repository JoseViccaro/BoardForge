import { BoundingBox2D } from "../value-objects/BoundingBox2D.js";

export interface SchematicPinLocationProps {
  id: string;
  refDes: string;
  pinNumber: string;
  pinName?: string;
  pageNumber: number;
  bounds: BoundingBox2D;
  connectionPoint: { x: number; y: number };
  connectedNetName?: string;
}

export class SchematicPinLocation {
  public readonly id: string;
  public readonly refDes: string;
  public readonly pinNumber: string;
  public readonly pinName?: string;
  public readonly pageNumber: number;
  public readonly bounds: BoundingBox2D;
  public readonly connectionPoint: { x: number; y: number };
  public readonly connectedNetName?: string;

  constructor(props: SchematicPinLocationProps) {
    if (!props.id || props.id.trim().length === 0) {
      throw new Error("id cannot be empty");
    }
    if (!props.refDes || props.refDes.trim().length === 0) {
      throw new Error("refDes cannot be empty");
    }
    if (!props.pinNumber || props.pinNumber.trim().length === 0) {
      throw new Error("pinNumber cannot be empty");
    }
    if (!Number.isInteger(props.pageNumber) || props.pageNumber <= 0) {
      throw new Error("pageNumber must be a positive integer");
    }
    if (!props.bounds) {
      throw new Error("bounds is required");
    }
    if (!props.connectionPoint) {
      throw new Error("connectionPoint is required");
    }

    this.id = props.id.trim();
    this.refDes = props.refDes.trim();
    this.pinNumber = props.pinNumber.trim();
    this.pinName = props.pinName ? props.pinName.trim() : undefined;
    this.pageNumber = props.pageNumber;
    this.bounds = props.bounds;
    this.connectionPoint = { ...props.connectionPoint };
    this.connectedNetName = props.connectedNetName ? props.connectedNetName.trim() : undefined;
  }
}
