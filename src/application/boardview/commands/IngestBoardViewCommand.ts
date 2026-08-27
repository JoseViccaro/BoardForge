import { BoardViewFormat } from "../../../domain/boardview/value-objects/BoardViewFormat.js";
import { InterposerMappingRule } from "../../../domain/boardview/services/BoardViewToCanonicalTransformer.js";

export interface BoardFileInput {
  subBoardId: string;
  subBoardLabel: string;
  content: Uint8Array | string;
  filename?: string;
  format?: BoardViewFormat;
}

export interface IngestBoardViewCommand {
  boardId: string;
  boardNumber?: string;
  files: BoardFileInput[];
  interposerMappings?: InterposerMappingRule[];
}
