import { describe, it, expect } from "vitest";
import type {
  ISchematicParser,
  ParseSchematicMeta,
  ParseSchematicResult,
} from "../../../src/domain/schematics/ports/ISchematicParser.js";
import { ParseError } from "../../../src/domain/schematics/ports/ISchematicParser.js";
import { SchematicDocument } from "../../../src/domain/schematics/aggregates/SchematicDocument.js";

/**
 * A minimal in-test implementation of the ISchematicParser port that mirrors
 * the R2.15 contract: non-empty bytes produce a SchematicDocument; empty bytes
 * return a structured EMPTY_INPUT error (via the production ParseError) and
 * never throw.
 */
class ContractParser implements ISchematicParser {
  public async parse(
    rawBytes: Uint8Array,
    meta?: ParseSchematicMeta
  ): Promise<ParseSchematicResult> {
    if (rawBytes.length === 0) {
      return {
        ok: false,
        error: new ParseError("EMPTY_INPUT", "Schematic input is empty"),
        diagnostics: [
          { severity: "ERROR", code: "EMPTY_INPUT", message: "Schematic input is empty" },
        ],
      };
    }
    const doc = new SchematicDocument({
      documentId: meta?.boardModel ?? "SCH_UNTITLED",
      title: meta?.sourceFilename ?? "Untitled schematic",
      pageCount: 1,
    });
    return {
      ok: true,
      document: doc,
      diagnostics: [],
    };
  }
}

describe("ISchematicParser port (R2.15)", () => {
  // Scenario: Port accepts raw bytes and returns document
  it("accepts a non-empty Uint8Array plus metadata and returns a SchematicDocument", async () => {
    const parser = new ContractParser();
    const bytes = new Uint8Array([0x50, 0x44, 0x46, 0x2d]); // %PDF-
    const meta: ParseSchematicMeta = { sourceFilename: "iphone13_top.pdf", boardModel: "iPhone13" };

    const result = await parser.parse(bytes, meta);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.document).toBeInstanceOf(SchematicDocument);
    expect(result.document.documentId).toBe("iPhone13");
    expect(result.document.title).toBe("iphone13_top.pdf");
  });

  // Scenario: Port rejects invalid input (empty) -> EMPTY_INPUT error, no throw
  it("returns an EMPTY_INPUT error for empty bytes and does not throw", async () => {
    const parser = new ContractParser();
    const empty = new Uint8Array(0);

    let result: ParseSchematicResult | undefined;
    await expect(
      (async () => {
        result = await parser.parse(empty, { boardModel: "iPhone13" });
      })()
    ).resolves.toBeUndefined();

    expect(result).toBeDefined();
    expect(result!.ok).toBe(false);
    if (result!.ok) {
      return;
    }
    expect(result!.error).toBeInstanceOf(ParseError);
    expect(result!.error.code).toBe("EMPTY_INPUT");
  });
});
