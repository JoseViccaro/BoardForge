import { describe, it, expect, beforeEach } from "vitest";
import { EvaluateDiodeMeasurementHandler } from "../../../src/application/measurements/commands/EvaluateDiodeMeasurementHandler.js";
import { MeasurementProfile } from "../../../src/domain/measurements/aggregates/MeasurementProfile.js";
import { MeasurementReference } from "../../../src/domain/measurements/entities/MeasurementReference.js";
import { DiagnosticBoardState } from "../../../src/domain/measurements/value-objects/DiagnosticBoardState.js";
import { EvaluationOutcome } from "../../../src/domain/measurements/value-objects/EvaluationOutcome.js";
import { IMeasurementRepository } from "../../../src/domain/measurements/repositories/IMeasurementRepository.js";

class InMemoryMeasurementRepo implements IMeasurementRepository {
  private items = new Map<string, MeasurementProfile>();
  async findById(id: string): Promise<MeasurementProfile | null> {
    return this.items.get(id) ?? null;
  }
  async findByBoardId(boardId: any): Promise<MeasurementProfile | null> {
    const key = typeof boardId === "string" ? boardId : boardId.value;
    for (const p of this.items.values()) {
      if (p.boardId.value === key) return p;
    }
    return null;
  }
  async save(profile: MeasurementProfile): Promise<void> {
    this.items.set(profile.id, profile);
  }
}

describe("EvaluateDiodeMeasurementHandler Integration Test", () => {
  let repo: InMemoryMeasurementRepo;
  let handler: EvaluateDiodeMeasurementHandler;

  beforeEach(() => {
    repo = new InMemoryMeasurementRepo();
    handler = new EvaluateDiodeMeasurementHandler(repo);
  });

  it("should execute EvaluateDiodeMeasurementHandler command and return DiodeEvaluationResultDto", async () => {
    const profile = new MeasurementProfile({
      id: "MEAS_820_02106",
      boardId: "BRD_820_02106",
      title: "iPhone 13 Profile",
      references: [
        new MeasurementReference({
          id: "REF_084",
          padId: "INT_PAD_084",
          netName: "PP_VDD_MAIN",
          boardState: DiagnosticBoardState.SPLIT_TOP,
          nominal: 0.425,
          tolerancePct: 7.0,
        }),
      ],
    });
    await repo.save(profile);

    const result = await handler.execute({
      boardId: "BRD_820_02106",
      padId: "INT_PAD_084",
      boardState: DiagnosticBoardState.SPLIT_TOP,
      measuredVolts: 0.418,
    });

    expect(result.outcome).toBe(EvaluationOutcome.PASS);
    expect(result.isPass).toBe(true);
    expect(result.deviationPct).toBeCloseTo(-1.65, 1);
  });
});
