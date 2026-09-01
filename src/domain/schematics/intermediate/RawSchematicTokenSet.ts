import type { ParseDiagnostic } from "../ports/ISchematicParser.js";

/**
 * A single raw vector-text token extracted from a schematic source page,
 * before any domain classification or coordinate normalization is applied.
 */
export interface RawSchematicToken {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  fontFamily?: string;
  rotation?: number;
}

/**
 * A raw page of the source schematic: physical dimensions plus the ordered
 * list of vector-text tokens found on it.
 */
export interface RawSchematicPage {
  pageNumber: number;
  width: number;
  height: number;
  tokens: RawSchematicToken[];
}

/**
 * Intermediate, source-plumbing output of a schematic parser. Mirrors the
 * `RawBoardViewDocument` pattern: raw data plus diagnostics, ready to be
 * assembled into a domain `SchematicDocument` aggregate.
 */
export interface RawSchematicTokenSet {
  format: string;
  sourceFilename?: string;
  pages: RawSchematicPage[];
  diagnostics: ParseDiagnostic[];
}
