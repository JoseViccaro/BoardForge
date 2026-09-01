/**
 * HitTester — pure spatial index over VectorToken bounds.
 *
 * DOM-free, React-free.  Maps a schematic page coordinate back to the
 * VectorToken under the cursor (schematics R2 prerequisite: coord → token),
 * and answers rect queries for marquee-style selection.
 *
 * Index strategy: tokens are bucketed into a fixed-size cell grid per page.
 * Each token is registered in every cell its TOLERANCE-EXPANDED bounds
 * overlap, so a point query needs to inspect only the single cell containing
 * the point — lookups are O(cell occupancy), not O(all tokens).
 */
import type { VectorToken } from "../../domain/schematics/value-objects/VectorToken.js";
import { BoundingBox2D } from "../../domain/schematics/value-objects/BoundingBox2D.js";

export const DEFAULT_HIT_TOLERANCE = 4;
export const DEFAULT_CELL_SIZE = 64;

export interface HitTesterOptions {
  /** px margin around each token's bounds that still counts as a hit. */
  tolerance?: number;
  /** px edge length of the spatial grid cells. */
  cellSize?: number;
}

interface CellEntry {
  token: VectorToken;
  /** Token bounds expanded by the hit tolerance. */
  expanded: BoundingBox2D;
}

export class HitTester {
  private readonly cells = new Map<string, CellEntry[]>();
  private readonly tolerance: number;
  private readonly cellSize: number;

  constructor(tokens: readonly VectorToken[], options?: HitTesterOptions) {
    this.tolerance = options?.tolerance ?? DEFAULT_HIT_TOLERANCE;
    this.cellSize = options?.cellSize ?? DEFAULT_CELL_SIZE;

    for (const token of tokens) {
      const expanded = token.bounds.expand(this.tolerance);
      for (const key of this.cellKeysFor(expanded, token.pageNumber)) {
        const entries = this.cells.get(key) ?? [];
        entries.push({ token, expanded });
        this.cells.set(key, entries);
      }
    }
  }

  /**
   * Return the token under the point on `pageNumber`, or null.
   *
   * The point is a hit when it falls inside a token's tolerance-expanded
   * bounds.  When several tokens contain the point, the one whose bounds
   * center is nearest wins (first inserted on ties).
   */
  public hitTest(x: number, y: number, pageNumber: number): VectorToken | null {
    const entries = this.cells.get(this.cellKey(pageNumber, x, y));
    if (!entries) return null;

    let best: VectorToken | null = null;
    let bestDistSq = Infinity;

    for (const { token, expanded } of entries) {
      if (!expanded.containsPoint(x, y)) continue;

      const center = token.bounds.center;
      const dx = center.x - x;
      const dy = center.y - y;
      const distSq = dx * dx + dy * dy;

      if (distSq < bestDistSq) {
        bestDistSq = distSq;
        best = token;
      }
    }

    return best;
  }

  /**
   * Return every token on `pageNumber` whose bounds strictly intersect `box`,
   * in insertion order (tolerance does not apply to rect queries).
   */
  public queryRect(box: BoundingBox2D, pageNumber: number): VectorToken[] {
    const seen = new Set<VectorToken>();
    const hits: VectorToken[] = [];

    for (const key of this.cellKeysFor(box, pageNumber)) {
      for (const { token } of this.cells.get(key) ?? []) {
        if (seen.has(token)) continue;
        seen.add(token);
        if (token.bounds.intersects(box)) hits.push(token);
      }
    }

    return hits;
  }

  private cellKey(page: number, x: number, y: number): string {
    const cx = Math.floor(x / this.cellSize);
    const cy = Math.floor(y / this.cellSize);
    return `${page}:${cx}:${cy}`;
  }

  private cellKeysFor(bounds: BoundingBox2D, page: number): string[] {
    const minCx = Math.floor(bounds.minX / this.cellSize);
    const maxCx = Math.floor(bounds.maxX / this.cellSize);
    const minCy = Math.floor(bounds.minY / this.cellSize);
    const maxCy = Math.floor(bounds.maxY / this.cellSize);

    const keys: string[] = [];
    for (let cx = minCx; cx <= maxCx; cx += 1) {
      for (let cy = minCy; cy <= maxCy; cy += 1) {
        keys.push(`${page}:${cx}:${cy}`);
      }
    }
    return keys;
  }
}