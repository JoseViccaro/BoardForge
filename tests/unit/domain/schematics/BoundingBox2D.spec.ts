import { describe, it, expect } from "vitest";
import { BoundingBox2D } from "../../../../src/domain/schematics/value-objects/BoundingBox2D.js";

describe("BoundingBox2D Value Object", () => {
  it("should create a valid BoundingBox2D with proper coordinates", () => {
    const box = new BoundingBox2D(10, 20, 50, 60);
    expect(box.minX).toBe(10);
    expect(box.minY).toBe(20);
    expect(box.maxX).toBe(50);
    expect(box.maxY).toBe(60);
    expect(box.width).toBe(40);
    expect(box.height).toBe(40);
    expect(box.area).toBe(1600);
    expect(box.center).toEqual({ x: 30, y: 40 });
  });

  it("should throw error if minX > maxX or minY > maxY", () => {
    expect(() => new BoundingBox2D(50, 20, 10, 60)).toThrow(
      "minX cannot be greater than maxX"
    );
    expect(() => new BoundingBox2D(10, 60, 50, 20)).toThrow(
      "minY cannot be greater than maxY"
    );
  });

  it("should check point containment accurately", () => {
    const box = new BoundingBox2D(10, 20, 50, 60);
    expect(box.containsPoint(30, 40)).toBe(true);
    expect(box.containsPoint(10, 20)).toBe(true); // boundary
    expect(box.containsPoint(50, 60)).toBe(true); // boundary
    expect(box.containsPoint(5, 40)).toBe(false);
    expect(box.containsPoint(30, 70)).toBe(false);
  });

  it("should check intersection with another BoundingBox2D", () => {
    const box1 = new BoundingBox2D(0, 0, 10, 10);
    const box2 = new BoundingBox2D(5, 5, 15, 15);
    const box3 = new BoundingBox2D(20, 20, 30, 30);

    expect(box1.intersects(box2)).toBe(true);
    expect(box2.intersects(box1)).toBe(true);
    expect(box1.intersects(box3)).toBe(false);
    expect(box3.intersects(box1)).toBe(false);
  });

  it("should compute union of two bounding boxes", () => {
    const box1 = new BoundingBox2D(0, 0, 10, 10);
    const box2 = new BoundingBox2D(5, -5, 15, 20);
    const unionBox = box1.union(box2);

    expect(unionBox.minX).toBe(0);
    expect(unionBox.minY).toBe(-5);
    expect(unionBox.maxX).toBe(15);
    expect(unionBox.maxY).toBe(20);
  });

  it("should expand bounding box by margin", () => {
    const box = new BoundingBox2D(10, 10, 20, 20);
    const expanded = box.expand(5);

    expect(expanded.minX).toBe(5);
    expect(expanded.minY).toBe(5);
    expect(expanded.maxX).toBe(25);
    expect(expanded.maxY).toBe(25);
  });

  it("should support equality comparison", () => {
    const box1 = new BoundingBox2D(10, 20, 30, 40);
    const box2 = new BoundingBox2D(10, 20, 30, 40);
    const box3 = new BoundingBox2D(10, 20, 30, 45);

    expect(box1.equals(box2)).toBe(true);
    expect(box1.equals(box3)).toBe(false);
  });
});
