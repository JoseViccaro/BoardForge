import { ISchematicParser } from "../../../domain/schematics/ports/ISchematicParser.js";
import {
  VectorPdfSchematicParser,
  UnsupportedFormatError,
} from "./VectorPdfSchematicParser.js";

export class SchematicParserFactory {
  private readonly parsers: ISchematicParser[] = [];

  constructor() {
    this.registerParser(new VectorPdfSchematicParser());
  }

  public registerParser(parser: ISchematicParser): void {
    this.parsers.push(parser);
  }

  public detectParser(content: Uint8Array, filename?: string): ISchematicParser {
    for (const parser of this.parsers) {
      if (
        "canParse" in parser &&
        typeof (parser as any).canParse === "function" &&
        (parser as any).canParse(content, filename)
      ) {
        return parser;
      }
    }

    throw new UnsupportedFormatError(
      `No parser available for schematic payload${filename ? ` (${filename})` : ""}`
    );
  }
}
