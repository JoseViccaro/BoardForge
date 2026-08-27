import { BoardStackType } from "../../../domain/catalog/value-objects/BoardStackType.js";
import { SubBoardRole, Dimensions2D } from "../../../domain/catalog/entities/SubBoardEntity.js";

export interface SubBoardDto {
  id: string;
  label: string;
  role: SubBoardRole;
  layerCount: number;
  dimensions?: Dimensions2D;
  padCount: number;
  componentCount: number;
}

export interface CompositeBoardDto {
  id: string;
  boardNumber: string;
  stackType: BoardStackType;
  subBoards: SubBoardDto[];
}
