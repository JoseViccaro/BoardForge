import { describe, it, expect } from "vitest";
import { BoardId } from "../../../src/domain/catalog/value-objects/BoardId.js";

describe("BoardId (Domain VO)", () => {
  it("should create BoardId and enforce non-empty value", () => {
    const id = new BoardId("BRD_820_02106");
    expect(id.value).toBe("BRD_820_02106");
    expect(() => new BoardId("")).toThrow();
  });
});
