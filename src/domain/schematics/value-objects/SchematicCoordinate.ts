export class SchematicCoordinate {
  public readonly pageNumber: number;
  public readonly x: number;
  public readonly y: number;

  constructor(pageNumber: number, x: number, y: number) {
    if (!Number.isInteger(pageNumber) || pageNumber <= 0) {
      throw new Error("pageNumber must be a positive integer");
    }
    this.pageNumber = pageNumber;
    this.x = x;
    this.y = y;
  }

  public distanceTo(other: SchematicCoordinate): number {
    if (this.pageNumber !== other.pageNumber) {
      return Infinity;
    }
    const dx = this.x - other.x;
    const dy = this.y - other.y;
    return Math.sqrt(dx * dx + dy * dy);
  }
}
