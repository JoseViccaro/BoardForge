import { BoardViewFormat, ParseDiagnostic } from "../value-objects/BoardViewFormat.js";
import { RawBoardViewDocument } from "../intermediate/RawBoardViewDocument.js";

export interface ParseOptions {
  subBoardName?: string;
  sourceFilename?: string;
  maxFileSize?: number;
}

export interface ParsedBoardViewResult {
  document: RawBoardViewDocument;
  diagnostics: ParseDiagnostic[];
  success: boolean;
}

export interface IBoardViewParser {
  readonly supportedFormat: BoardViewFormat;
  canParse(headerBytes: Uint8Array, filename?: string): boolean;
  parse(content: Uint8Array | string, options?: ParseOptions): Promise<ParsedBoardViewResult>;
}

export interface IBoardViewParserFactory {
  getParser(format: BoardViewFormat): IBoardViewParser;
  detectParser(content: Uint8Array, filename?: string): IBoardViewParser;
}
