import {
  ISchematicCrossProbeIndex,
  SchematicPinHit,
  BoardViewPadHit,
  SchematicCoordinateLookupResult,
} from "../../../domain/schematics/ports/ISchematicCrossProbeIndex.js";
import { NetLabelMatch } from "../../../domain/schematics/value-objects/NetLabelMatch.js";

export class CrossProbeLookupUseCase {
  constructor(private readonly crossProbeIndex: ISchematicCrossProbeIndex) {}

  public lookupByPin(refDes: string, pinNumber: string): SchematicPinHit[] {
    return this.crossProbeIndex.queryFromBoardViewPin(refDes, pinNumber);
  }

  public lookupByNet(netName: string): NetLabelMatch[] {
    return this.crossProbeIndex.queryFromBoardViewNet(netName);
  }

  public lookupByCoordinate(
    pageNumber: number,
    x: number,
    y: number
  ): SchematicCoordinateLookupResult {
    return this.crossProbeIndex.queryFromSchematicCoordinate(pageNumber, x, y);
  }
}
