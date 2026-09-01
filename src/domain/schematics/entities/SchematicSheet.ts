import { VectorToken } from "../value-objects/VectorToken.js";
import { NetLabelMatch } from "../value-objects/NetLabelMatch.js";
import { BoundingBox2D } from "../value-objects/BoundingBox2D.js";
import { SchematicSymbol } from "./SchematicSymbol.js";
import { SchematicNet } from "./SchematicNet.js";
import { SchematicSpatialIndex } from "../services/SchematicSpatialIndex.js";

export interface SchematicSheetProps {
  sheetNumber: number;
  width: number;
  height: number;
}

export class SchematicSheet {
  public readonly sheetNumber: number;
  public readonly width: number;
  public readonly height: number;
  private readonly _tokens: VectorToken[] = [];
  private readonly _symbols: SchematicSymbol[] = [];
  private readonly _netLabels: NetLabelMatch[] = [];
  private readonly _nets: Map<string, SchematicNet> = new Map();
  private readonly _spatialIndex: SchematicSpatialIndex<VectorToken> = new SchematicSpatialIndex<VectorToken>();

  constructor(props: SchematicSheetProps) {
    if (!Number.isInteger(props.sheetNumber) || props.sheetNumber <= 0) {
      throw new Error("sheetNumber must be a positive integer");
    }
    if (props.width <= 0 || props.height <= 0) {
      throw new Error("width and height must be positive");
    }

    this.sheetNumber = props.sheetNumber;
    this.width = props.width;
    this.height = props.height;
  }

  public get pageNumber(): number {
    return this.sheetNumber;
  }

  public get tokens(): ReadonlyArray<VectorToken> {
    return Object.freeze([...this._tokens]);
  }

  public get symbols(): ReadonlyArray<SchematicSymbol> {
    return Object.freeze([...this._symbols]);
  }

  public get netLabels(): ReadonlyArray<NetLabelMatch> {
    return Object.freeze([...this._netLabels]);
  }

  public get nets(): ReadonlyMap<string, SchematicNet> {
    return this._nets;
  }

  public addToken(token: VectorToken): void {
    this._tokens.push(token);
    this._spatialIndex.insert(token.bounds, token);
  }

  public addSymbol(symbol: SchematicSymbol): void {
    this._symbols.push(symbol);
  }

  public addNetLabel(netLabel: NetLabelMatch): void {
    this._netLabels.push(netLabel);
  }

  public addNet(net: SchematicNet): void {
    this._nets.set(net.name.toUpperCase(), net);
  }

  public queryPoint(x: number, y: number): VectorToken[] {
    return this._spatialIndex.queryPoint(x, y);
  }

  public queryBox(box: BoundingBox2D): VectorToken[] {
    return this._spatialIndex.queryBox(box);
  }

  public findNearestToken(x: number, y: number, maxRadius: number): VectorToken | undefined {
    return this._spatialIndex.findNearest(x, y, maxRadius);
  }

  public getSymbolByRefDes(refDes: string): SchematicSymbol | undefined {
    const norm = refDes.trim().toUpperCase();
    return this._symbols.find((s) => s.refDes.toUpperCase() === norm);
  }

  public getNetLabelsByName(netName: string): NetLabelMatch[] {
    const norm = netName.trim().toUpperCase();
    return this._netLabels.filter((l) => l.netName.toUpperCase() === norm);
  }
}
