import { IBoardViewParser, ParseOptions, ParsedBoardViewResult } from "../../../domain/boardview/ports/IBoardViewParser.js";
import { BoardViewFormat, DiagnosticSeverity, ParseDiagnostic } from "../../../domain/boardview/value-objects/BoardViewFormat.js";
import { RawBoardViewDocument, RawComponent, RawPin, RawPoint, RawNail } from "../../../domain/boardview/intermediate/RawBoardViewDocument.js";
import { LayerSide } from "../../../domain/boardview/value-objects/LayerSide.js";
import { SafeBinaryReader, PayloadTooLargeError } from "../io/SafeBinaryReader.js";

export class GenCadParser implements IBoardViewParser {
  public readonly supportedFormat = BoardViewFormat.GENCAD;

  public canParse(headerBytes: Uint8Array, filename?: string): boolean {
    const text = new TextDecoder("latin1").decode(headerBytes.subarray(0, Math.min(headerBytes.byteLength, 1024)));
    if (/\$(HEADER|GENCAD)/i.test(text)) return true;
    if (filename && filename.toLowerCase().endsWith(".cad")) return true;
    return false;
  }

  public async parse(content: Uint8Array | string, options?: ParseOptions): Promise<ParsedBoardViewResult> {
    const diagnostics: ParseDiagnostic[] = [];
    let textContent: string;

    if (content instanceof Uint8Array) {
      if (content.byteLength > SafeBinaryReader.MAX_BUFFER_SIZE) {
        diagnostics.push({
          severity: DiagnosticSeverity.FATAL,
          code: "PAYLOAD_TOO_LARGE",
          message: `GenCad input size exceeds ${SafeBinaryReader.MAX_BUFFER_SIZE} bytes.`
        });
        return {
          document: this.emptyDoc(),
          diagnostics,
          success: false
        };
      }
      textContent = new TextDecoder("utf-8").decode(content);
    } else {
      textContent = content;
    }

    const lines = textContent.split(/\r?\n/);
    const outlinePoints: RawPoint[] = [];
    const componentsMap = new Map<string, RawComponent>();
    const signalNets = new Map<string, string>(); // "COMPONENT.PIN" -> NetName
    const nails: RawNail[] = [];

    let currentSection: string | null = null;
    let currentComponent: RawComponent | null = null;
    let currentSignal: string | null = null;

    let unitsScale = 1.0; // default MM = 1.0; MILS = 0.0254; INCH = 25.4

    for (let i = 0; i < lines.length; i++) {
      const rawLine = lines[i].trim();
      if (!rawLine || rawLine.startsWith("//") || rawLine.startsWith(";")) continue;

      if (rawLine.startsWith("$")) {
        const token = rawLine.toUpperCase();
        if (token.startsWith("$END")) {
          if (currentComponent) {
            componentsMap.set(currentComponent.refDes, currentComponent);
            currentComponent = null;
          }
          currentSection = null;
          continue;
        }

        currentSection = token;

        // Check unknown section
        const knownSections = ["$HEADER", "$GENCAD", "$BOARD", "$COMPONENTS", "$PINS", "$SIGNALS", "$NETS", "$VIAS", "$TESTPOINTS", "$SHAPES", "$PADS", "$TRACKS"];
        if (!knownSections.some(s => token.startsWith(s))) {
          diagnostics.push({
            severity: DiagnosticSeverity.WARNING,
            code: "UNKNOWN_GENCAD_SECTION",
            message: `Unknown or unhandled GenCAD section header: ${token}`,
            line: i + 1
          });
        }
        continue;
      }

      if (!currentSection) continue;

      const tokens = rawLine.split(/\s+/);

      if (currentSection.startsWith("$HEADER") || currentSection.startsWith("$GENCAD")) {
        if (tokens[0].toUpperCase() === "UNITS") {
          const unit = tokens[1]?.toUpperCase();
          if (unit === "INCH" || unit === "INCHES") unitsScale = 25.4;
          else if (unit === "MIL" || unit === "MILS" || unit === "THOU") unitsScale = 0.0254;
          else if (unit === "MM" || unit === "MILLIMETER" || unit === "MILLIMETRES") unitsScale = 1.0;
        }
      } else if (currentSection.startsWith("$BOARD")) {
        // LINE x1 y1 x2 y2
        if (tokens[0].toUpperCase() === "LINE" && tokens.length >= 5) {
          const x1 = parseFloat(tokens[1]) * unitsScale;
          const y1 = parseFloat(tokens[2]) * unitsScale;
          const x2 = parseFloat(tokens[3]) * unitsScale;
          const y2 = parseFloat(tokens[4]) * unitsScale;
          if (!outlinePoints.some(p => Math.abs(p.x - x1) < 1e-4 && Math.abs(p.y - y1) < 1e-4)) {
            outlinePoints.push({ x: x1, y: y1 });
          }
          if (!outlinePoints.some(p => Math.abs(p.x - x2) < 1e-4 && Math.abs(p.y - y2) < 1e-4)) {
            outlinePoints.push({ x: x2, y: y2 });
          }
        }
      } else if (currentSection.startsWith("$COMPONENTS")) {
        if (tokens[0].toUpperCase() === "COMPONENT") {
          if (currentComponent) {
            componentsMap.set(currentComponent.refDes, currentComponent);
          }
          currentComponent = {
            refDes: tokens[1] || `COMP_${componentsMap.size + 1}`,
            x: 0,
            y: 0,
            rotation: 0,
            side: LayerSide.TOP_SIDE,
            pins: []
          };
        } else if (currentComponent) {
          if (tokens[0].toUpperCase() === "PLACE" && tokens.length >= 3) {
            currentComponent.x = parseFloat(tokens[1]) * unitsScale;
            currentComponent.y = parseFloat(tokens[2]) * unitsScale;
          } else if (tokens[0].toUpperCase() === "LAYER") {
            const layer = tokens[1]?.toUpperCase();
            currentComponent.side = (layer === "BOTTOM" || layer === "BOT" || layer === "B") ? LayerSide.BOTTOM_SIDE : LayerSide.TOP_SIDE;
          } else if (tokens[0].toUpperCase() === "ROTATION" && tokens.length >= 2) {
            currentComponent.rotation = parseFloat(tokens[1]);
          } else if (tokens[0].toUpperCase() === "DEVICE") {
            currentComponent.package = tokens[1];
          }
        }
      } else if (currentSection.startsWith("$PINS")) {
        // PIN <component> <pinRef> <x> <y> [layer]
        if (tokens[0].toUpperCase() === "PIN" && tokens.length >= 5) {
          const compRef = tokens[1];
          const pinRef = tokens[2];
          const x = parseFloat(tokens[3]) * unitsScale;
          const y = parseFloat(tokens[4]) * unitsScale;
          const side = (tokens[5]?.toUpperCase() === "BOTTOM" || tokens[5]?.toUpperCase() === "BOT") ? LayerSide.BOTTOM_SIDE : LayerSide.TOP_SIDE;

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
            pinRef,
            componentRefDes: compRef,
            x,
            y,
            side,
            netName: "UNCONNECTED"
          });
        }
      } else if (currentSection.startsWith("$SIGNALS") || currentSection.startsWith("$NETS")) {
        if (tokens[0].toUpperCase() === "SIGNAL" || tokens[0].toUpperCase() === "NET") {
          currentSignal = tokens[1] || "UNKNOWN_NET";
        } else if (tokens[0].toUpperCase() === "NODE" && currentSignal && tokens.length >= 3) {
          const compRef = tokens[1];
          const pinRef = tokens[2];
          signalNets.set(`${compRef}.${pinRef}`, currentSignal);
        }
      }
    }

    if (currentComponent) {
      componentsMap.set(currentComponent.refDes, currentComponent);
    }

    // Apply signal nets to component pins
    for (const comp of componentsMap.values()) {
      for (const pin of comp.pins) {
        const key = `${comp.refDes}.${pin.pinRef}`;
        if (signalNets.has(key)) {
          pin.netName = signalNets.get(key)!;
        }
      }
    }

    // Compute outline bounding box
    let minX = 0, minY = 0, maxX = 0, maxY = 0;
    if (outlinePoints.length > 0) {
      minX = Math.min(...outlinePoints.map(p => p.x));
      minY = Math.min(...outlinePoints.map(p => p.y));
      maxX = Math.max(...outlinePoints.map(p => p.x));
      maxY = Math.max(...outlinePoints.map(p => p.y));
    }

    const document: RawBoardViewDocument = {
      format: "GENCAD",
      name: options?.subBoardName || "GenCadBoard",
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
      format: "GENCAD",
      outline: { width: 0, height: 0, polygon: [] },
      components: [],
      nails: [],
      diagnostics: []
    };
  }
}
