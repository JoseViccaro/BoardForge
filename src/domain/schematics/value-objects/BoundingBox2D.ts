export class BoundingBox2D {
  public readonly minX: number;
  public readonly minY: number;
  public readonly maxX: number;
  public readonly maxY: number;

  constructor(minX: number, minY: number, maxX: number, maxY: number) {
    if (minX > maxX) {
      throw new Error("minX cannot be greater than maxX");
    }
    if (minY > maxY) {
      throw new Error("minY cannot be greater than maxY");
    }
    this.minX = minX;
    this.minY = minY;
    this.maxX = maxX;
    this.maxY = maxY;
  }

  public get width(): number {
    return this.maxX - this.minX;
  }

  public get height(): number {
    return this.maxY - this.minY;
  }

  public get area(): number {
    return this.width * this.height;
  }

  public get center(): { x: number; y: number } {
    return {
      x: this.minX + this.width / 2,
      y: this.minY + this.height / 2,
    };
  }

  public containsPoint(x: number, y: number): boolean {
    return (
      x >= this.minX &&
      x <= this.maxX &&
      y >= this.minY &&
      y <= this.maxY
    );
  }

  public intersects(other: BoundingBox2D): boolean {
    return (
      this.minX <= other.maxX &&
      this.maxX >= other.minX &&
      this.minY <= other.maxY &&
      this.maxY >= other.minY
    );
  }

  public union(other: BoundingBox2D): BoundingBox2D {
    return new BoundingBox2D(
      Math.min(this.minX, other.minX),
      Math.min(this.minY, other.minY),
      Math.max(this.maxX, other.maxX),
      Math.max(this.maxY, other.maxY)
    );
  }

  public expand(margin: number): BoundingBox2D {
    return new BoundingBox2D(
      this.minX - margin,
      this.minY - margin,
      this.maxX + margin,
      this.maxY + margin
    );
  }

  public equals(other: BoundingBox2D): boolean {
    return (
      this.minX === other.minX &&
      this.minY === other.minY &&
      this.maxX === other.maxX &&
      this.maxY === other.maxY
    );
  }
}
