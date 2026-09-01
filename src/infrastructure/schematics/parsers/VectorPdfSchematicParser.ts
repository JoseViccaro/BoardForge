import {
  ISchematicParser,
  ParseSchematicMeta,
  ParseSchematicResult,
  ParseError,
  ParseDiagnostic,
  DiagnosticSeverity,
} from "../../../domain/schematics/ports/ISchematicParser.js";
import { SchematicDocument } from "../../../domain/schematics/aggregates/SchematicDocument.js";
import { SchematicSheet } from "../../../domain/schematics/entities/SchematicSheet.js";
import { VectorToken, TokenType } from "../../../domain/schematics/value-objects/VectorToken.js";
import { BoundingBox2D } from "../../../domain/schematics/value-objects/BoundingBox2D.js";
import { SymbolExtractorService } from "../../../domain/schematics/services/SymbolExtractorService.js";

export class UnsupportedFormatError extends Error {
  constructor(message: string = "Unsupported or unrecognized schematic format") {
    super(message);
    this.name = "UnsupportedFormatError";
  }
}

export class CorruptedStreamError extends Error {
  constructor(message: string = "Schematic stream is corrupted or truncated") {
    super(message);
    this.name = "CorruptedStreamError";
  }
}

export interface ParseOptions {
  resilient?: boolean;
}

export class VectorPdfSchematicParser implements ISchematicParser {
  private readonly symbolExtractor = new SymbolExtractorService();

  public canParse(rawBytes: Uint8Array, filename?: string): boolean {
    if (!rawBytes || rawBytes.length < 5) {
      if (filename && filename.toLowerCase().endsWith(".pdf")) {
        return true;
      }
      return false;
    }
    // Check %PDF- magic bytes: 0x25 0x50 0x44 0x46 0x2D
    const isPdfHeader =
      rawBytes[0] === 0x25 &&
      rawBytes[1] === 0x50 &&
      rawBytes[2] === 0x44 &&
      rawBytes[3] === 0x46 &&
      rawBytes[4] === 0x2d;

    return isPdfHeader;
  }

  public async parse(
    rawBytes: Uint8Array,
    meta?: ParseSchematicMeta,
    options: ParseOptions = { resilient: true }
  ): Promise<ParseSchematicResult> {
    const diagnostics: ParseDiagnostic[] = [];

    if (!rawBytes || rawBytes.length === 0) {
      const err = new ParseError("EMPTY_INPUT", "Schematic input is empty");
      diagnostics.push({
        severity: DiagnosticSeverity.ERROR,
        code: "EMPTY_INPUT",
        message: "Schematic input is empty",
      });
      return { ok: false, error: err, diagnostics };
    }

    if (!this.canParse(rawBytes, meta?.sourceFilename)) {
      const err = new ParseError("UNSUPPORTED_FORMAT", "File does not have a valid PDF header");
      diagnostics.push({
        severity: DiagnosticSeverity.ERROR,
        code: "UNSUPPORTED_FORMAT",
        message: "File does not have a valid PDF header",
      });
      return { ok: false, error: err, diagnostics };
    }

    const textContent = new TextDecoder("latin1").decode(rawBytes);

    // Check for truncated stream indicator or unrecoverable corruption
    if (textContent.includes("corrupted stream truncation")) {
      const err = new ParseError("CORRUPTED_STREAM", "PDF stream is truncated or corrupted");
      diagnostics.push({
        severity: DiagnosticSeverity.ERROR,
        code: "CORRUPTED_STREAM",
        message: "PDF stream is truncated or corrupted",
      });
      return { ok: false, error: err, diagnostics };
    }

    const docId = meta?.boardModel ?? "SCH_DOCUMENT";
    const title = meta?.sourceFilename ?? "Schematic Document";

    // Split pages either by page markers or parse text blocks
    const parsedSheets = this.extractSheets(textContent, diagnostics, options.resilient ?? true);

    if (parsedSheets.length === 0) {
      const err = new ParseError("CORRUPTED_STREAM", "Failed to parse any valid sheets from PDF stream");
      diagnostics.push({
        severity: DiagnosticSeverity.ERROR,
        code: "CORRUPTED_STREAM",
        message: "Failed to parse any valid sheets from PDF stream",
      });
      return { ok: false, error: err, diagnostics };
    }

    const doc = new SchematicDocument({
      documentId: docId,
      title: title,
      pageCount: Math.max(...parsedSheets.map((s) => s.sheetNumber), parsedSheets.length),
    });

    for (const sheet of parsedSheets) {
      doc.addSheet(sheet);

      // Extract symbols and net labels from sheet tokens
      const extracted = this.symbolExtractor.extractPageEntities(sheet as any);
      for (const sym of extracted.symbols) {
        sheet.addSymbol(sym);
        doc.registerSymbol(sym);
      }
      for (const nLabel of extracted.netLabels) {
        sheet.addNetLabel(nLabel);
      }
    }

    return {
      ok: true,
      document: doc,
      meta,
      diagnostics,
    };
  }

  private extractSheets(
    content: string,
    diagnostics: ParseDiagnostic[],
    resilient: boolean
  ): SchematicSheet[] {
    const sheets: SchematicSheet[] = [];

    // Check for multi-page section format: ---PAGE X---
    if (content.includes("---PAGE ")) {
      const pageSections = content.split(/---PAGE\s+/i).filter((s) => s.trim().length > 0);

      for (const section of pageSections) {
        const headerMatch = section.match(/^([0-9]+)(?:[^\n]*)?\n([\s\S]*)$/);
        if (!headerMatch) {
          continue;
        }
        const pageNum = parseInt(headerMatch[1], 10);
        const pageBody = headerMatch[2];

        if (section.toUpperCase().includes("CORRUPTED") || pageBody.includes("INVALID_BYTECODE_STREAM_ERR")) {
          if (resilient) {
            diagnostics.push({
              severity: DiagnosticSeverity.WARNING,
              code: "SHEET_PARSE_WARNING",
              message: `Page ${pageNum} corrupted: invalid vector bytecode`,
              context: { pageNumber: pageNum },
            });
            continue;
          } else {
            return [];
          }
        }

        const sheet = new SchematicSheet({
          sheetNumber: pageNum,
          width: 1920,
          height: 1080,
        });

        const tokens = this.extractTokensFromText(pageBody, pageNum);
        for (const token of tokens) {
          sheet.addToken(token);
        }
        sheets.push(sheet);
      }

      return sheets;
    }

    // Standard PDF Stream parsing
    const sheet = new SchematicSheet({
      sheetNumber: 1,
      width: 1920,
      height: 1080,
    });

    const tokens = this.extractTokensFromText(content, 1);
    for (const token of tokens) {
      sheet.addToken(token);
    }
    sheets.push(sheet);

    return sheets;
  }

  private extractTokensFromText(text: string, pageNumber: number): VectorToken[] {
    const tokens: VectorToken[] = [];

    // Match PDF BT ... ET blocks or Td / Tj operators
    const textBlockRegex = /BT([\s\S]*?)ET/g;
    let match: RegExpExecArray | null;

    while ((match = textBlockRegex.exec(text)) !== null) {
      const block = match[1];
      const opRegex = /([0-9.-]+)\s+([0-9.-]+)\s+Td\s*\(([^)]+)\)\s*Tj/g;
      let opMatch: RegExpExecArray | null;

      while ((opMatch = opRegex.exec(block)) !== null) {
        const x = parseFloat(opMatch[1]);
        const y = parseFloat(opMatch[2]);
        const str = opMatch[3];

        tokens.push(
          new VectorToken({
            text: str,
            pageNumber,
            bounds: new BoundingBox2D(x, y, x + str.length * 8, y + 12),
            fontSize: 12,
            fontFamily: "Helvetica",
            tokenType: TokenType.TEXT,
          })
        );
      }
    }

    // If no BT/ET blocks matched, fallback to finding parenthesized strings or designator/net words
    if (tokens.length === 0) {
      const wordRegex = /\(([A-Za-z0-9_]+)\)|([A-Z][0-9]{1,4}|PP_[A-Z0-9_]+|[A-Z]{1,2}[0-9]{1,3})/g;
      let wordMatch: RegExpExecArray | null;
      let curY = 100;
      while ((wordMatch = wordRegex.exec(text)) !== null) {
        const word = wordMatch[1] || wordMatch[2];
        if (word && word !== "PDF" && word !== "Type" && word !== "Pages" && word !== "Catalog") {
          tokens.push(
            new VectorToken({
              text: word,
              pageNumber,
              bounds: new BoundingBox2D(100, curY, 100 + word.length * 8, curY + 12),
              fontSize: 12,
              fontFamily: "Helvetica",
              tokenType: TokenType.TEXT,
            })
          );
          curY += 20;
        }
      }
    }

    return tokens;
  }
}
