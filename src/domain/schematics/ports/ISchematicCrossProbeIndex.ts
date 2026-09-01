import type { SchematicDocument } from "../aggregates/SchematicDocument.js";
import type { NetLabelMatch } from "../value-objects/NetLabelMatch.js";
import type { BoundingBox2D } from "../value-objects/BoundingBox2D.js";
import type { VectorToken } from "../value-objects/VectorToken.js";
import type { InterposerJunction } from "../../boardview/value-objects/InterposerJunction.js";

export interface SchematicPinHit {
  documentId: string;
  pageNumber: number;
  refDes: string;
  pinNumber: string;
  pinName?: string;
  bounds: BoundingBox2D;
  connectionPoint: { x: number; y: number };
  netName?: string;
}

export interface BoardViewPadHit {
  subBoardId: string;
  padId: string;
  refDes?: string;
  pinNumber?: string;
  netName: string;
  x: number;
  y: number;
  layer: string;
}

export interface SchematicCoordinateLookupResult {
  tokens: VectorToken[];
  netName?: string;
  pinHits: BoardViewPadHit[];
  interposerJunctions: InterposerJunction[];
}

export interface ISchematicCrossProbeIndex {
  registerSchematicDocument(doc: SchematicDocument): void;
  queryFromBoardViewPin(refDes: string, pinNumber: string): SchematicPinHit[];
  queryFromBoardViewNet(netName: string): NetLabelMatch[];
  queryFromSchematicCoordinate(pageNumber: number, x: number, y: number): SchematicCoordinateLookupResult;
}
