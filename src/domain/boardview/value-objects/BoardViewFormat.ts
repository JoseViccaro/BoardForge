export enum BoardViewFormat {
  UNKNOWN = "UNKNOWN",
  LANDREX_BRD = "LANDREX_BRD",
  GENCAD = "GENCAD",
  FZZ = "FZZ",
  BDV = "BDV",
  TOPVIEW = "TOPVIEW"
}

export enum DiagnosticSeverity {
  INFO = "INFO",
  WARNING = "WARNING",
  ERROR = "ERROR",
  FATAL = "FATAL"
}

export interface ParseDiagnostic {
  severity: DiagnosticSeverity;
  code: string;
  message: string;
  line?: number;
  byteOffset?: number;
  context?: Record<string, unknown>;
}
