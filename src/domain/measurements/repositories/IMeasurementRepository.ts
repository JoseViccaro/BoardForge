import { MeasurementProfile } from "../aggregates/MeasurementProfile.js";
import { BoardId } from "../../catalog/value-objects/BoardId.js";

export interface IMeasurementRepository {
  findById(id: string): Promise<MeasurementProfile | null>;
  findByBoardId(boardId: BoardId | string): Promise<MeasurementProfile | null>;
  save(profile: MeasurementProfile): Promise<void>;
}
