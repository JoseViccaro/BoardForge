/**
 * Overlay resolver — pure cross-probe reverse map.
 *
 * DOM-free, React-free.  Given the shared boardview selection (a net name),
 * resolves which schematic pages/regions the SchematicPanel must highlight,
 * by reverse-mapping through the domain's SchematicCrossProbeIndex
 * (schematics R2: cross-probe highlight overlay).
 *
 * The resolver owns NO lookup state — it consumes the registered index and
 * purely groups the index's NetLabelMatch occurrences into per-page
 * highlight regions with canonical page ordering, plus the
 * not-in-schematic signal the panel uses to show "net not present".
 */
import type { SchematicCrossProbeIndex } from "../../domain/schematics/services/SchematicCrossProbeIndex.js";
import { BoundingBox2D } from "../../domain/schematics/value-objects/BoundingBox2D.js";

// ---------------------------------------------------------------------------
// Overlay result shape — consumed by the panel's repaint, not by the DOM
// ---------------------------------------------------------------------------

/** One schematic occurrence of the net — the region to stroke on its page. */
export interface OverlayHighlightRegion {
  /** Canonical net name as registered on the schematic net label. */
  netName: string;
  pageNumber: number;
  bounds: BoundingBox2D;
  rotation: number;
}

/** All occurrences of the net on one canonical page, unioned for repaint. */
export interface OverlayHighlightPage {
  pageNumber: number;
  regions: OverlayHighlightRegion[];
  /** Union of region bounds — the single box the panel strokes for this page. */
  bounds: BoundingBox2D;
}

export interface OverlayResolveResult {
  /**
   * True when the selected net has no schematic occurrence — the panel must
   * signal "not present in schematic" instead of highlighting anything.
   */
  notInSchematic: boolean;
  /** Canonical page numbers carrying highlights, ascending, deduped. */
  pageNumbers: number[];
  /** Per-page highlight groups (empty when notInSchematic). */
  highlights: OverlayHighlightPage[];
}

// ---------------------------------------------------------------------------
// resolveNetOverlay — the pure core
// ---------------------------------------------------------------------------

/**
 * Reverse-map a selected boardview net through `index` into the schematic
 * pages/regions to highlight.
 *
 * 1. Queries the domain index (exact match on the normalized net name —
 *    trimming and case-folding are the index's contract).
 * 2. Groups the returned NetLabelMatch occurrences by page.
 * 3. Each occurrence becomes a highlight region; each page group unions its
 *    region bounds so the panel can repaint one box per page.
 * 4. Canonical page numbers are emitted sorted ascending.
 *
 * Returns empty highlights + `notInSchematic: true` when no occurrence
 * exists — never throws.
 */
export function resolveNetOverlay(
  index: Pick<SchematicCrossProbeIndex, "queryFromBoardViewNet">,
  netName: string,
): OverlayResolveResult {
  const matches = index.queryFromBoardViewNet(netName);

  if (matches.length === 0) {
    return { notInSchematic: true, pageNumbers: [], highlights: [] };
  }

  const byPage = new Map<number, OverlayHighlightRegion[]>();

  for (const match of matches) {
    const regions = byPage.get(match.pageNumber) ?? [];
    regions.push({
      netName: match.netName,
      pageNumber: match.pageNumber,
      bounds: match.bounds,
      rotation: match.rotation,
    });
    byPage.set(match.pageNumber, regions);
  }

  // Canonical page order — ascending, deduped by the Map key
  const pageNumbers = [...byPage.keys()].sort((a, b) => a - b);

  const highlights = pageNumbers.map((pageNumber) => {
    const regions = byPage.get(pageNumber)!;
    let bounds = regions[0].bounds;
    for (let i = 1; i < regions.length; i += 1) {
      bounds = bounds.union(regions[i].bounds);
    }
    return { pageNumber, regions, bounds };
  });

  return { notInSchematic: false, pageNumbers, highlights };
}