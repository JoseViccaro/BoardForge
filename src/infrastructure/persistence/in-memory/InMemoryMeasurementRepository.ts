import { MeasurementProfile } from "../../../domain/measurements/aggregates/MeasurementProfile.js";
import { BoardId } from "../../../domain/catalog/value-objects/BoardId.js";
import { IMeasurementRepository } from "../../../domain/measurements/repositories/IMeasurementRepository.js";

export class InMemoryMeasurementRepository implements IMeasurementRepository {
  private readonly _profiles: Map<string, MeasurementProfile> = new Map();

  public async findById(id: string): Promise<MeasurementProfile | null> {
    return this._profiles.get(id) ?? null;
  }

  public async findByBoardId(boardId: BoardId | string): Promise<MeasurementProfile | null> {
    const key = boardId instanceof BoardId ? boardId.value : boardId;
    for (const profile of this._profiles.values()) {
      if (profile.boardId.value === key) {
        return profile;
      }
    }
    return null;
  }

  public async save(profile: MeasurementProfile): Promise<void> {
    this._profiles.set(profile.id, profile);
  }

  public clear(): void {
    this._profiles.clear();
  }
}
