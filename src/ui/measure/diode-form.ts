import type { DiagnosticBoardState } from "../../domain/measurements/value-objects/DiagnosticBoardState.js";
import type { MultimeterProfile } from "../../domain/measurements/value-objects/MultimeterProfile.js";

/**
 * diode-form — pure DOM-free diode-mode form validation core (Unit 6C).
 *
 * Validates a diode-mode measurement submission (net/pin bound, meter profile,
 * board state, measured value) and returns either the normalized form state a
 * caller may submit to MeasurementLogStore.record(), or a validation error
 * listing the offending fields.
 *
 * Per measurements R1, the block-submit scenario: when the board state is unset,
 * the submission is BLOCKED with a validation error — the technician cannot
 * record a reading without knowing which board state the metered pin was probed
 * under (the reference lookup is keyed on pad + boardState).
 *
 * DOM-free and pure node-testable; MeasurementPanel is only a thin adapter.
 */

/** Raw form fields as captured by the MeasurementPanel before validation. */
export interface DiodeFormInput {
  /** Selected net (bound via the workbench selection bus). May be null. */
  net: string | null;
  /** Selected pin/pad (bound via the workbench selection bus). May be null. */
  pin: string | null;
  /** Technician-chosen diagnostic board state. null ⇒ unset / blocked. */
  boardState: DiagnosticBoardState | null;
  /** Meter used for the reading. null ⇒ no meter chosen. */
  meterProfile: MultimeterProfile | null;
  /** Raw value read off the meter, in volts. */
  measuredVolts: number;
}

/**
 * Normalized form state returned on success — the validated payload handed to
 * MeasurementLogStore.record() by the adapter. `normalizedVolts` is computed by
 * the meter profile so the adapter need not duplicate normalization.
 */
export interface NormalizedDiodeForm {
  net: string;
  pin: string;
  boardState: DiagnosticBoardState;
  meterModel: string;
  meterProfile: MultimeterProfile;
  measuredVolts: number;
  normalizedVolts: number;
}

export type DiodeFormValidation =
  | { ok: true; value: NormalizedDiodeForm }
  | { ok: false; errors: string[] };

/** Stable, machine-readable error codes for the offending fields. */
export const DIODE_FORM_ERRORS = {
  BOARD_STATE_REQUIRED: "board_state_required",
  NET_REQUIRED: "net_required",
  PIN_REQUIRED: "pin_required",
  METER_REQUIRED: "meter_required",
} as const;

/**
 * Validates a diode-form submission. Returns an `{ ok: true, value }` payload
 * with normalized volts when all required fields are present, or an
 * `{ ok: false, errors }` verdict listing every missing field. The adapter
 * surfaces `errors` to the user and never calls record() on a failed verdict.
 */
export function validateDiodeForm(input: DiodeFormInput): DiodeFormValidation {
  const errors: string[] = [];

  // Block-submit scenario (R1): no board state ⇒ no capture.
  if (input.boardState === null) {
    errors.push(DIODE_FORM_ERRORS.BOARD_STATE_REQUIRED);
  }
  if (input.net === null || input.net.trim().length === 0) {
    errors.push(DIODE_FORM_ERRORS.NET_REQUIRED);
  }
  if (input.pin === null || input.pin.trim().length === 0) {
    errors.push(DIODE_FORM_ERRORS.PIN_REQUIRED);
  }
  if (input.meterProfile === null) {
    errors.push(DIODE_FORM_ERRORS.METER_REQUIRED);
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    value: {
      net: input.net!.trim(),
      pin: input.pin!.trim(),
      boardState: input.boardState!,
      meterModel: input.meterProfile!.name,
      meterProfile: input.meterProfile!,
      measuredVolts: input.measuredVolts,
      normalizedVolts: input.meterProfile!.normalize(input.measuredVolts),
    },
  };
}
