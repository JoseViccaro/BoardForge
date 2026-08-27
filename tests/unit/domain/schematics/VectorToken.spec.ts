import { describe, it, expect } from "vitest";
import { BoundingBox2D } from "../../../../src/domain/schematics/value-objects/BoundingBox2D.js";
import { SchematicCoordinate } from "../../../../src/domain/schematics/value-objects/SchematicCoordinate.js";
import { VectorToken, TokenType } from "../../../../src/domain/schematics/value-objects/VectorToken.js";
import { SymbolPinRef } from "../../../../src/domain/schematics/value-objects/SymbolPinRef.js";
import { NetLabelMatch } from "../../../../src/domain/schematics/value-objects/NetLabelMatch.js";

describe("VectorToken & Spatial Value Objects", () => {
  describe("SchematicCoordinate", () => {
    it("should instantiate with page number and coordinates", () => {
      const coord = new SchematicCoordinate(12, 100.5, 200.5);
      expect(coord.pageNumber).toBe(12);
      expect(coord.x).toBe(100.5);
      expect(coord.y).toBe(200.5);
    });

    it("should reject invalid page numbers", () => {
      expect(() => new SchematicCoordinate(0, 10, 20)).toThrow("pageNumber must be a positive integer");
      expect(() => new SchematicCoordinate(-1, 10, 20)).toThrow("pageNumber must be a positive integer");
    });

    it("should compute distance to another coordinate on same page", () => {
      const c1 = new SchematicCoordinate(1, 0, 0);
      const c2 = new SchematicCoordinate(1, 3, 4);
      expect(c1.distanceTo(c2)).toBe(5);
    });

    it("should return Infinity for distance across different pages", () => {
      const c1 = new SchematicCoordinate(1, 0, 0);
      const c2 = new SchematicCoordinate(2, 3, 4);
      expect(c1.distanceTo(c2)).toBe(Infinity);
    });
  });

  describe("VectorToken", () => {
    it("should create a valid VectorToken", () => {
      const box = new BoundingBox2D(100, 200, 150, 220);
      const token = new VectorToken({
        text: "U2700",
        pageNumber: 12,
        bounds: box,
        fontSize: 10,
        fontFamily: "Helvetica",
        rotation: 0,
        tokenType: TokenType.DESIGNATOR,
      });

      expect(token.text).toBe("U2700");
      expect(token.pageNumber).toBe(12);
      expect(token.bounds).toEqual(box);
      expect(token.fontSize).toBe(10);
      expect(token.fontFamily).toBe("Helvetica");
      expect(token.rotation).toBe(0);
      expect(token.tokenType).toBe(TokenType.DESIGNATOR);
    });

    it("should require non-empty text and positive page number", () => {
      const box = new BoundingBox2D(0, 0, 10, 10);
      expect(() => new VectorToken({
        text: "",
        pageNumber: 1,
        bounds: box,
        fontSize: 8,
      })).toThrow("text cannot be empty");

      expect(() => new VectorToken({
        text: "test",
        pageNumber: 0,
        bounds: box,
        fontSize: 8,
      })).toThrow("pageNumber must be a positive integer");
    });
  });

  describe("SymbolPinRef", () => {
    it("should create SymbolPinRef with normalized fields", () => {
      const pinRef = new SymbolPinRef(" U2700 ", " A12 ", " PP_VDD_MAIN ");
      expect(pinRef.refDes).toBe("U2700");
      expect(pinRef.pinNumber).toBe("A12");
      expect(pinRef.pinName).toBe("PP_VDD_MAIN");
      expect(pinRef.key).toBe("U2700.A12");
    });

    it("should validate non-empty refDes and pinNumber", () => {
      expect(() => new SymbolPinRef("", "1")).toThrow("refDes cannot be empty");
      expect(() => new SymbolPinRef("U1", "")).toThrow("pinNumber cannot be empty");
    });
  });

  describe("NetLabelMatch", () => {
    it("should create NetLabelMatch", () => {
      const box = new BoundingBox2D(50, 50, 100, 60);
      const match = new NetLabelMatch({
        netName: "PP_VDD_MAIN",
        pageNumber: 12,
        bounds: box,
        rotation: 90,
      });

      expect(match.netName).toBe("PP_VDD_MAIN");
      expect(match.pageNumber).toBe(12);
      expect(match.bounds).toEqual(box);
      expect(match.rotation).toBe(90);
    });

    it("should validate non-empty netName", () => {
      const box = new BoundingBox2D(0, 0, 10, 10);
      expect(() => new NetLabelMatch({
        netName: "",
        pageNumber: 1,
        bounds: box,
      })).toThrow("netName cannot be empty");
    });
  });
});
