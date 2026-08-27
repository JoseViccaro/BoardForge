import { describe, it, expect } from "vitest";
import { FzzArchiveParser } from "../../../../src/infrastructure/boardview/parsers/FzzArchiveParser.js";
import { SafeZipExtractor, ZipBombError } from "../../../../src/infrastructure/boardview/io/SafeZipExtractor.js";
import { BoardViewFormat, DiagnosticSeverity } from "../../../../src/domain/boardview/value-objects/BoardViewFormat.js";
import { LayerSide } from "../../../../src/domain/boardview/value-objects/LayerSide.js";
import * as zlib from "node:zlib";

describe("FzzArchiveParser & SafeZipExtractor", () => {
  const parser = new FzzArchiveParser();

  it("should have supportedFormat set to FZZ", () => {
    expect(parser.supportedFormat).toBe(BoardViewFormat.FZZ);
  });

  it("should detect decompression bomb (> 10:1 ratio or > 50MB uncompressed) and abort", async () => {
    // Generate a zip with a tiny compressed payload that expands beyond 10:1 ratio
    const uncompressedData = new Uint8Array(20000); // 20KB
    uncompressedData.fill(0x41); // 'A'
    const deflated = zlib.deflateRawSync(uncompressedData); // ~30 bytes

    // Build standard zip archive containing this entry
    const zipBuffer = buildSimpleZip("huge.xml", deflated, uncompressedData.length);

    // Using SafeZipExtractor directly with maxRatio = 10
    const extractor = new SafeZipExtractor({ maxRatio: 10, maxUncompressedSize: 50 * 1024 * 1024 });
    expect(() => extractor.extract(zipBuffer)).toThrow(ZipBombError);

    // Running through parser should return FATAL ParseDiagnostic DECOMPRESSION_BOMB_DETECTED
    const parseResult = await parser.parse(zipBuffer);
    expect(parseResult.success).toBe(false);
    expect(parseResult.diagnostics.some(d => d.severity === DiagnosticSeverity.FATAL && d.code === "DECOMPRESSION_BOMB_DETECTED")).toBe(true);
  });

  it("should parse XML module / part definitions from Fritzing archive or raw XML", async () => {
    const fzXml = `<?xml version="1.0" encoding="utf-8"?>
<module fritzingVersion="0.9.3b">
  <views>
    <pcbView>
      <layers image="pcb.svg">
        <layer layerId="board" width="60.0" height="40.0" />
      </layers>
    </pcbView>
  </views>
  <instances>
    <instance moduleIdRef="U1_Module" modelIndex="101">
      <title>U1</title>
      <views>
        <pcbView>
          <geometry x="20.0" y="15.0" z="0" rot="0" flipped="false" />
          <connectors>
            <connector connectorId="connector0" name="1" net="PP_VDD_MAIN" x="19.0" y="15.0" />
            <connector connectorId="connector1" name="2" net="GND" x="21.0" y="15.0" />
          </connectors>
        </pcbView>
      </views>
    </instance>
  </instances>
</module>`;

    const compressed = zlib.deflateRawSync(new TextEncoder().encode(fzXml));
    const zip = buildSimpleZip("part.fz", compressed, fzXml.length);

    const result = await parser.parse(zip, { subBoardName: "FritzingBoard" });
    expect(result.success).toBe(true);
    expect(result.document.format).toBe("FZZ");
    expect(result.document.outline.width).toBe(60.0);
    expect(result.document.outline.height).toBe(40.0);

    expect(result.document.components.length).toBe(1);
    const comp = result.document.components[0];
    expect(comp.refDes).toBe("U1");
    expect(comp.x).toBe(20.0);
    expect(comp.y).toBe(15.0);
    expect(comp.side).toBe(LayerSide.TOP_SIDE);

    expect(comp.pins.length).toBe(2);
    expect(comp.pins[0].pinRef).toBe("1");
    expect(comp.pins[0].netName).toBe("PP_VDD_MAIN");
    expect(comp.pins[1].pinRef).toBe("2");
    expect(comp.pins[1].netName).toBe("GND");
  });
});

// Helper to construct a minimal valid zip file in memory
function buildSimpleZip(filename: string, compressedData: Uint8Array, uncompressedSize: number): Uint8Array {
  const filenameBytes = new TextEncoder().encode(filename);
  const localHeaderSize = 30 + filenameBytes.length;
  const centralHeaderSize = 46 + filenameBytes.length;
  const endRecordSize = 22;

  const totalSize = localHeaderSize + compressedData.length + centralHeaderSize + endRecordSize;
  const buf = new Uint8Array(totalSize);
  const view = new DataView(buf.buffer);

  // Local file header (0x04034b50)
  view.setUint32(0, 0x04034b50, true);
  view.setUint16(4, 20, true); // version needed
  view.setUint16(6, 0, true); // flags
  view.setUint16(8, 8, true); // compression: deflate
  view.setUint16(10, 0, true); // mod time
  view.setUint16(12, 0, true); // mod date
  view.setUint32(14, 0, true); // crc32
  view.setUint32(18, compressedData.length, true); // compressed size
  view.setUint32(22, uncompressedSize, true); // uncompressed size
  view.setUint16(26, filenameBytes.length, true); // filename length
  view.setUint16(28, 0, true); // extra length
  buf.set(filenameBytes, 30);
  buf.set(compressedData, 30 + filenameBytes.length);

  const localOffset = 0;
  const centralOffset = 30 + filenameBytes.length + compressedData.length;

  // Central directory header (0x02014b50)
  view.setUint32(centralOffset, 0x02014b50, true);
  view.setUint16(centralOffset + 4, 20, true);
  view.setUint16(centralOffset + 6, 20, true);
  view.setUint16(centralOffset + 8, 0, true);
  view.setUint16(centralOffset + 10, 8, true);
  view.setUint16(centralOffset + 12, 0, true);
  view.setUint16(centralOffset + 14, 0, true);
  view.setUint32(centralOffset + 16, 0, true);
  view.setUint32(centralOffset + 20, compressedData.length, true);
  view.setUint32(centralOffset + 24, uncompressedSize, true);
  view.setUint16(centralOffset + 28, filenameBytes.length, true);
  view.setUint16(centralOffset + 30, 0, true); // extra length
  view.setUint16(centralOffset + 32, 0, true); // comment length
  view.setUint16(centralOffset + 34, 0, true); // disk num
  view.setUint16(centralOffset + 36, 0, true); // internal attr
  view.setUint32(centralOffset + 38, 0, true); // external attr
  view.setUint32(centralOffset + 42, localOffset, true); // relative offset of local header
  buf.set(filenameBytes, centralOffset + 46);

  const endOffset = centralOffset + centralHeaderSize;
  // End of central directory (0x06054b50)
  view.setUint32(endOffset, 0x06054b50, true);
  view.setUint16(endOffset + 4, 0, true);
  view.setUint16(endOffset + 6, 0, true);
  view.setUint16(endOffset + 8, 1, true); // total entries on disk
  view.setUint16(endOffset + 10, 1, true); // total entries
  view.setUint32(endOffset + 12, centralHeaderSize, true); // size of central dir
  view.setUint32(endOffset + 16, centralOffset, true); // offset of central dir
  view.setUint16(endOffset + 20, 0, true); // comment len

  return buf;
}
