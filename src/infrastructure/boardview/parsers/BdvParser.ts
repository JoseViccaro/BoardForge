import { IBoardViewParser, ParseOptions, ParsedBoardViewResult } from "../../../domain/boardview/ports/IBoardViewParser.js";
import { BoardViewFormat, DiagnosticSeverity, ParseDiagnostic } from "../../../domain/boardview/value-objects/BoardViewFormat.js";
import { RawBoardViewDocument, RawComponent, RawPin, RawPoint, RawNail } from "../../../domain/boardview/intermediate/RawBoardViewDocument.js";
import { LayerSide } from "../../../domain/boardview/value-objects/LayerSide.js";
import { SafeBinaryReader } from "../io/SafeBinaryReader.js";

export class BdvParser implements IBoardViewParser {
  public readonly supportedFormat = BoardViewFormat.BDV;

  public canParse(headerBytes: Uint8Array, filename?: string): boolean {
    const text = new TextDecoder("latin1").decode(headerBytes.subarray(0, Math.min(headerBytes.byteLength, 1024)));
    if (text.includes("#FORMAT: BDV") || (text.includes("#PINS") && text.includes("#COMPONENTS"))) return true;
    if (filename && filename.toLowerCase().endsWith(".bdv")) return true;
    return false;
  }

  public async parse(content: Uint8Array | string, options?: ParseOptions): Promise<ParsedBoardViewResult> {
    const diagnostics: ParseDiagnostic[] = [];
    let text: string;

    if (content instanceof Uint8Array) {
      if (content.byteLength > SafeBinaryReader.MAX_BUFFER_SIZE) {
        diagnostics.push({
          severity: DiagnosticSeverity.FATAL,
          code: "PAYLOAD_TOO_LARGE",
          message: "BDV file size exceeds limit."
        });
        return { document: this.emptyDoc(), diagnostics, success: false };
      }
      text = new TextDecoder("utf-8").decode(content);
    } else {
      text = content;
    }

    const lines = text.split(/\r?\n/);
    const outlinePoints: RawPoint[] = [];
    const componentsMap = new Map<string, RawComponent>();
    const nails: RawNail[] = [];

    let currentSection: string | null = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line || line.startsWith(";")) continue;

      if (line.startsWith("#")) {
        const header = line.toUpperCase();
        if (header.startsWith("#FORMAT")) continue;
        currentSection = header;
        continue;
      }

      if (!currentSection) continue;

      const tokens = line.split(/\s+/);

      if (currentSection.startsWith("#OUTLINE")) {
        if (tokens.length >= 2) {
          const x = parseFloat(tokens[0]);
          const y = parseFloat(tokens[1]);
          outlinePoints.push({ x, y });
        }
      } else if (currentSection.startsWith("#COMPONENTS")) {
        // refDes x y [rotation] [side] [package]
        if (tokens.length >= 3) {
          const refDes = tokens[0];
          const x = parseFloat(tokens[1]);
          const y = parseFloat(tokens[2]);
          const rot = tokens.length >= 4 ? parseFloat(tokens[3]) : 0;
          const sideStr = tokens.length >= 5 ? tokens[4].toUpperCase() : "TOP";
          const pkg = tokens.length >= 6 ? tokens[5] : undefined;

          componentsMap.set(refDes, {
            refDes,
            x,
            y,
            rotation: isNaN(rot) ? 0 : rot,
            side: (sideStr === "BOTTOM" || sideStr === "BOT" || sideStr === "B") ? LayerSide.BOTTOM_SIDE : LayerSide.TOP_SIDE,
            package: pkg,
            pins: []
          });
        }
      } else if (currentSection.startsWith("#PINS")) {
        // compRef pinRef x y [side] [netName]
        if (tokens.length >= 4) {
          const compRef = tokens[0];
          const pinRef = tokens[1];
          const x = parseFloat(tokens[2]);
          const y = parseFloat(tokens[3]);
          const sideStr = tokens.length >= 5 ? tokens[4].toUpperCase() : "TOP";
          const netName = tokens.length >= 6 ? tokens[5] : "UNCONNECTED";

          const side = (sideStr === "BOTTOM" || sideStr === "BOT" || sideStr === "B") ? LayerSide.BOTTOM_SIDE : LayerSide.TOP_SIDE;

          let comp = componentsMap.get(compRef);
          if (!comp) {
            comp = {
              refDes: compRef,
              x: 0,
              y: 0,
              rotation: 0,
              side,
              pins: []
            };
            componentsMap.set(compRef, comp);
          }

          comp.pins.push({
            componentRefDes: compRef,
            pinRef,
            x,
            y,
            side,
            netName
          });
        }
      } else if (currentSection.startsWith("#NAILS") || currentSection.startsWith("#TESTPOINTS")) {
        // id x y [side] [netName]
        if (tokens.length >= 3) {
          const id = tokens[0];
          const x = parseFloat(tokens[1]);
          const y = parseFloat(tokens[2]);
          const sideStr = tokens.length >= 4 ? tokens[3].toUpperCase() : "TOP";
          const netName = tokens.length >= 5 ? tokens[4] : "UNCONNECTED";

          nails.push({
            id,
            x,
            y,
            side: (sideStr === "BOTTOM" || sideStr === "BOT" || sideStr === "B") ? LayerSide.BOTTOM_SIDE : LayerSide.TOP_SIDE,
            netName
          });
        }
      }
    }

    let minX = 0, minY = 0, maxX = 0, maxY = 0;
    if (outlinePoints.length > 0) {
      minX = Math.min(...outlinePoints.map(p => p.x));
      minY = Math.min(...outlinePoints.map(p => p.y));
      maxX = Math.max(...outlinePoints.map(p => p.x));
      maxY = Math.max(...outlinePoints.map(p => p.y));
    }

    const document: RawBoardViewDocument = {
      format: "BDV",
      name: options?.subBoardName || "BdvBoard",
      outline: {
        width: maxX - minX,
        height: maxY - minY,
        polygon: outlinePoints
      },
      components: Array.from(componentsMap.values()),
      nails,
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
      format: "BDV",
      outline: { width: 0, height: 0, polygon: [] },
      components: [],
      nails: [],
      diagnostics: []
    };
  }
}
