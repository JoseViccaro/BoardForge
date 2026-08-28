/**
 * VectorRenderer — pure tokens → draw commands.
 *
 * DOM-free, React-free.  Takes VectorToken[] and emits calls onto a
 * Draw2D context (structural port of CanvasRenderingContext2D).  Testable
 * in node via a recording double.
 */
import type { VectorToken } from "../../domain/schematics/value-objects/VectorToken.js";

// ---------------------------------------------------------------------------
// Draw2D port — same shape as extract-render.ts Draw2D (PR 2)
// ---------------------------------------------------------------------------

export interface Draw2D {
  save(): void;
  restore(): void;
  clearRect(x: number, y: number, w: number, h: number): void;
  fillText(text: string, x: number, y: number): void;
  fillStyle: string;
  font: string;
  textAlign: string;
  textBaseline: string;
}

// ---------------------------------------------------------------------------
// Render result — returned so callers can inspect what happened
// ---------------------------------------------------------------------------

export interface RenderResult {
  tokenCount: number;
  indicatorDrawn: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TOKEN_FONT_FAMILY = "monospace";
const INDICATOR_FONT = "14px monospace";
const INDICATOR_FILL_STYLE = "#999";
const INDICATOR_TEXT_BASELINE = "top";

// ---------------------------------------------------------------------------
// renderPage — the pure core
// ---------------------------------------------------------------------------

/**
 * Render all VectorTokens for `pageNumber` onto `ctx`.
 *
 * 1. Clears the full page.
 * 2. For each token matching `pageNumber`: sets font → fillText at
 *    bounds.minX / bounds.minY.
 * 3. If the page has zero matching tokens (including empty list or
 *    out-of-range page number) → draws a page-not-found indicator.
 *
 * Does NOT throw for missing pages — returns empty result + indicator.
 */
export function renderPage(
  tokens: readonly VectorToken[],
  pageNumber: number,
  ctx: Draw2D,
  pageWidth: number,
  pageHeight: number,
): RenderResult {
  // 1. Clear canvas
  ctx.clearRect(0, 0, pageWidth, pageHeight);

  // 2. Filter tokens to the requested page
  const pageTokens = tokens.filter((t) => t.pageNumber === pageNumber);

  // 3. Draw each token at its BoundingBox2D position
  for (const token of pageTokens) {
    ctx.save();
    ctx.font = `${token.fontSize}px ${token.fontFamily ?? TOKEN_FONT_FAMILY}`;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(token.text, token.bounds.minX, token.bounds.minY);
    ctx.restore();
  }

  // 4. Missing-page indicator
  if (pageTokens.length === 0) {
    ctx.save();
    ctx.font = INDICATOR_FONT;
    ctx.fillStyle = INDICATOR_FILL_STYLE;
    ctx.textAlign = "center";
    ctx.textBaseline = INDICATOR_TEXT_BASELINE;
    ctx.fillText(`Page ${pageNumber} not found`, pageWidth / 2, pageHeight / 2);
    ctx.restore();

    return { tokenCount: 0, indicatorDrawn: true };
  }

  return { tokenCount: pageTokens.length, indicatorDrawn: false };
}
