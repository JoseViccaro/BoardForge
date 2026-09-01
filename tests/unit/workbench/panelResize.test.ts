import { describe, it, expect } from "vitest";
import {
  computePanelWidths,
  dividerOffsetFromWidth,
  DEFAULT_MIN_PANEL_WIDTH,
  type ResizeConstraints,
} from "../../../src/ui/workbench/panelResize.js";

/**
 * Unit D5 — Panel resize pure core (RED → GREEN tests).
 *
 * Tests the DOM-free computePanelWidths and dividerOffsetFromWidth functions
 * that compute clamped panel widths from a divider offset. The shell adapter
 * translates pointer events into these pure calls.
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const C = (minLeft = 180, minRight = 180): ResizeConstraints => ({
  minLeft,
  minRight,
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("panelResize — computePanelWidths", () => {
  // ---- Normal cases -------------------------------------------------------

  it("splits evenly when divider is at the center", () => {
    const result = computePanelWidths(1000, 500);
    expect(result).toEqual({ leftWidth: 500, rightWidth: 500 });
  });

  it("gives left panel more space when divider is right of center", () => {
    const result = computePanelWidths(1000, 700);
    expect(result).toEqual({ leftWidth: 700, rightWidth: 300 });
  });

  it("gives right panel more space when divider is left of center", () => {
    const result = computePanelWidths(1000, 300);
    expect(result).toEqual({ leftWidth: 300, rightWidth: 700 });
  });

  // ---- Left panel clamping ------------------------------------------------

  it("clamps left panel to minLeft when divider is too far left", () => {
    const result = computePanelWidths(1000, 50, C());
    expect(result).toEqual({ leftWidth: 180, rightWidth: 820 });
  });

  it("clamps left panel at exactly minLeft boundary", () => {
    const result = computePanelWidths(1000, 180, C());
    expect(result).toEqual({ leftWidth: 180, rightWidth: 820 });
  });

  it("does not clamp when divider is just above minLeft", () => {
    const result = computePanelWidths(1000, 181, C());
    expect(result).toEqual({ leftWidth: 181, rightWidth: 819 });
  });

  // ---- Right panel clamping -----------------------------------------------

  it("clamps right panel to minRight when divider is too far right", () => {
    const result = computePanelWidths(1000, 950, C());
    expect(result).toEqual({ leftWidth: 820, rightWidth: 180 });
  });

  it("clamps right panel at exactly minRight boundary", () => {
    const result = computePanelWidths(1000, 820, C());
    expect(result).toEqual({ leftWidth: 820, rightWidth: 180 });
  });

  it("does not clamp when divider is just below max boundary", () => {
    const result = computePanelWidths(1000, 819, C());
    expect(result).toEqual({ leftWidth: 819, rightWidth: 181 });
  });

  // ---- Edge cases ---------------------------------------------------------

  it("clamps negative divider offset to minLeft", () => {
    const result = computePanelWidths(1000, -200);
    expect(result).toEqual({ leftWidth: 180, rightWidth: 820 });
  });

  it("clamps divider offset beyond container width", () => {
    const result = computePanelWidths(1000, 1500);
    expect(result).toEqual({ leftWidth: 820, rightWidth: 180 });
  });

  it("handles zero divider offset", () => {
    const result = computePanelWidths(1000, 0);
    expect(result).toEqual({ leftWidth: 180, rightWidth: 820 });
  });

  it("handles divider offset equal to container width", () => {
    const result = computePanelWidths(1000, 1000);
    expect(result).toEqual({ leftWidth: 820, rightWidth: 180 });
  });

  // ---- Invariants ---------------------------------------------------------

  it("leftWidth + rightWidth always equals containerWidth", () => {
    const widths = [-100, 0, 100, 400, 500, 600, 900, 1100];
    for (const offset of widths) {
      const result = computePanelWidths(1000, offset);
      expect(result.leftWidth + result.rightWidth).toBe(1000);
    }
  });

  it("neither panel is ever below minLeft or minRight", () => {
    const offsets = [-500, -1, 0, 1, 50, 500, 950, 999, 1000, 1500];
    for (const offset of offsets) {
      const result = computePanelWidths(1000, offset, C(200, 250));
      expect(result.leftWidth).toBeGreaterThanOrEqual(200);
      expect(result.rightWidth).toBeGreaterThanOrEqual(250);
    }
  });

  // ---- Small container (fast path) ----------------------------------------

  it("returns minLeft when container is narrower than both minimums", () => {
    const result = computePanelWidths(300, 150, C(200, 200));
    expect(result).toEqual({ leftWidth: 200, rightWidth: 100 });
  });

  it("returns minLeft when container equals minLeft + minRight", () => {
    const result = computePanelWidths(400, 200, C(200, 200));
    expect(result).toEqual({ leftWidth: 200, rightWidth: 200 });
  });

  // ---- Custom constraints -------------------------------------------------

  it("respects asymmetric minimum widths", () => {
    const result = computePanelWidths(1000, 100, C(300, 100));
    expect(result).toEqual({ leftWidth: 300, rightWidth: 700 });
  });

  it("respects asymmetric minimum widths (right heavy)", () => {
    const result = computePanelWidths(1000, 900, C(100, 300));
    expect(result).toEqual({ leftWidth: 700, rightWidth: 300 });
  });
});

describe("panelResize — dividerOffsetFromWidth", () => {
  it("returns the left width when within bounds", () => {
    expect(dividerOffsetFromWidth(500, 1000)).toBe(500);
  });

  it("clamps to minLeft when left width is too small", () => {
    expect(dividerOffsetFromWidth(50, 1000)).toBe(DEFAULT_MIN_PANEL_WIDTH);
  });

  it("clamps to max when left width would leave right panel too narrow", () => {
    expect(dividerOffsetFromWidth(950, 1000)).toBe(820);
  });

  it("roundtrips: dividerOffsetFromWidth(width, W) produces a width that computePanelWidths would use", () => {
    const W = 1000;
    const desired = 600;
    const offset = dividerOffsetFromWidth(desired, W);
    const { leftWidth } = computePanelWidths(W, offset);
    expect(leftWidth).toBe(desired);
  });
});
