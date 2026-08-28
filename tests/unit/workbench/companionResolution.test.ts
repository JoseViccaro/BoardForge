import { describe, it, expect } from "vitest";
import { resolveCompanion } from "../../../src/application/workbench/WorkbenchFacade.js";

describe("companion resolution (boardModel, boardRevision) -> CompanionResolution", () => {
  it("resolves the iPhone13 logic board companion by model + revision", () => {
    const result = resolveCompanion("iPhone13", "820-02106");

    expect(result.diagnostic).toBe("OK");
    expect(result.schematicId).toBe("DOC_IPHONE13_820_02106");
  });

  it("resolves the known spec pair iPhone13/REV1 deterministically", () => {
    const result = resolveCompanion("iPhone13", "REV1");

    expect(result.diagnostic).toBe("OK");
    expect(result.schematicId).toBe("DOC_IPHONE13_820_02106");
  });

  it("is deterministic for the same inputs", () => {
    expect(resolveCompanion("iPhone13", "820-02106")).toEqual(
      resolveCompanion("iPhone13", "820-02106")
    );
  });

  it("returns NO_COMPANION for an unknown board model", () => {
    const result = resolveCompanion("iPhone14", "820-02106");

    expect(result.diagnostic).toBe("NO_COMPANION");
    expect(result.schematicId).toBeUndefined();
  });

  it("returns NO_COMPANION when the revision is missing", () => {
    const result = resolveCompanion("iPhone13", "");

    expect(result.diagnostic).toBe("NO_COMPANION");
    expect(result.schematicId).toBeUndefined();
  });

  it("matches case-insensitively", () => {
    expect(resolveCompanion("iphone13", "820-02106").diagnostic).toBe("OK");
  });
});