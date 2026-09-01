import { describe, it, expect } from "vitest";
import {
  validateDiodeForm,
  type DiodeFormInput,
} from "../../../../src/ui/measure/diode-form.js";
import { DiagnosticBoardState } from "../../../../src/domain/measurements/value-objects/DiagnosticBoardState.js";
import { MultimeterProfile } from "../../../../src/domain/measurements/value-objects/MultimeterProfile.js";

describe("validateDiodeForm (measurements R1 — diode form validation core)", () => {
  /** Fully valid input — the happy path baseline. */
  function validInput(): DiodeFormInput {
    return {
      net: "PP_VDD_MAIN",
      pin: "INT_PAD_084",
      boardState: DiagnosticBoardState.SPLIT_TOP,
      meterProfile: MultimeterProfile.FLUKE_115_STANDARD,
      measuredVolts: 0.42,
    };
  }

  it("blocks submit when board state is unset", () => {
    const result = validateDiodeForm({ ...validInput(), boardState: null });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors).toContain("board_state_required");
    }
  });

  it("blocks submit when net is missing", () => {
    const result = validateDiodeForm({ ...validInput(), net: null });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors).toContain("net_required");
    }
  });

  it("blocks submit when pin is missing", () => {
    const result = validateDiodeForm({ ...validInput(), pin: null });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors).toContain("pin_required");
    }
  });

  it("blocks submit when meter profile is missing", () => {
    const result = validateDiodeForm({ ...validInput(), meterProfile: null });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors).toContain("meter_required");
    }
  });

  it("succeeds with normalized values when all fields are valid", () => {
    const result = validateDiodeForm({
      ...validInput(),
      meterProfile: MultimeterProfile.SUNSHINE_DT17N, // offset = +0.035
      measuredVolts: 0.38,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.net).toBe("PP_VDD_MAIN");
      expect(result.value.pin).toBe("INT_PAD_084");
      expect(result.value.boardState).toBe(DiagnosticBoardState.SPLIT_TOP);
      expect(result.value.meterModel).toBe("SUNSHINE_DT17N");
      expect(result.value.measuredVolts).toBe(0.38);
      expect(result.value.normalizedVolts).toBe(0.415); // 0.380 + 0.035
    }
  });
});
