import { describe, it, expect, beforeEach } from "vitest";
import { IngestSchematicUseCase } from "../../../../src/application/schematics/commands/IngestSchematicUseCase.js";
import { CrossProbeLookupUseCase } from "../../../../src/application/schematics/queries/CrossProbeLookupUseCase.js";
import { SchematicsFacade } from "../../../../src/application/schematics/SchematicsFacade.js";
import { SchematicParserFactory } from "../../../../src/infrastructure/schematics/parsers/SchematicParserFactory.js";
import { SchematicCrossProbeIndex } from "../../../../src/application/schematics/services/SchematicCrossProbeIndex.js";
import { UnsupportedFormatError } from "../../../../src/infrastructure/schematics/parsers/VectorPdfSchematicParser.js";

function createValidPdfBytes(): Uint8Array {
  const encoder = new TextEncoder();
  return encoder.encode(`%PDF-1.7
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >>
endobj
4 0 obj
<< /Length 120 >>
stream
BT
/F1 12 Tf
100 200 Td
(U2700) Tj
100 220 Td
(A1) Tj
100 240 Td
(PP_VDD_MAIN) Tj
ET
endstream
endobj
xref
0 5
trailer
<< /Size 5 /Root 1 0 R >>
startxref
350
%%EOF`);
}

describe("IngestSchematicUseCase & CrossProbeLookupUseCase", () => {
  let parserFactory: SchematicParserFactory;
  let crossProbeIndex: SchematicCrossProbeIndex;
  let ingestUseCase: IngestSchematicUseCase;
  let lookupUseCase: CrossProbeLookupUseCase;
  let facade: SchematicsFacade;

  beforeEach(() => {
    parserFactory = new SchematicParserFactory();
    crossProbeIndex = new SchematicCrossProbeIndex();
    ingestUseCase = new IngestSchematicUseCase(parserFactory, crossProbeIndex);
    lookupUseCase = new CrossProbeLookupUseCase(crossProbeIndex);
    facade = new SchematicsFacade(ingestUseCase, lookupUseCase, crossProbeIndex);
  });

  describe("IngestSchematicUseCase", () => {
    it("should parse, index, and return IngestSchematicResultDto on valid PDF input", async () => {
      const pdfBytes = createValidPdfBytes();
      const result = await ingestUseCase.execute({
        documentId: "IPHONE_13_LOGIC",
        filename: "iphone13_logic.pdf",
        rawBytes: pdfBytes,
        organizationId: "org_apple",
      });

      expect(result.documentId).toBe("IPHONE_13_LOGIC");
      expect(result.pageCount).toBeGreaterThanOrEqual(1);
      expect(result.symbolCount).toBeGreaterThanOrEqual(1);
      expect(result.diagnostics).toEqual([]);

      // Verify cross-probe lookup works immediately
      const pinHits = lookupUseCase.lookupByPin("U2700", "A1");
      expect(pinHits).toBeDefined();
    });

    it("should throw UnsupportedFormatError for invalid magic byte files", async () => {
      const invalidBytes = new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x00, 0x00]);
      await expect(
        ingestUseCase.execute({
          documentId: "DOC_INVALID",
          filename: "image.png",
          rawBytes: invalidBytes,
        })
      ).rejects.toThrow(UnsupportedFormatError);
    });
  });

  describe("CrossProbeLookupUseCase", () => {
    beforeEach(async () => {
      await ingestUseCase.execute({
        documentId: "IPHONE_13_LOGIC",
        filename: "iphone13_logic.pdf",
        rawBytes: createValidPdfBytes(),
      });
    });

    it("should resolve pin lookups via CrossProbeLookupUseCase", () => {
      const hits = lookupUseCase.lookupByPin("U2700", "A1");
      expect(hits.length).toBeGreaterThanOrEqual(1);
      expect(hits[0].refDes).toBe("U2700");
    });

    it("should resolve net lookups via CrossProbeLookupUseCase", () => {
      const netHits = lookupUseCase.lookupByNet("PP_VDD_MAIN");
      expect(netHits.length).toBeGreaterThanOrEqual(1);
    });

    it("should resolve coordinate lookups via CrossProbeLookupUseCase", () => {
      const res = lookupUseCase.lookupByCoordinate(1, 100, 200);
      expect(res.tokens.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("SchematicsFacade Integration", () => {
    it("should ingest schematic and provide cross-probing and document queries", async () => {
      const result = await facade.ingestSchematic({
        documentId: "IPHONE_13_FACADE",
        filename: "iphone13.pdf",
        rawBytes: createValidPdfBytes(),
      });

      expect(result.documentId).toBe("IPHONE_13_FACADE");

      const pinHits = facade.lookupPin("U2700", "A1");
      expect(pinHits).toBeDefined();

      const page = await facade.getPage("IPHONE_13_FACADE", 1);
      expect(page.schematicId).toBe("IPHONE_13_FACADE");
      expect(page.symbols.length).toBeGreaterThanOrEqual(1);
    });
  });
});
