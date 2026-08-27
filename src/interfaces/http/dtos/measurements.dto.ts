import { z } from "zod";
import { DiagnosticBoardState } from "../../../domain/measurements/value-objects/DiagnosticBoardState.js";

export const GetReferencesQuerySchema = z
  .object({
    board_id: z.string().min(1),
    pad_id: z.string().optional(),
    state: z.nativeEnum(DiagnosticBoardState).optional(),
  })
  .strict();

export const CreateReferenceSchema = z
  .object({
    board_id: z.string().min(1),
    pad_id: z.string().min(1),
    net_name: z.string().min(1),
    board_state: z.nativeEnum(DiagnosticBoardState),
    nominal: z.number(),
    min: z.number(),
    max: z.number(),
    tolerance_pct: z.number().optional(),
  })
  .strict();

export type CreateReferenceDto = z.infer<typeof CreateReferenceSchema>;

export const RecordMeasurementSchema = z
  .object({
    board_id: z.string().min(1),
    pad_id: z.string().min(1),
    board_state: z.nativeEnum(DiagnosticBoardState),
    reading_volts: z.number().optional(),
    reading_mv: z.number().optional(),
    meter_model: z.string().optional(),
  })
  .strict()
  .refine((data) => data.reading_volts !== undefined || data.reading_mv !== undefined, {
    message: "Either reading_volts or reading_mv must be provided.",
  });

export type RecordMeasurementDto = z.infer<typeof RecordMeasurementSchema>;
