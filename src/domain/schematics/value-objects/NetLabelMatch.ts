import { BoundingBox2D } from "./BoundingBox2D.js";

export interface NetLabelMatchProps {
  netName: string;
  pageNumber: number;
  bounds: BoundingBox2D;
  rotation?: number;
}

export class NetLabelMatch {
  public readonly netName: string;
  public readonly pageNumber: number;
  public readonly bounds: BoundingBox2D;
  public readonly rotation: number;

  constructor(props: NetLabelMatchProps) {
    if (!props.netName || props.netName.trim().length === 0) {
      throw new Error("netName cannot be empty");
    }
    if (!Number.isInteger(props.pageNumber) || props.pageNumber <= 0) {
      throw new Error("pageNumber must be a positive integer");
    }
    if (!props.bounds) {
      throw new Error("bounds is required");
    }

    this.netName = props.netName.trim();
    this.pageNumber = props.pageNumber;
    this.bounds = props.bounds;
    this.rotation = props.rotation ?? 0;
  }
}
