/**
 * Navigator marker helper — pure DOM-free marker resolution for the net
 * navigator panel (Unit 5C, boardforge-redesign).
 *
 * Maps a boardview net name to its schematic presence marker via the shared
 * SchematicCrossProbeIndex. The marker drives the navigator row rendering
 * (search R2/R3 UI) and reflects the schematic R2 empty signal.
 */
import type { SchematicCrossProbeIndex } from "../../domain/schematics/services/SchematicCrossProbeIndex.js";

/** Schematic presence marker for one net row. */
export interface NetMarker {
  netName: string;
  type: "mapped" | "not-in-schematic";
  pageNumbers: number[];
}

/**
 * Resolve the schematic presence marker for a single boardview net.
 * "mapped" → net has schematic occurrences; "not-in-schematic" → R2 empty signal.
 * Never throws.
 */
export function resolveNetMarker(
  index: Pick<SchematicCrossProbeIndex, "queryFromBoardViewNet">,
  netName: string,
): NetMarker {
  const matches = index.queryFromBoardViewNet(netName);
  if (matches.length === 0) {
    return { netName: netName.trim(), type: "not-in-schematic", pageNumbers: [] };
  }
  const uniquePages = [...new Set(matches.map((m) => m.pageNumber))].sort((a, b) => a - b);
  return { netName: matches[0].netName, type: "mapped", pageNumbers: uniquePages };
}

/** One net row the adapter renders: its name + schematic marker. */
export interface FilteredNetEntry {
  net: string;
  marker: NetMarker;
}

/** Pure, DOM-free computation of the navigator's filtered+marked net list. */
export function computeFilteredNets(
  nets: string[],
  query: string,
  crossProbe: Pick<SchematicCrossProbeIndex, "queryFromBoardViewNet">,
): FilteredNetEntry[] {
  const q = query.trim().toLowerCase();
  return nets
    .filter((n) => q.length === 0 || n.toLowerCase().includes(q))
    .map((net) => ({ net, marker: resolveNetMarker(crossProbe, net) }));
}
