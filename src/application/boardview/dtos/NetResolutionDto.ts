import { NetClassification } from "../../../domain/boardview/value-objects/NetClassification.js";

export interface ConnectedPinDto {
  subBoardId: string;
  padId: string;
  pinRef?: string;
}

export interface NetResolutionDto {
  canonicalNetName: string;
  classification: NetClassification;
  originPadId?: string;
  interposerPadId?: string | null;
  connectedPins: ConnectedPinDto[];
}
