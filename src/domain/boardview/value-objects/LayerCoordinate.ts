import { LayerSide } from "./LayerSide.js";

function roundPrecision(val: number, decimals: number = 4): number {
  const factor = Math.pow(10, decimals);
  return Math.round(val * factor) / factor;
}

export class LayerCoordinate {
  public readonly x: number;
  public readonly y: number;
  public readonly side: LayerSide;
  public readonly zIndex: number;

  constructor(x: number, y: number, side: LayerSide, zIndex: number = 0) {
    if (zIndex < 0 || !Number.isInteger(zIndex)) {
      throw new Error("zIndex must be non-negative integer");
    }
    this.x = roundPrecision(x, 4);
    this.y = roundPrecision(y, 4);
    this.side = side;
    this.zIndex = zIndex;
  }

  public withOffset(dx: number, dy: number): LayerCoordinate {
    return new LayerCoordinate(
      roundPrecision(this.x + dx, 4),
      roundPrecision(this.y + dy, 4),
      this.side,
      this.zIndex
    );
  }

  public withSide(side: LayerSide, boardWidth: number): LayerCoordinate {
    if (this.side === side) {
      return this;
    }
    return new LayerCoordinate(
      roundPrecision(boardWidth - this.x, 4),
      this.y,
      side,
      this.zIndex
    );
  }

  public equals(other?: LayerCoordinate | null): boolean {
    if (!other || !(other instanceof LayerCoordinate)) {
      return false;
    }
    return (
      this.x === other.x &&
      this.y === other.y &&
      this.side === other.side &&
      this.zIndex === other.zIndex
    );
  }
}
