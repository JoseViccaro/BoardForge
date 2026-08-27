import { IBoardViewParser, ParseOptions, ParsedBoardViewResult } from "../../../domain/boardview/ports/IBoardViewParser.js";
import { BoardViewFormat, DiagnosticSeverity, ParseDiagnostic } from "../../../domain/boardview/value-objects/BoardViewFormat.js";
import { RawBoardViewDocument, RawComponent, RawPin, RawPoint, RawNail } from "../../../domain/boardview/intermediate/RawBoardViewDocument.js";
import { LayerSide } from "../../../domain/boardview/value-objects/LayerSide.js";
import { SafeBinaryReader, PrematureEndOfStreamError } from "../io/SafeBinaryReader.js";

export class LandrexBrdParser implements IBoardViewParser {
  public readonly supportedFormat = BoardViewFormat.LANDREX_BRD;

  public canParse(headerBytes: Uint8Array, filename?: string): boolean {
    if (headerBytes.byteLength >= 4) {
      const magic = new TextDecoder("latin1").decode(headerBytes.subarray(0, 4));
      if (magic === "BRD2" || magic.startsWith("BRD")) return true;
    }
    const snippet = new TextDecoder("latin1").decode(headerBytes.subarray(0, Math.min(headerBytes.byteLength, 512)));
    if (snippet.includes("PCB_CAD_DATABASE")) return true;
    if (filename && filename.toLowerCase().endsWith(".brd")) return true;
    return false;
  }

  public async parse(content: Uint8Array | string, options?: ParseOptions): Promise<ParsedBoardViewResult> {
    const diagnostics: ParseDiagnostic[] = [];

    const buffer = typeof content === "string" ? new TextEncoder().encode(content) : content;

    try {
      const reader = new SafeBinaryReader(buffer);

      const magic = reader.readFixedString(4);
      if (!magic.startsWith("BRD")) {
        diagnostics.push({
          severity: DiagnosticSeverity.WARNING,
          code: "UNUSUAL_LANDREX_MAGIC",
          message: `Expected BRD signature, found ${magic}`
        });
      }

      const numPoints = reader.readUInt32LE();
      const numNails = reader.readUInt32LE();
      const numComponents = reader.readUInt32LE();
      const numPins = reader.readUInt32LE();

      // Read outline points (coordinate scale 1000 = 1 mm)
      const outlinePoints: RawPoint[] = [];
      for (let i = 0; i < numPoints; i++) {
        const x = reader.readInt32LE() / 1000.0;
        const y = reader.readInt32LE() / 1000.0;
        outlinePoints.push({ x, y });
      }

      // Read nails: id (16 bytes), x (int32), y (int32), side (uint8), netName (32 bytes)
      const nails: RawNail[] = [];
      for (let i = 0; i < numNails; i++) {
        const id = this.cleanString(reader.readFixedBytes(16));
        const x = reader.readInt32LE() / 1000.0;
        const y = reader.readInt32LE() / 1000.0;
        const sideVal = reader.readUInt8();
        const netName = this.cleanString(reader.readFixedBytes(32));

        nails.push({
          id: id || `NAIL_${i + 1}`,
          x,
          y,
          side: sideVal === 1 ? LayerSide.BOTTOM_SIDE : LayerSide.TOP_SIDE,
          netName: netName || "UNCONNECTED"
        });
      }

      // Read components: refDes (16 bytes), x (int32), y (int32), rotation (float32), side (uint8)
      const componentsMap = new Map<string, RawComponent>();
      for (let i = 0; i < numComponents; i++) {
        const refDes = this.cleanString(reader.readFixedBytes(16));
        const x = reader.readInt32LE() / 1000.0;
        const y = reader.readInt32LE() / 1000.0;
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

      // Read pins: compRef (16 bytes), pinRef (8 bytes), x (int32), y (int32), side (uint8), netName (32 bytes)
      for (let i = 0; i < numPins; i++) {
        const compRef = this.cleanString(reader.readFixedBytes(16));
        const pinRef = this.cleanString(reader.readFixedBytes(8));
        const x = reader.readInt32LE() / 1000.0;
        const y = reader.readInt32LE() / 1000.0;
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

      // Compute bounding box
      let minX = 0, minY = 0, maxX = 0, maxY = 0;
      if (outlinePoints.length > 0) {
        minX = Math.min(...outlinePoints.map(p => p.x));
        minY = Math.min(...outlinePoints.map(p => p.y));
        maxX = Math.max(...outlinePoints.map(p => p.x));
        maxY = Math.max(...outlinePoints.map(p => p.y));
      }

      const document: RawBoardViewDocument = {
        format: "LANDREX_BRD",
        name: options?.subBoardName || "LandrexBoard",
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
    } catch (err: any) {
      diagnostics.push({
        severity: DiagnosticSeverity.FATAL,
        code: err.name || "DECODE_ERROR",
        message: err.message || "Failed to decode Landrex BRD payload",
        context: { error: String(err) }
      });
      return {
        document: {
          format: "LANDREX_BRD",
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
