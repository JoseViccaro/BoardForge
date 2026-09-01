import type { SchematicDocument } from "../aggregates/SchematicDocument.js";

export interface ParseSchematicMeta {
  sourceFilename?: string;
  boardModel?: string;
  boardRevision?: string;
}

export enum DiagnosticSeverity {
  INFO = "INFO",
  WARNING = "WARNING",
  ERROR = "ERROR",
  FATAL = "FATAL",
}

export interface ParseDiagnostic {
  severity: DiagnosticSeverity;
  code: string;
  message: string;
  byteOffset?: number;
  context?: Record<string, unknown>;
}

/**
 * Structured parse error returned by the port on failure. Carries a machine
 * readable `code` (e.g. EMPTY_INPUT) so callers can branch without relying on
 * message text or exceptions (R2.15: the port never throws for invalid input).
 */
export class ParseError {
  public readonly code: string;
  public readonly message: string;

  constructor(code: string, message: string) {
    this.code = code;
    this.message = message;
  }
}

/**
 * Discriminated result of a schematic parse: either a hydrated
 * `SchematicDocument` or a structured `ParseError` with diagnostics. The port
 * contract requires returning this instead of throwing on invalid input.
 */
export type ParseSchematicResult =
  | { ok: true; document: SchematicDocument; meta?: ParseSchematicMeta; diagnostics: ParseDiagnostic[] }
  | { ok: false; error: ParseError; diagnostics: ParseDiagnostic[] };

/**
 * Domain port decoupling schematic parsing from any infrastructure package
 * (`pdfjs-dist` or otherwise). Lives in the domain layer and must not depend on
 * infrastructure. Implementations (e.g. PDF, SVG) conform to this contract.
 */
export interface ISchematicParser {
  parse(rawBytes: Uint8Array, meta?: ParseSchematicMeta): Promise<ParseSchematicResult>;
}
