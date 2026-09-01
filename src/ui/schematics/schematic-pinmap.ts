/**
 * Component pin-map detail core — pure DOM/React-free.
 *
 * Turns a selected component's SchematicPinLocation set into the rows the
 * detail panel renders (schematics R4): each pin's number, name, page and
 * coordinates, plus the set of connected nets (e.g. pin A12 on page 12 with
 * net PP_VDD_MAIN).
 *
 * Owns no lookup state; it consumes domain SchematicPinLocation values and
 * projects them into plain, panel-ready rows.
 */
import type { SchematicPinLocation } from "../../domain/schematics/entities/SchematicPinLocation.js";

// ---------------------------------------------------------------------------
// Pin map row shape — consumed by the detail panel, not by the DOM core
// ---------------------------------------------------------------------------

/** One row of the component detail pin map. */
export interface PinMapRow {
  /** The pin number (e.g. "A12"). */
  pinNumber: string;
  /** The pin's functional name when the schematic declares one. */
  pinName?: string;
  /** The page the pin appears on. */
  pageNumber: number;
  /** The pin's connection point coordinates on that page. */
  coordinates: { x: number; y: number };
  /** The net connected to this pin, when known. */
  connectedNetName?: string;
}

// ---------------------------------------------------------------------------
// buildPinMap — project SchematicPinLocation values into rows
// ---------------------------------------------------------------------------

/**
 * Project a component's pins into the detail-panel row list, one row per pin.
 *
 * Coordinates come from each location's connection point; page, name and net
 * are carried through verbatim. Pins without a declared name keep `pinName`
 * undefined rather than inventing a label.
 *
 * Returns an empty array for a pin-less component — never throws.
 */
export function buildPinMap(pins: readonly SchematicPinLocation[]): PinMapRow[] {
  return pins.map((pin) => ({
    pinNumber: pin.pinNumber,
    pinName: pin.pinName,
    pageNumber: pin.pageNumber,
    coordinates: { ...pin.connectionPoint },
    connectedNetName: pin.connectedNetName,
  }));
}

// ---------------------------------------------------------------------------
// collectConnectedNets — unique, ordered nets across a pin set
// ---------------------------------------------------------------------------

/**
 * Report every distinct net connected by a component's pins.
 *
 * Nets are returned sorted ascending and deduped, with unnamed connections
 * skipped. The panel uses this for the "connected nets" list of the detail
 * panel (e.g. PP_VDD_MAIN).
 */
export function collectConnectedNets(
  pins: readonly SchematicPinLocation[],
): string[] {
  const nets = new Set<string>();
  for (const pin of pins) {
    if (pin.connectedNetName && pin.connectedNetName.trim().length > 0) {
      nets.add(pin.connectedNetName.trim().toUpperCase());
    }
  }
  return [...nets].sort();
}
