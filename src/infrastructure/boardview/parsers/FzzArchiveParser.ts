import { IBoardViewParser, ParseOptions, ParsedBoardViewResult } from "../../../domain/boardview/ports/IBoardViewParser.js";
import { BoardViewFormat, DiagnosticSeverity, ParseDiagnostic } from "../../../domain/boardview/value-objects/BoardViewFormat.js";
import { RawBoardViewDocument, RawComponent, RawPin, RawPoint } from "../../../domain/boardview/intermediate/RawBoardViewDocument.js";
import { LayerSide } from "../../../domain/boardview/value-objects/LayerSide.js";
import { SafeZipExtractor, ZipBombError } from "../io/SafeZipExtractor.js";

export class FzzArchiveParser implements IBoardViewParser {
  public readonly supportedFormat = BoardViewFormat.FZZ;

  public canParse(headerBytes: Uint8Array, filename?: string): boolean {
    if (headerBytes.length >= 4 && headerBytes[0] === 0x50 && headerBytes[1] === 0x4B && headerBytes[2] === 0x03 && headerBytes[3] === 0x04) {
      return true;
    }
    const text = new TextDecoder("latin1").decode(headerBytes.subarray(0, Math.min(headerBytes.byteLength, 512)));
    if (text.includes("<module") || text.includes("<fritzing")) return true;
    if (filename && (filename.toLowerCase().endsWith(".fzz") || filename.toLowerCase().endsWith(".fz"))) return true;
    return false;
  }

  public async parse(content: Uint8Array | string, options?: ParseOptions): Promise<ParsedBoardViewResult> {
    const diagnostics: ParseDiagnostic[] = [];
    let xmlContent: string = "";

    try {
      if (typeof content === "string") {
        xmlContent = content;
      } else {
        // Check if raw XML or ZIP
        if (content.length >= 4 && content[0] === 0x50 && content[1] === 0x4B && content[2] === 0x03 && content[3] === 0x04) {
          const extractor = new SafeZipExtractor();
          const files = extractor.extract(content);
          const fzFile = files.find(f => f.filename.endsWith(".fz") || f.filename.endsWith(".xml")) || files[0];
          if (!fzFile) {
            diagnostics.push({
              severity: DiagnosticSeverity.FATAL,
              code: "EMPTY_FZZ_ARCHIVE",
              message: "No .fz or .xml content found inside FZZ archive."
            });
            return { document: this.emptyDoc(), diagnostics, success: false };
          }
          xmlContent = new TextDecoder("utf-8").decode(fzFile.data);
        } else {
          xmlContent = new TextDecoder("utf-8").decode(content);
        }
      }

      return this.parseFritzingXml(xmlContent, options, diagnostics);
    } catch (err: any) {
      if (err instanceof ZipBombError) {
        diagnostics.push({
          severity: DiagnosticSeverity.FATAL,
          code: err.code || "DECOMPRESSION_BOMB_DETECTED",
          message: err.message
        });
      } else {
        diagnostics.push({
          severity: DiagnosticSeverity.FATAL,
          code: "FZZ_PARSING_ERROR",
          message: err.message || "Failed to parse FZZ document"
        });
      }

      return {
        document: this.emptyDoc(),
        diagnostics,
        success: false
      };
    }
  }

  private parseFritzingXml(xml: string, options?: ParseOptions, diagnostics: ParseDiagnostic[] = []): ParsedBoardViewResult {
    let width = 0;
    let height = 0;
    const components: RawComponent[] = [];

    // Parse board width/height from <layer layerId="board" width="..." height="..." />
    const boardLayerMatch = /<layer[^>]*layerId="board"[^>]*width="([\d.]+)"[^>]*height="([\d.]+)"/i.exec(xml) ||
                            /<layer[^>]*width="([\d.]+)"[^>]*height="([\d.]+)"[^>]*layerId="board"/i.exec(xml);
    if (boardLayerMatch) {
      width = parseFloat(boardLayerMatch[1]);
      height = parseFloat(boardLayerMatch[2]);
    }

    // Parse <instance moduleIdRef="..." modelIndex="...">
    const instanceRegex = /<instance[\s\S]*?<\/instance>/gi;
    let instanceMatch: RegExpExecArray | null;

    while ((instanceMatch = instanceRegex.exec(xml)) !== null) {
      const block = instanceMatch[0];
      const titleMatch = /<title>(.*?)<\/title>/i.exec(block);
      const title = titleMatch ? titleMatch[1].trim() : `INST_${components.length + 1}`;

      const geoMatch = /<geometry[^>]*x="([\d.-]+)"[^>]*y="([\d.-]+)"(?:[^>]*rot="([\d.-]+)")?(?:[^>]*flipped="([^"]+)")?/i.exec(block);
      const x = geoMatch ? parseFloat(geoMatch[1]) : 0;
      const y = geoMatch ? parseFloat(geoMatch[2]) : 0;
      const rot = geoMatch && geoMatch[3] ? parseFloat(geoMatch[3]) : 0;
      const flipped = geoMatch && geoMatch[4] === "true";
      const side = flipped ? LayerSide.BOTTOM_SIDE : LayerSide.TOP_SIDE;

      const pins: RawPin[] = [];
      const connRegex = /<connector[^>]*connectorId="([^"]+)"(?:[^>]*name="([^"]+)")?(?:[^>]*net="([^"]+)")?(?:[^>]*x="([\d.-]+)")?(?:[^>]*y="([\d.-]+)")?/gi;
      let connMatch: RegExpExecArray | null;

      while ((connMatch = connRegex.exec(block)) !== null) {
        const id = connMatch[1];
        const name = connMatch[2] || id;
        const net = connMatch[3] || "UNCONNECTED";
        const px = connMatch[4] ? parseFloat(connMatch[4]) : x;
        const py = connMatch[5] ? parseFloat(connMatch[5]) : y;

        pins.push({
          pinRef: name,
          componentRefDes: title,
          x: px,
          y: py,
          side,
          netName: net
        });
      }

      components.push({
        refDes: title,
        x,
        y,
        rotation: rot,
        side,
        pins
      });
    }

    const outlinePoints: RawPoint[] = [
      { x: 0, y: 0 },
      { x: width, y: 0 },
      { x: width, y: height },
      { x: 0, y: height }
    ];

    const document: RawBoardViewDocument = {
      format: "FZZ",
      name: options?.subBoardName || "FritzingBoard",
      outline: {
        width,
        height,
        polygon: outlinePoints
      },
      components,
      nails: [],
      diagnostics
    };

    return {
      document,
      diagnostics,
      success: true
    };
  }

  private emptyDoc(): RawBoardViewDocument {
    return {
      format: "FZZ",
      outline: { width: 0, height: 0, polygon: [] },
      components: [],
      nails: [],
      diagnostics: []
    };
  }
}
