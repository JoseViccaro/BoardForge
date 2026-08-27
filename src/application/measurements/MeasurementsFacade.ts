import { IMeasurementRepository } from "../../domain/measurements/repositories/IMeasurementRepository.js";
import { EvaluateDiodeMeasurementHandler } from "./commands/EvaluateDiodeMeasurementHandler.js";
import { DiodeEvaluationResultDto } from "./dtos/DiodeEvaluationResultDto.js";
import { DiagnosticBoardState } from "../../domain/measurements/value-objects/DiagnosticBoardState.js";
import { MeasurementProfile } from "../../domain/measurements/aggregates/MeasurementProfile.js";
import { MeasurementReference } from "../../domain/measurements/entities/MeasurementReference.js";
import { CreateReferenceDto, RecordMeasurementDto } from "../../interfaces/http/dtos/measurements.dto.js";
import { EntityNotFoundError } from "../../interfaces/http/errors/HttpErrors.js";

export class MeasurementsFacade {
  private readonly evaluateHandler: EvaluateDiodeMeasurementHandler;

  constructor(private readonly measurementRepo: IMeasurementRepository) {
    this.evaluateHandler = new EvaluateDiodeMeasurementHandler(measurementRepo);
  }

  public async getReferences(
    boardId: string,
    padId?: string,
    state?: DiagnosticBoardState,
    organizationId?: string
  ): Promise<{ references: any[] }> {
    const profile = await this.measurementRepo.findByBoardId(boardId);
    if (!profile) {
      throw new EntityNotFoundError(`Measurement profile for board '${boardId}' not found.`);
    }

    const filtered = profile.references.filter((ref) => {
      if (padId && ref.padId !== padId) return false;
      if (state && ref.boardState !== state) return false;
      return true;
    });

    return {
      references: filtered.map((r) => ({
        id: r.id,
        padId: r.padId,
        netName: r.netName,
        boardState: r.boardState,
        nominal: r.nominal,
        min: r.min,
        max: r.max,
        tolerancePct: r.tolerancePct,
      })),
    };
  }

  public async createReference(
    dto: CreateReferenceDto,
    organizationId?: string
  ): Promise<any> {
    let profile = await this.measurementRepo.findByBoardId(dto.board_id);
    if (!profile) {
      profile = new MeasurementProfile({
        id: `MEAS_${dto.board_id}`,
        boardId: dto.board_id,
        title: `Measurement profile for ${dto.board_id}`,
        baseline: "FLUKE_115_STANDARD",
        references: [],
      });
    }

    const ref = new MeasurementReference({
      id: `REF_${dto.pad_id}_${dto.board_state}`,
      padId: dto.pad_id,
      netName: dto.net_name,
      boardState: dto.board_state,
      nominal: dto.nominal,
      min: dto.min,
      max: dto.max,
      tolerancePct: dto.tolerance_pct ?? 10.0,
    });

    profile.addReference(ref);
    await this.measurementRepo.save(profile);

    return {
      id: ref.id,
      padId: ref.padId,
      netName: ref.netName,
      boardState: ref.boardState,
      nominal: ref.nominal,
      min: ref.min,
      max: ref.max,
      tolerancePct: ref.tolerancePct,
    };
  }

  public async recordMeasurement(
    dto: RecordMeasurementDto,
    organizationId?: string
  ): Promise<DiodeEvaluationResultDto> {
    const volts =
      dto.reading_volts !== undefined ? dto.reading_volts : (dto.reading_mv as number) / 1000.0;

    return await this.evaluateHandler.execute({
      boardId: dto.board_id,
      padId: dto.pad_id,
      boardState: dto.board_state,
      measuredVolts: volts,
      meterProfile: dto.meter_model ? { meterModel: dto.meter_model } : undefined,
    });
  }
}
