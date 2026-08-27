import { describe, it, expect } from "vitest";
import { BoardViewFormatSniffer } from "../../../../src/domain/boardview/services/BoardViewFormatSniffer.js";
import { BoardViewFormat } from "../../../../src/domain/boardview/value-objects/BoardViewFormat.js";

describe("BoardViewFormatSniffer", () => {
  const sniffer = new BoardViewFormatSniffer();

  it("should detect Landrex BRD magic bytes (BRD2 or Landrex signatures)", () => {
    const brd2Payload = new TextEncoder().encode("BRD2\x00\x01\x02\x03Some data");
    const result = sniffer.sniff(brd2Payload);
    expect(result.format).toBe(BoardViewFormat.LANDREX_BRD);
    expect(result.confidence).toBe("EXACT_MAGIC");

    const cadDbPayload = new TextEncoder().encode("PCB_CAD_DATABASE_V1");
    expect(sniffer.sniff(cadDbPayload).format).toBe(BoardViewFormat.LANDREX_BRD);
  });

  it("should detect GenCAD $HEADER or $GENCAD ASCII tokens within the first 1024 bytes", () => {
    const gencadHeader = new TextEncoder().encode("$HEADER\nFORMAT GENCAD 1.4\nUNITS MM");
    const result = sniffer.sniff(gencadHeader);
    expect(result.format).toBe(BoardViewFormat.GENCAD);
    expect(result.confidence).toBe("EXACT_MAGIC");

    const leadingSpacesGencad = new TextEncoder().encode("   \n\r $GENCAD 1.4");
    expect(sniffer.sniff(leadingSpacesGencad).format).toBe(BoardViewFormat.GENCAD);
  });

  it("should detect FZZ / PK zip headers with zip signature 0x50 0x4B 0x03 0x04", () => {
    const zipPayload = new Uint8Array([0x50, 0x4B, 0x03, 0x04, 0x00, 0x00]);
    const result = sniffer.sniff(zipPayload, "project.fzz");
    expect(result.format).toBe(BoardViewFormat.FZZ);
    expect(result.confidence).toBe("EXACT_MAGIC");

    const fzXmlPayload = new TextEncoder().encode("<?xml version=\"1.0\"?><module fritzingVersion=\"0.9\">");
    expect(sniffer.sniff(fzXmlPayload).format).toBe(BoardViewFormat.FZZ);
  });

  it("should detect BDV format via #FORMAT: BDV or section headers (#PINS, #COMPONENTS, #NETS)", () => {
    const bdvHeader = new TextEncoder().encode("#FORMAT: BDV\n#PINS\n1 10.0 20.0");
    const result = sniffer.sniff(bdvHeader);
    expect(result.format).toBe(BoardViewFormat.BDV);
    expect(result.confidence).toBe("EXACT_MAGIC");

    const bdvSections = new TextEncoder().encode("#COMPONENTS\nU1 10.0 20.0\n#NETS\n");
    expect(sniffer.sniff(bdvSections).format).toBe(BoardViewFormat.BDV);
  });

  it("should detect TopView (.tvw) binary signatures (TVW_ or TOPVIEW signature)", () => {
    const tvwHeader = new TextEncoder().encode("TVW_BOARD_FILE_V1");
    const result = sniffer.sniff(tvwHeader);
    expect(result.format).toBe(BoardViewFormat.TOPVIEW);
    expect(result.confidence).toBe("EXACT_MAGIC");
  });

  it("should return UNKNOWN for unrecognized formats with diagnostic context", () => {
    const randomData = new Uint8Array([0x00, 0xFF, 0xEE, 0xDD, 0x12, 0x34]);
    const result = sniffer.sniff(randomData, "unknown.xyz");
    expect(result.format).toBe(BoardViewFormat.UNKNOWN);
    expect(result.confidence).toBe("UNKNOWN");
    expect(result.diagnostic?.code).toBe("UNRECOGNIZED_FORMAT_SIGNATURE");
  });
});
