import { LayerSide } from "../value-objects/LayerSide.js";
import { ParseDiagnostic } from "../value-objects/BoardViewFormat.js";

export interface RawPoint {
  x: number;
  y: number;
}

export interface RawBoardOutline {
  width: number;
  height: number;
  polygon: RawPoint[];
}

export interface RawPin {
  pinRef: string;
  componentRefDes: string;
  x: number;
  y: number;
  side: LayerSide;
  netName: string;
  radius?: number;
}

export interface RawComponent {
  refDes: string;
  package?: string;
  x: number;
  y: number;
  rotation: number;
  side: LayerSide;
  pins: RawPin[];
}

export interface RawNail {
  id: string;
  x: number;
  y: number;
  side: LayerSide;
  netName: string;
  radius?: number;
}

export interface RawBoardViewDocument {
  format: string;
  name?: string;
  outline: RawBoardOutline;
  components: RawComponent[];
  nails: RawNail[];
  diagnostics: ParseDiagnostic[];
}
