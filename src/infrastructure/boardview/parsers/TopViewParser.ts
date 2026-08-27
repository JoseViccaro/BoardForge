import { IBoardViewParser, ParseOptions, ParsedBoardViewResult } from "../../../domain/boardview/ports/IBoardViewParser.js";
import { BoardViewFormat, DiagnosticSeverity, ParseDiagnostic } from "../../../domain/boardview/value-objects/BoardViewFormat.js";
import { RawBoardViewDocument, RawComponent, RawPin, RawPoint, RawNail } from "../../../domain/boardview/intermediate/RawBoardViewDocument.js";
import { LayerSide } from "../../../domain/boardview/value-objects/LayerSide.js";
import { SafeBinaryReader } from "../io/SafeBinaryReader.js";

export class TopViewParser implements IBoardViewParser {
  public readonly supportedFormat = BoardViewFormat.TOPVIEW;

  public canParse(headerBytes: Uint8Array, filename?: string): boolean {
    if (headerBytes.length >= 4) {
      const magic = new TextDecoder("latin1").decode(headerBytes.subarray(0, 4));
      if (magic === "TVW_" || magic.startsWith("TVW")) return true;
    }
    const snippet = new TextDecoder("latin1").decode(headerBytes.subarray(0, Math.min(headerBytes.byteLength, 512)));
    if (snippet.includes("TOPVIEW")) return true;
    if (filename && filename.toLowerCase().endsWith(".tvw")) return true;
    return false;
  }

  public async parse(content: Uint8Array | string, options?: ParseOptions): Promise<ParsedBoardViewResult> {
    const diagnostics: ParseDiagnostic[] = [];
    const buffer = typeof content === "string" ? new TextEncoder().encode(content) : content;

    try {
      const reader = new SafeBinaryReader(buffer);

      const magic = reader.readFixedString(4);
      if (!magic.startsWith("TVW")) {
        diagnostics.push({
          severity: DiagnosticSeverity.WARNING,
          code: "UNUSUAL_TOPVIEW_MAGIC",
          message: `Expected TVW signature, found ${magic}`
        });
      }

      const width = reader.readFloat32LE();
      const height = reader.readFloat32LE();
      const numComponents = reader.readUInt32LE();
      const numPins = reader.readUInt32LE();
      const numNails = reader.readUInt32LE();

      // Components
      const componentsMap = new Map<string, RawComponent>();
      for (let i = 0; i < numComponents; i++) {
        const refDes = this.cleanString(reader.readFixedBytes(16));
        const x = reader.readFloat32LE();
        const y = reader.readFloat32LE();
        const rotation = reader.readFloat32LE();
        const sideVal = reader.readUInt8();

        const comp: RawComponent = {
          refDes: refDes || `U_${i + 1}`,
          x,
          y,
          rotation,
          side: sideVal === 1 ? LayerSide.BOTTOM_SIDE : LayerSide.TOP_SIDE,
          pins: []
        };
        componentsMap.set(comp.refDes, comp);
      }

      // Pins
      for (let i = 0; i < numPins; i++) {
        const compRef = this.cleanString(reader.readFixedBytes(16));
        const pinRef = this.cleanString(reader.readFixedBytes(8));
        const x = reader.readFloat32LE();
        const y = reader.readFloat32LE();
        const sideVal = reader.readUInt8();
        const netName = this.cleanString(reader.readFixedBytes(32));

        const pin: RawPin = {
          componentRefDes: compRef,
          pinRef: pinRef || `${i + 1}`,
          x,
          y,
          side: sideVal === 1 ? LayerSide.BOTTOM_SIDE : LayerSide.TOP_SIDE,
          netName: netName || "UNCONNECTED"
        };

        let comp = componentsMap.get(compRef);
        if (!comp) {
          comp = {
            refDes: compRef,
            x: 0,
            y: 0,
            rotation: 0,
            side: pin.side,
            pins: []
          };
          componentsMap.set(compRef, comp);
        }
        comp.pins.push(pin);
      }

      // Nails
      const nails: RawNail[] = [];
      for (let i = 0; i < numNails; i++) {
        const id = this.cleanString(reader.readFixedBytes(16));
        const x = reader.readFloat32LE();
        const y = reader.readFloat32LE();
        const sideVal = reader.readUInt8();
        const netName = this.cleanString(reader.readFixedBytes(32));

        nails.push({
          id: id || `TP_${i + 1}`,
          x,
          y,
          side: sideVal === 1 ? LayerSide.BOTTOM_SIDE : LayerSide.TOP_SIDE,
          netName: netName || "UNCONNECTED"
        });
      }

      const outlinePoints: RawPoint[] = [
        { x: 0, y: 0 },
        { x: width, y: 0 },
        { x: width, y: height },
        { x: 0, y: height }
      ];

      const document: RawBoardViewDocument = {
        format: "TOPVIEW",
        name: options?.subBoardName || "TopViewBoard",
        outline: {
          width,
          height,
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
    } catch (err: any) {
      diagnostics.push({
        severity: DiagnosticSeverity.FATAL,
        code: err.name || "TOPVIEW_DECODE_ERROR",
        message: err.message || "Failed to decode TopView payload"
      });
      return {
        document: {
          format: "TOPVIEW",
          outline: { width: 0, height: 0, polygon: [] },
          components: [],
          nails: [],
          diagnostics
        },
        diagnostics,
        success: false
      };
    }
  }

  private cleanString(bytes: Uint8Array): string {
    const raw = new TextDecoder("utf-8").decode(bytes);
    const nullIdx = raw.indexOf("\0");
    return (nullIdx >= 0 ? raw.substring(0, nullIdx) : raw).trim();
  }
}
