import { describe, it, expect } from "vitest";
import { BoardViewParserFactory, UnsupportedFormatError } from "../../../../src/infrastructure/boardview/parsers/BoardViewParserFactory.js";
import { BoardViewFormat } from "../../../../src/domain/boardview/value-objects/BoardViewFormat.js";
import { GenCadParser } from "../../../../src/infrastructure/boardview/parsers/GenCadParser.js";
import { LandrexBrdParser } from "../../../../src/infrastructure/boardview/parsers/LandrexBrdParser.js";
import { FzzArchiveParser } from "../../../../src/infrastructure/boardview/parsers/FzzArchiveParser.js";
import { BdvParser } from "../../../../src/infrastructure/boardview/parsers/BdvParser.js";
import { TopViewParser } from "../../../../src/infrastructure/boardview/parsers/TopViewParser.js";

describe("BoardViewParserFactory", () => {
  const factory = new BoardViewParserFactory();

  it("should resolve parser by BoardViewFormat enum", () => {
    expect(factory.getParser(BoardViewFormat.GENCAD)).toBeInstanceOf(GenCadParser);
    expect(factory.getParser(BoardViewFormat.LANDREX_BRD)).toBeInstanceOf(LandrexBrdParser);
    expect(factory.getParser(BoardViewFormat.FZZ)).toBeInstanceOf(FzzArchiveParser);
    expect(factory.getParser(BoardViewFormat.BDV)).toBeInstanceOf(BdvParser);
    expect(factory.getParser(BoardViewFormat.TOPVIEW)).toBeInstanceOf(TopViewParser);
  });

  it("should throw UnsupportedFormatError for UNKNOWN or unsupported format", () => {
    expect(() => factory.getParser(BoardViewFormat.UNKNOWN)).toThrow(UnsupportedFormatError);
  });

  it("should automatically detect and return appropriate parser from raw content", () => {
    const gencad = new TextEncoder().encode("$HEADER\nGENCAD 1.4\n");
    expect(factory.detectParser(gencad)).toBeInstanceOf(GenCadParser);

    const landrex = new TextEncoder().encode("BRD2\x00\x00");
    expect(factory.detectParser(landrex)).toBeInstanceOf(LandrexBrdParser);

    const bdv = new TextEncoder().encode("#FORMAT: BDV\n#COMPONENTS");
    expect(factory.detectParser(bdv)).toBeInstanceOf(BdvParser);

    const tvw = new TextEncoder().encode("TVW_1.0");
    expect(factory.detectParser(tvw)).toBeInstanceOf(TopViewParser);
  });

  it("should throw UnsupportedFormatError when content cannot be detected", () => {
    const random = new Uint8Array([0xAA, 0xBB, 0xCC]);
    expect(() => factory.detectParser(random)).toThrow(UnsupportedFormatError);
  });
});
