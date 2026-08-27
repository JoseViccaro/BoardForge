import { ParseDiagnostic } from "../../../domain/boardview/value-objects/BoardViewFormat.js";

export interface IngestBoardViewResultDto {
  boardId: string;
  boardNumber: string;
  stackType: string;
  subBoardCount: number;
  totalComponents: number;
  totalPads: number;
  totalNets: number;
  diagnostics: ParseDiagnostic[];
  success: boolean;
}
