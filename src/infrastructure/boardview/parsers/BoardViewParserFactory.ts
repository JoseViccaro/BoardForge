import { IBoardViewParser, IBoardViewParserFactory } from "../../../domain/boardview/ports/IBoardViewParser.js";
import { BoardViewFormat } from "../../../domain/boardview/value-objects/BoardViewFormat.js";
import { BoardViewFormatSniffer } from "../../../domain/boardview/services/BoardViewFormatSniffer.js";
import { GenCadParser } from "./GenCadParser.js";
import { LandrexBrdParser } from "./LandrexBrdParser.js";
import { FzzArchiveParser } from "./FzzArchiveParser.js";
import { BdvParser } from "./BdvParser.js";
import { TopViewParser } from "./TopViewParser.js";

export class UnsupportedFormatError extends Error {
  constructor(formatOrReason: string) {
    super(`Unsupported or unrecognized BoardView format: ${formatOrReason}`);
    this.name = "UnsupportedFormatError";
  }
}

export class BoardViewParserFactory implements IBoardViewParserFactory {
  private readonly parsers: Map<BoardViewFormat, IBoardViewParser> = new Map();
  private readonly sniffer: BoardViewFormatSniffer;

  constructor(sniffer?: BoardViewFormatSniffer) {
    this.sniffer = sniffer ?? new BoardViewFormatSniffer();

    this.registerParser(new GenCadParser());
    this.registerParser(new LandrexBrdParser());
    this.registerParser(new FzzArchiveParser());
    this.registerParser(new BdvParser());
    this.registerParser(new TopViewParser());
  }

  public registerParser(parser: IBoardViewParser): void {
    this.parsers.set(parser.supportedFormat, parser);
  }

  public getParser(format: BoardViewFormat): IBoardViewParser {
    const parser = this.parsers.get(format);
    if (!parser) {
      throw new UnsupportedFormatError(format);
    }
    return parser;
  }

  public detectParser(content: Uint8Array, filename?: string): IBoardViewParser {
    const result = this.sniffer.sniff(content, filename);
    if (result.format === BoardViewFormat.UNKNOWN || !this.parsers.has(result.format)) {
      // Check canParse directly across parsers
      for (const parser of this.parsers.values()) {
        if (parser.canParse(content, filename)) {
          return parser;
        }
      }
      throw new UnsupportedFormatError(result.diagnostic?.message || "Format not recognized");
    }

    return this.getParser(result.format);
  }
}
