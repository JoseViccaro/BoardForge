import { IMeasurementRepository } from "../../../domain/measurements/repositories/IMeasurementRepository.js";
import { DiagnosticBoardState } from "../../../domain/measurements/value-objects/DiagnosticBoardState.js";
import { MultimeterProfile, MultimeterProfileProps } from "../../../domain/measurements/value-objects/MultimeterProfile.js";
import { DiodeReading } from "../../../domain/measurements/value-objects/DiodeReading.js";
import { DiodeModeEvaluator } from "../../../domain/measurements/services/DiodeModeEvaluator.js";
import { DiodeEvaluationResultDto } from "../dtos/DiodeEvaluationResultDto.js";

export interface EvaluateDiodeReadingCommand {
  boardId: string;
  padId: string;
  boardState: DiagnosticBoardState;
  measuredVolts: number;
  meterProfile?: MultimeterProfileProps | MultimeterProfile;
}

export class EvaluateDiodeMeasurementHandler {
  private readonly evaluator = new DiodeModeEvaluator();

  constructor(private readonly measurementRepository: IMeasurementRepository) {}

  public async execute(command: EvaluateDiodeReadingCommand): Promise<DiodeEvaluationResultDto> {
    const profile = await this.measurementRepository.findByBoardId(command.boardId);
    if (!profile) {
      throw new Error(`Measurement profile not found for board: ${command.boardId}`);
    }

    const reference = profile.getReference(command.padId, command.boardState);
    if (!reference) {
      throw new Error(
        `Measurement reference not found for pad: ${command.padId} in state: ${command.boardState}`
      );
    }

    let meterProfileObj: MultimeterProfile | undefined;
    if (command.meterProfile) {
      if (command.meterProfile instanceof MultimeterProfile) {
        meterProfileObj = command.meterProfile;
      } else if (typeof command.meterProfile === "object") {
        meterProfileObj = new MultimeterProfile(
          command.meterProfile.meterModel,
          command.meterProfile.scaleFactor ?? 1.0,
          command.meterProfile.offsetVolts ?? 0.0
        );
      }
    }

    const isOpenLoop = command.measuredVolts >= 2.500;
    const reading = new DiodeReading(command.measuredVolts, isOpenLoop, meterProfileObj);

    const result = this.evaluator.evaluate(reading, reference, meterProfileObj);

    return {
      outcome: result.outcome,
      isPass: result.isPass,
      measuredVolts: result.measuredVolts,
      normalizedVolts: result.normalizedVolts,
      nominalVolts: result.nominalVolts,
      deviationPct: result.deviationPct,
      message: result.message,
      padId: result.padId,
      netName: result.netName,
    };
  }
}
