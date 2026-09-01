/**
 * Pure DOM-free panel resize core (Design D5 — interactive splitter).
 *
 * Computes left/right panel widths from a container width and divider offset,
 * enforcing minimum and maximum constraints per panel. All math lives here;
 * the shell is a zero-logic adapter that translates pointer events into calls
 * to these functions and applies the result to the DOM.
 *
 * Follows the same pure-core pattern as keyboardShortcuts.ts (Unit 4B):
 * no DOM access, no React, fully unit-testable in Node.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Computed panel widths (pixels) after clamping. */
export interface PanelWidths {
  leftWidth: number;
  rightWidth: number;
}

/** Constraints governing the resize interaction. */
export interface ResizeConstraints {
  /** Minimum width (px) for the left panel. */
  minLeft: number;
  /** Minimum width (px) for the right panel. */
  minRight: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Default minimum panel width — consistent with typical sidebar thresholds. */
export const DEFAULT_MIN_PANEL_WIDTH = 180;

/** Default constraints using the default minimum for both panels. */
export const DEFAULT_CONSTRAINTS: ResizeConstraints = {
  minLeft: DEFAULT_MIN_PANEL_WIDTH,
  minRight: DEFAULT_MIN_PANEL_WIDTH,
};

// ---------------------------------------------------------------------------
// Core functions
// ---------------------------------------------------------------------------

/**
 * Computes clamped left/right panel widths from a divider offset within a
 * container.
 *
 * @param containerWidth - total available width of the container (px).
 * @param dividerOffset  - pixel offset of the divider's left edge from the
 *                         container's left edge. May be outside [0, containerWidth].
 * @param constraints    - min-width constraints for each panel.
 * @returns clamped leftWidth and rightWidth that sum exactly to containerWidth
 *          and respect both minLeft and minRight.
 */
export function computePanelWidths(
  containerWidth: number,
  dividerOffset: number,
  constraints: ResizeConstraints = DEFAULT_CONSTRAINTS,
): PanelWidths {
  const { minLeft, minRight } = constraints;

  // Fast path: container too narrow for both mins — split evenly at the
  // smallest possible sizes. This can happen during window resize.
  if (containerWidth <= minLeft + minRight) {
    return { leftWidth: minLeft, rightWidth: containerWidth - minLeft };
  }

  // Clamp the divider offset so neither panel shrinks below its minimum.
  const clamped = Math.max(minLeft, Math.min(containerWidth - minRight, dividerOffset));

  return {
    leftWidth: clamped,
    rightWidth: containerWidth - clamped,
  };
}

/**
 * Derives a divider offset (px from left) from a known left panel width.
 * Useful when restoring persisted panel geometry: the session stores a width,
 * and the shell needs the corresponding divider offset for pointer tracking.
 *
 * @param leftWidth - desired left panel width (px).
 * @param containerWidth - total container width (px).
 * @param constraints - same constraints used by computePanelWidths.
 * @returns clamped divider offset.
 */
export function dividerOffsetFromWidth(
  leftWidth: number,
  containerWidth: number,
  constraints: ResizeConstraints = DEFAULT_CONSTRAINTS,
): number {
  return computePanelWidths(containerWidth, leftWidth, constraints).leftWidth;
}
