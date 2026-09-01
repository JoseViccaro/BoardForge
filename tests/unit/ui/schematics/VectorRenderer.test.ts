/**
 * PR 3A (boardforge-redesign) — VectorRenderer core: tokens → draw commands.
 * Strict-TDD RED specs.
 *
 * Pure logic tests (no DOM, node env): the renderer takes VectorTokens and
 * emits draw commands onto a Draw2D context. A recording double captures
 * every call so we can assert exact placement, font, and page-filtering.
 */
import { describe, it, expect } from "vitest";
import { VectorToken, TokenType } from "../../../../src/domain/schematics/value-objects/VectorToken.js";
import { BoundingBox2D } from "../../../../src/domain/schematics/value-objects/BoundingBox2D.js";
import { renderPage, type Draw2D } from "../../../../src/ui/schematics/VectorRenderer.js";

// ---------------------------------------------------------------------------
// Recording Draw2D double — captures every canvas call verbatim
// ---------------------------------------------------------------------------

interface DrawCall {
  method: string;
  args: unknown[];
}

interface RecordedDraw2D {
  ctx: Draw2D;
  calls: DrawCall[];
  fontStack: string[];
  textAlignStack: string[];
  textBaselineStack: string[];
  count(method: string): number;
  callsLike(method: string): DrawCall[];
}

function makeRecordingDraw2D(): RecordedDraw2D {
  const calls: DrawCall[] = [];
  const fontStack: string[] = [];
  const textAlignStack: string[] = [];
  const textBaselineStack: string[] = [];

  const ctx: Draw2D = {
    save() {
      calls.push({ method: "save", args: [] });
    },
    restore() {
      calls.push({ method: "restore", args: [] });
    },
    clearRect(x: number, y: number, w: number, h: number) {
      calls.push({ method: "clearRect", args: [x, y, w, h] });
    },
    fillText(text: string, x: number, y: number) {
      calls.push({ method: "fillText", args: [text, x, y] });
    },
    get font(): string {
      return fontStack[fontStack.length - 1] ?? "";
    },
    set font(v: string) {
      fontStack.push(v);
    },
    get fillStyle(): string {
      return "#000";
    },
    set fillStyle(_v: string) {
      /* ignored by assertions */
    },
    get textAlign(): string {
      return textAlignStack[textAlignStack.length - 1] ?? "start";
    },
    set textAlign(v: string) {
      textAlignStack.push(v);
    },
    get textBaseline(): string {
      return textBaselineStack[textBaselineStack.length - 1] ?? "alphabetic";
    },
    set textBaseline(v: string) {
      textBaselineStack.push(v);
    },
  };

  return {
    ctx,
    calls,
    fontStack,
    textAlignStack,
    textBaselineStack,
    count: (method) => calls.filter((c) => c.method === method).length,
    callsLike: (method) => calls.filter((c) => c.method === method),
  };
}

// ---------------------------------------------------------------------------
// Helpers — build VectorTokens quickly
// ---------------------------------------------------------------------------

function token(
  text: string,
  page: number,
  x: number,
  y: number,
  w: number,
  h: number,
  fontSize = 12,
  tokenType: TokenType = TokenType.TEXT,
): VectorToken {
  return new VectorToken({
    text,
    pageNumber: page,
    bounds: new BoundingBox2D(x, y, x + w, y + h),
    fontSize,
    tokenType,
  });
}

// R1 scenario 1 fixture — parsed schematic page 12 with U2700, PP_VDD_MAIN, A12
function makePage12Tokens(): VectorToken[] {
  return [
    token("U2700", 12, 100, 200, 60, 16, 14, TokenType.DESIGNATOR),
    token("PP_VDD_MAIN", 12, 100, 220, 100, 12, 10, TokenType.NET_LABEL),
    token("A12", 12, 300, 400, 30, 12, 9, TokenType.PIN_NUM),
  ];
}

function makeMultiPageTokens(): VectorToken[] {
  return [
    token("U2700", 12, 100, 200, 60, 16, 14, TokenType.DESIGNATOR),
    token("R5", 13, 50, 80, 30, 12, 10, TokenType.DESIGNATOR),
    token("C1", 14, 200, 300, 25, 12, 10, TokenType.DESIGNATOR),
  ];
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("VectorRenderer — renderPage", () => {
  describe("BoundingBox2D placement (R1: renders page from tokens)", () => {
    it("renders U2700, PP_VDD_MAIN, and A12 at their bounds.minX/minY on page 12", () => {
      const draw = makeRecordingDraw2D();

      const result = renderPage(makePage12Tokens(), 12, draw.ctx, 800, 600);

      const fillTexts = draw.callsLike("fillText");
      // 3 tokens, no indicator
      expect(fillTexts.length).toBe(3);
      expect(fillTexts[0].args).toEqual(["U2700", 100, 200]);
      expect(fillTexts[1].args).toEqual(["PP_VDD_MAIN", 100, 220]);
      expect(fillTexts[2].args).toEqual(["A12", 300, 400]);
      // RenderResult contract on the happy path
      expect(result.tokenCount).toBe(3);
      expect(result.indicatorDrawn).toBe(false);
    });

    it("places a single token at its exact decimal bounds", () => {
      const draw = makeRecordingDraw2D();

      renderPage([token("TEST", 1, 42.5, 73.25, 40, 14)], 1, draw.ctx, 800, 600);

      const fillTexts = draw.callsLike("fillText");
      expect(fillTexts.length).toBe(1);
      expect(fillTexts[0].args).toEqual(["TEST", 42.5, 73.25]);
    });

    it("only renders tokens belonging to the requested page number", () => {
      const draw = makeRecordingDraw2D();

      renderPage(makeMultiPageTokens(), 13, draw.ctx, 800, 600);

      const tokenTexts = draw.callsLike("fillText").map((c) => c.args[0]);
      expect(tokenTexts).toEqual(["R5"]);
    });

    it("clears the canvas to the page dimensions before drawing", () => {
      const draw = makeRecordingDraw2D();

      renderPage(makePage12Tokens(), 12, draw.ctx, 800, 600);

      const clearCalls = draw.callsLike("clearRect");
      expect(clearCalls).toHaveLength(1);
      expect(clearCalls[0].args).toEqual([0, 0, 800, 600]);
    });

    it("sets the font from the token's fontSize and applies text anchor styling", () => {
      const draw = makeRecordingDraw2D();

      renderPage([token("RESISTOR", 1, 0, 0, 80, 14, 16)], 1, draw.ctx, 800, 600);

      expect(draw.fontStack[0]).toContain("16px");
      // anchors are set before the token draw, not after
      expect(draw.textAlignStack[0]).toBe("left");
      expect(draw.textBaselineStack[0]).toBe("top");
    });
  });

  describe("missing page (R1: empty canvas + page-not-found + no exception)", () => {
    it("renders no tokens and draws a page-not-found indicator for an absent page", () => {
      const draw = makeRecordingDraw2D();

      const result = renderPage(makePage12Tokens(), 99, draw.ctx, 800, 600);

      // Canvas cleared, then ONLY the indicator text
      expect(draw.count("clearRect")).toBe(1);
      const fillTexts = draw.callsLike("fillText");
      expect(fillTexts.length).toBe(1);
      expect(fillTexts[0].args[0] as string).toContain("99");
      expect(result.tokenCount).toBe(0);
      expect(result.indicatorDrawn).toBe(true);
    });

    it("never throws, including for out-of-range and non-positive page numbers", () => {
      const draw = makeRecordingDraw2D();

      for (const page of [0, -1, 999, 1.5]) {
        expect(() => {
          renderPage(makePage12Tokens(), page, draw.ctx, 800, 600);
        }).not.toThrow();
      }
    });

    it("renders only the page indicator when the token list is empty", () => {
      const draw = makeRecordingDraw2D();

      const result = renderPage([], 1, draw.ctx, 800, 600);

      expect(result.tokenCount).toBe(0);
      expect(result.indicatorDrawn).toBe(true);
      expect(draw.count("fillText")).toBe(1);
    });
  });
});