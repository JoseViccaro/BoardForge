import { BoardViewFormat, DiagnosticSeverity, ParseDiagnostic } from "../value-objects/BoardViewFormat.js";

export type SniffConfidence = "EXACT_MAGIC" | "EXTENSION_HEURISTIC" | "UNKNOWN";

export interface FormatDetectionResult {
  format: BoardViewFormat;
  confidence: SniffConfidence;
  diagnostic?: ParseDiagnostic;
}

export class BoardViewFormatSniffer {
  private static readonly ZIP_MAGIC = new Uint8Array([0x50, 0x4B, 0x03, 0x04]);

  public sniff(buffer: Uint8Array, filename?: string): FormatDetectionResult {
    if (!buffer || buffer.byteLength === 0) {
      return {
        format: BoardViewFormat.UNKNOWN,
        confidence: "UNKNOWN",
        diagnostic: {
          severity: DiagnosticSeverity.ERROR,
          code: "UNRECOGNIZED_FORMAT_SIGNATURE",
          message: "Empty payload provided for format sniffing."
        }
      };
    }

    // 1. Check Landrex BRD magic: "BRD2" or "PCB_CAD_DATABASE"
    const leadingSnippet = new TextDecoder("latin1").decode(buffer.subarray(0, Math.min(buffer.byteLength, 1024)));
    if (leadingSnippet.startsWith("BRD2") || leadingSnippet.includes("PCB_CAD_DATABASE")) {
      return {
        format: BoardViewFormat.LANDREX_BRD,
        confidence: "EXACT_MAGIC"
      };
    }

    // 2. Check GenCAD 1.4: $HEADER or $GENCAD within first 1024 bytes
    if (/\$(HEADER|GENCAD)/i.test(leadingSnippet)) {
      return {
        format: BoardViewFormat.GENCAD,
        confidence: "EXACT_MAGIC"
      };
    }

    // 3. Check FZZ / Zip: PK\x03\x04 or Fritzing XML
    if (buffer.length >= 4 &&
        buffer[0] === BoardViewFormatSniffer.ZIP_MAGIC[0] &&
        buffer[1] === BoardViewFormatSniffer.ZIP_MAGIC[1] &&
        buffer[2] === BoardViewFormatSniffer.ZIP_MAGIC[2] &&
        buffer[3] === BoardViewFormatSniffer.ZIP_MAGIC[3]) {
      return {
        format: BoardViewFormat.FZZ,
        confidence: "EXACT_MAGIC"
      };
    }
    if (leadingSnippet.includes("<module") || leadingSnippet.includes("<fritzing") || (filename && filename.endsWith(".fz"))) {
      return {
        format: BoardViewFormat.FZZ,
        confidence: "EXACT_MAGIC"
      };
    }

    // 4. Check BDV: #FORMAT: BDV or section headers (#PINS, #COMPONENTS, #NETS)
    if (leadingSnippet.includes("#FORMAT: BDV") ||
        (leadingSnippet.includes("#COMPONENTS") && leadingSnippet.includes("#NETS")) ||
        (leadingSnippet.includes("#PINS") && leadingSnippet.includes("#COMPONENTS"))) {
      return {
        format: BoardViewFormat.BDV,
        confidence: "EXACT_MAGIC"
      };
    }

    // 5. Check TopView: TVW_ or TOPVIEW signature
    if (leadingSnippet.startsWith("TVW_") || leadingSnippet.includes("TOPVIEW")) {
      return {
        format: BoardViewFormat.TOPVIEW,
        confidence: "EXACT_MAGIC"
      };
    }

    // Check extension heuristic fallback if provided
    if (filename) {
      const lower = filename.toLowerCase();
      if (lower.endsWith(".brd")) {
        return { format: BoardViewFormat.LANDREX_BRD, confidence: "EXTENSION_HEURISTIC" };
      }
      if (lower.endsWith(".cad")) {
        return { format: BoardViewFormat.GENCAD, confidence: "EXTENSION_HEURISTIC" };
      }
      if (lower.endsWith(".fzz") || lower.endsWith(".fz")) {
        return { format: BoardViewFormat.FZZ, confidence: "EXTENSION_HEURISTIC" };
      }
      if (lower.endsWith(".bdv")) {
        return { format: BoardViewFormat.BDV, confidence: "EXTENSION_HEURISTIC" };
      }
      if (lower.endsWith(".tvw")) {
        return { format: BoardViewFormat.TOPVIEW, confidence: "EXTENSION_HEURISTIC" };
      }
    }

    return {
      format: BoardViewFormat.UNKNOWN,
      confidence: "UNKNOWN",
      diagnostic: {
        severity: DiagnosticSeverity.WARNING,
        code: "UNRECOGNIZED_FORMAT_SIGNATURE",
        message: `File header does not match any known BoardView signature (evaluated ${buffer.byteLength} bytes).`
      }
    };
  }
}
