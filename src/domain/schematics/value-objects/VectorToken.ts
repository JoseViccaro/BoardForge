import { BoundingBox2D } from "./BoundingBox2D.js";

export enum TokenType {
  TEXT = "TEXT",
  DESIGNATOR = "DESIGNATOR",
  PIN_NUM = "PIN_NUM",
  PIN_NAME = "PIN_NAME",
  NET_LABEL = "NET_LABEL",
}

export interface VectorTokenProps {
  text: string;
  pageNumber: number;
  bounds: BoundingBox2D;
  fontSize: number;
  fontFamily?: string;
  rotation?: number;
  tokenType?: TokenType | string;
}

export class VectorToken {
  public readonly text: string;
  public readonly pageNumber: number;
  public readonly bounds: BoundingBox2D;
  public readonly fontSize: number;
  public readonly fontFamily?: string;
  public readonly rotation: number;
  public readonly tokenType: TokenType;

  constructor(props: VectorTokenProps) {
    if (!props.text || props.text.trim().length === 0) {
      throw new Error("text cannot be empty");
    }
    if (!Number.isInteger(props.pageNumber) || props.pageNumber <= 0) {
      throw new Error("pageNumber must be a positive integer");
    }
    if (!props.bounds) {
      throw new Error("bounds is required");
    }

    this.text = props.text.trim();
    this.pageNumber = props.pageNumber;
    this.bounds = props.bounds;
    this.fontSize = props.fontSize;
    this.fontFamily = props.fontFamily;
    this.rotation = props.rotation ?? 0;
    this.tokenType = (props.tokenType as TokenType) ?? TokenType.TEXT;
  }
}
