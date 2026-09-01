import { describe, it, expect, beforeEach } from "vitest";
import {
  VectorPdfSchematicParser,
  UnsupportedFormatError,
  CorruptedStreamError,
} from "../../../../src/infrastructure/schematics/parsers/VectorPdfSchematicParser.js";
import { SchematicParserFactory } from "../../../../src/infrastructure/schematics/parsers/SchematicParserFactory.js";
import { DiagnosticSeverity } from "../../../../src/domain/schematics/ports/ISchematicParser.js";

function createPdfBuffer(content: string = ""): Uint8Array {
  const encoder = new TextEncoder();
  const header = "%PDF-1.7\n";
  const body = content || `
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
0000000000 65535 f 
0000000010 00000 n 
0000000060 00000 n 
0000000115 00000 n 
0000000200 00000 n 
trailer
<< /Size 5 /Root 1 0 R >>
startxref
350
%%EOF
`;
  return encoder.encode(header + body);
}

describe("VectorPdfSchematicParser & SchematicParserFactory", () => {
  let parser: VectorPdfSchematicParser;
  let factory: SchematicParserFactory;

  beforeEach(() => {
    parser = new VectorPdfSchematicParser();
    factory = new SchematicParserFactory();
  });

  describe("Header Sniffing & Factory", () => {
    it("should detect %PDF- magic header and return VectorPdfSchematicParser", () => {
      const pdfBytes = createPdfBuffer();
      expect(parser.canParse(pdfBytes)).toBe(true);

      const detected = factory.detectParser(pdfBytes, "schematic.pdf");
      expect(detected).toBeInstanceOf(VectorPdfSchematicParser);
    });

    it("should reject unrecognized magic headers with UnsupportedFormatError", () => {
      // PNG header: 0x89 0x50 0x4E 0x47
      const pngBytes = new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
      expect(parser.canParse(pngBytes)).toBe(false);
      expect(() => factory.detectParser(pngBytes, "image.png")).toThrow(UnsupportedFormatError);
    });

    it("should reject empty buffer with EMPTY_INPUT ParseError without throwing", async () => {
      const emptyBytes = new Uint8Array(0);
      const result = await parser.parse(emptyBytes);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("EMPTY_INPUT");
      }
    });
  });

  describe("Token Extraction & Document Assembly", () => {
    it("should parse vector PDF stream and extract symbols, pins, and nets", async () => {
      const pdfBytes = createPdfBuffer();
      const result = await parser.parse(pdfBytes, {
        sourceFilename: "iPhone13_Logic.pdf",
        boardModel: "iPhone13",
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const doc = result.document;
      expect(doc.documentId).toBe("iPhone13");
      expect(doc.title).toBe("iPhone13_Logic.pdf");
      expect(doc.sheets.size).toBeGreaterThanOrEqual(1);

      const sheet1 = doc.getSheet(1);
      expect(sheet1).toBeDefined();
      expect(sheet1!.tokens.length).toBeGreaterThan(0);

      // Verify tokens contain U2700 and PP_VDD_MAIN
      const tokenTexts = sheet1!.tokens.map((t) => t.text);
      expect(tokenTexts).toContain("U2700");
      expect(tokenTexts).toContain("PP_VDD_MAIN");

      // Verify symbols were extracted
      const u2700 = doc.getSymbol("U2700");
      expect(u2700).toBeDefined();
    });
  });

  describe("Error Handling & Corrupted Stream Recovery", () => {
    it("should return CORRUPTED_STREAM error for truncated / corrupted PDF stream", async () => {
      const truncatedPdf = new TextEncoder().encode("%PDF-1.7\n<< /Type /Catalog ... corrupted stream truncation");
      const result = await parser.parse(truncatedPdf, undefined, { resilient: false });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("CORRUPTED_STREAM");
      }
    });

    it("should recover valid sheets in resilient mode and emit ParseDiagnostic warnings for corrupted sheets", async () => {
      const multiPagePdfWithCorruptedPage2 = new TextEncoder().encode(`%PDF-1.7
---PAGE 1---
BT
100 100 Td
(U2700) Tj
100 110 Td
(PP_VDD_MAIN) Tj
ET
---PAGE 2 CORRUPTED---
INVALID_BYTECODE_STREAM_ERR_0x999
---PAGE 3---
BT
200 200 Td
(R101) Tj
200 210 Td
(GND) Tj
ET
%%EOF`);

      const result = await parser.parse(multiPagePdfWithCorruptedPage2, { boardModel: "IPHONE13" }, { resilient: true });

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.document.sheets.size).toBe(2);
      expect(result.document.getSheet(1)).toBeDefined();
      expect(result.document.getSheet(3)).toBeDefined();
      expect(result.document.getSheet(2)).toBeUndefined();

      // Diagnostic warning emitted for corrupted sheet 2
      const warning = result.diagnostics.find((d) => d.severity === DiagnosticSeverity.WARNING);
      expect(warning).toBeDefined();
      expect(warning?.code).toBe("SHEET_PARSE_WARNING");
      expect(warning?.context?.pageNumber).toBe(2);
    });
  });
});
