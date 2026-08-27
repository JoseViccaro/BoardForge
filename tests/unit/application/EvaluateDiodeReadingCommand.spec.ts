import { describe, it, expect, beforeEach } from "vitest";
import { MeasurementProfile } from "../../../src/domain/measurements/aggregates/MeasurementProfile.js";
import { MeasurementReference } from "../../../src/domain/measurements/entities/MeasurementReference.js";
import { DiagnosticBoardState } from "../../../src/domain/measurements/value-objects/DiagnosticBoardState.js";
import { EvaluationOutcome } from "../../../src/domain/measurements/value-objects/EvaluationOutcome.js";
import { MultimeterProfile } from "../../../src/domain/measurements/value-objects/MultimeterProfile.js";
import { IMeasurementRepository } from "../../../src/domain/measurements/repositories/IMeasurementRepository.js";
import {
  EvaluateDiodeReadingCommand,
  EvaluateDiodeMeasurementHandler,
} from "../../../src/application/measurements/commands/EvaluateDiodeMeasurementHandler.js";

class MockMeasurementRepository implements IMeasurementRepository {
  private profiles = new Map<string, MeasurementProfile>();

  async findById(id: string): Promise<MeasurementProfile | null> {
    return this.profiles.get(id) ?? null;
  }

  async findByBoardId(boardId: any): Promise<MeasurementProfile | null> {
    const key = typeof boardId === "string" ? boardId : boardId.value;
    for (const p of this.profiles.values()) {
      if (p.boardId.value === key) return p;
    }
    return null;
  }

  async save(profile: MeasurementProfile): Promise<void> {
    this.profiles.set(profile.id, profile);
  }
}

describe("EvaluateDiodeMeasurementHandler", () => {
  let repository: MockMeasurementRepository;
  let handler: EvaluateDiodeMeasurementHandler;

  beforeEach(() => {
    repository = new MockMeasurementRepository();
    handler = new EvaluateDiodeMeasurementHandler(repository);
  });

  it("should evaluate diode reading successfully against reference", async () => {
    const profile = new MeasurementProfile({
      id: "MEAS_820_02106",
      boardId: "BRD_820_02106",
      title: "iPhone 13 Reference Profile",
      references: [
        new MeasurementReference({
          id: "REF_084_SPLIT_TOP",
          padId: "INT_PAD_084",
          netName: "PP_VDD_MAIN",
          boardState: DiagnosticBoardState.SPLIT_TOP,
          nominal: 0.425,
          tolerancePct: 7.0,
        }),
      ],
    });
    await repository.save(profile);

    const command: EvaluateDiodeReadingCommand = {
      boardId: "BRD_820_02106",
      padId: "INT_PAD_084",
      boardState: DiagnosticBoardState.SPLIT_TOP,
      measuredVolts: 0.418,
    };

    const result = await handler.execute(command);

    expect(result).toBeDefined();
    expect(result.outcome).toBe(EvaluationOutcome.PASS);
    expect(result.isPass).toBe(true);
    expect(result.measuredVolts).toBe(0.418);
    expect(result.nominalVolts).toBe(0.425);
    expect(result.padId).toBe("INT_PAD_084");
    expect(result.netName).toBe("PP_VDD_MAIN");
  });

  it("should apply meterProfile calibration normalization when provided", async () => {
    const profile = new MeasurementProfile({
      id: "MEAS_820_02106",
      boardId: "BRD_820_02106",
      title: "iPhone 13 Reference Profile",
      references: [
        new MeasurementReference({
          id: "REF_084_SPLIT_TOP",
          padId: "INT_PAD_084",
          netName: "PP_VDD_MAIN",
          boardState: DiagnosticBoardState.SPLIT_TOP,
          nominal: 0.425,
          min: 0.395,
          max: 0.455,
        }),
      ],
    });
    await repository.save(profile);

    const command: EvaluateDiodeReadingCommand = {
      boardId: "BRD_820_02106",
      padId: "INT_PAD_084",
      boardState: DiagnosticBoardState.SPLIT_TOP,
      measuredVolts: 0.380,
      meterProfile: {
        meterModel: "SUNSHINE_DT17N",
        scaleFactor: 1.0,
        offsetVolts: 0.035,
      },
    };

    const result = await handler.execute(command);

    expect(result.normalizedVolts).toBe(0.415);
    expect(result.outcome).toBe(EvaluationOutcome.PASS);
    expect(result.isPass).toBe(true);
  });

  it("should throw error if measurement reference is not found", async () => {
    const profile = new MeasurementProfile({
      id: "MEAS_820_02106",
      boardId: "BRD_820_02106",
      title: "iPhone 13 Reference Profile",
    });
    await repository.save(profile);

    const command: EvaluateDiodeReadingCommand = {
      boardId: "BRD_820_02106",
      padId: "NON_EXISTING_PAD",
      boardState: DiagnosticBoardState.SPLIT_TOP,
      measuredVolts: 0.425,
    };

    await expect(handler.execute(command)).rejects.toThrow("Measurement reference not found");
  });
});
