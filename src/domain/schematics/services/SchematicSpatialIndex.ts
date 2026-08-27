import { BoundingBox2D } from "../value-objects/BoundingBox2D.js";

interface SpatialEntry<T> {
  bounds: BoundingBox2D;
  item: T;
}

export class SchematicSpatialIndex<T> {
  private entries: SpatialEntry<T>[] = [];

  public insert(bounds: BoundingBox2D, item: T): void {
    this.entries.push({ bounds, item });
  }

  public queryPoint(x: number, y: number): T[] {
    const hits: T[] = [];
    for (const entry of this.entries) {
      if (entry.bounds.containsPoint(x, y)) {
        hits.push(entry.item);
      }
    }
    return hits;
  }

  public queryBox(box: BoundingBox2D): T[] {
    const hits: T[] = [];
    for (const entry of this.entries) {
      if (entry.bounds.intersects(box)) {
        hits.push(entry.item);
      }
    }
    return hits;
  }

  public findNearest(x: number, y: number, maxRadius: number): T | undefined {
    let nearestItem: T | undefined = undefined;
    let minDistance = maxRadius;

    for (const entry of this.entries) {
      const center = entry.bounds.center;
      const dx = center.x - x;
      const dy = center.y - y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist <= minDistance) {
        minDistance = dist;
        nearestItem = entry.item;
      }
    }

    return nearestItem;
  }

  public all(): T[] {
    return this.entries.map((e) => e.item);
  }

  public get count(): number {
    return this.entries.length;
  }

  public clear(): void {
    this.entries = [];
  }
}
