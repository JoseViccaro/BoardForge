/**
 * Cross-panel sync core (PR 4A, boardforge-redesign).
 *
 * Pure DOM/React-free reaction of the schematic panel to a workbench
 * `selection.change` event. This is the exact function the SchematicPanel bus
 * subscription (PR 3E wiring) calls on every selection, so the panel stays a
 * thin adapter and the cross-panel sync is verifiable at the node level
 * without React or a canvas.
 *
 * It composes the already-tested cores — no logic duplicated:
 *   - net  -> `resolveNetOverlay` (overlay-resolve, 3C) over
 *     `SchematicCrossProbeIndex.queryFromBoardViewNet` (schematics R2)
 *   - refDes -> `jumpToRefDes` (schematic-nav, 3D) + `buildPinMap` /
 *     `collectConnectedNets` (schematic-pinmap, 3D)
 */
import type { SchematicDocument } from "../../domain/schematics/aggregates/SchematicDocument.js";
import type { SchematicCrossProbeIndex } from "../../domain/schematics/services/SchematicCrossProbeIndex.js";
import type { SelectionChangePayload } from "../../application/workbench/WorkbenchEventBus.js";
import {
  resolveNetOverlay,
  type OverlayResolveResult,
} from "./overlay-resolve.js";
import {
  SchematicNavigator,
  jumpToRefDes,
} from "./schematic-nav.js";
import {
  buildPinMap,
  collectConnectedNets,
  type PinMapRow,
} from "./schematic-pinmap.js";

/** Component detail projected for the panel's pin-row — one refDes at a time. */
export interface SchematicDetail {
  refDes: string;
  pageList: number[];
  pageToShow: number;
  pins: PinMapRow[];
  connectedNets: string[];
}

/** The full state the panel must adopt after reacting to a selection. */
export interface SchematicSyncReaction {
  /** Reverse-mapped overlay; empty + notInSchematic when the net has no counterpart. */
  overlay: OverlayResolveResult;
  /** True when the selected net has no schematic occurrence (R2 empty signal). */
  notInSchematic: boolean;
  /** The selected net, or null when the selection carried no net. */
  activeNet: string | null;
  /** The page to display after the selection, or null when none is implied. */
  pageToShow: number | null;
  /** Component detail to reveal, or null when the selection carried no known refDes. */
  detail: SchematicDetail | null;
}

/**
 * Compute the schematic panel's reaction to a shared workbench selection.
 *
 * Net and refDes are handled independently and composably:
 *   - a selected net reverse-maps through the cross-probe index into the
 *     overlay (empty + not-in-schematic when it has no occurrence);
 *   - a selected, known refDes lowers the panel onto its first page and
 *     projects the pin map / connected nets for the detail row.
 *
 * Navigation (`pageToShow`) follows the panel's subscription order: a found
 * refDes page wins over the net's first canonical page, and an empty net
 * contributes no jump. Returns a full reaction — never throws.
 */
export function applySelectionToSchematic(
  crossProbe: Pick<SchematicCrossProbeIndex, "queryFromBoardViewNet">,
  document: SchematicDocument,
  navigator: SchematicNavigator,
  selection: SelectionChangePayload,
): SchematicSyncReaction {
  const reaction: SchematicSyncReaction = {
    overlay: { notInSchematic: false, pageNumbers: [], highlights: [] },
    notInSchematic: false,
    activeNet: null,
    pageToShow: null,
    detail: null,
  };

  // Net path (schematics R2): reverse-map through the cross-probe index.
  if (selection.net) {
    const overlay = resolveNetOverlay(crossProbe, selection.net);
    reaction.overlay = overlay;
    reaction.notInSchematic = overlay.notInSchematic;
    reaction.activeNet = selection.net;
    if (overlay.pageNumbers.length > 0) {
      reaction.pageToShow = overlay.pageNumbers[0];
    }
  }

  // RefDes path (R3/R4): lower onto the component's first page + detail row.
  if (selection.refDes) {
    const aggregate = document.getSymbol(selection.refDes);
    if (aggregate) {
      const jump = jumpToRefDes(aggregate);
      const pins = document.findPinsForRefDes(aggregate.refDes);
      reaction.pageToShow = jump.pageNumber;
      reaction.detail = {
        refDes: aggregate.refDes,
        pageList: jump.pageList,
        pageToShow: jump.pageNumber,
        pins: buildPinMap(pins),
        connectedNets: collectConnectedNets(pins),
      };
    }
  }

  // Harmonize the navigator cursor with the resolved page so the panel's
  // current-page render stays in lockstep with the reaction.
  if (reaction.pageToShow !== null) {
    navigator.jumpTo(reaction.pageToShow);
  }

  return reaction;
}
