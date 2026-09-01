/**
 * PR 3D (boardforge-redesign) — Component pin-map detail core.
 * Strict-TDD specs.
 *
 * Pure logic tests (no DOM, node env): buildPinMap lists each pin of a
 * selected component with its number, name, page and coordinates from
 * SchematicPinLocation, and collectConnectedNets reports the nets those pins
 * connect to (schematics R4 — component detail panel).
 */
import { describe, it, expect } from "vitest";
import { BoundingBox2D } from "../../../../src/domain/schematics/value-objects/BoundingBox2D.js";
import { SchematicPinLocation } from "../../../../src/domain/schematics/entities/SchematicPinLocation.js";
import {
  buildPinMap,
  collectConnectedNets,
} from "../../../../src/ui/schematics/schematic-pinmap.js";

function pin(
  pinNumber: string,
  pageNumber: number,
  connectionPoint: { x: number; y: number },
  connectedNetName?: string,
): SchematicPinLocation {
  return new SchematicPinLocation({
    id: `u2700-${pinNumber.toLowerCase()}`,
    refDes: "U2700",
    pinNumber,
    pinName: pinNumber,
    pageNumber,
    bounds: new BoundingBox2D(0, 0, 40, 20),
    connectionPoint,
    connectedNetName,
  });
}

/** A12 on page 12 carrying PP_VDD_MAIN. */
function a12(): SchematicPinLocation {
  return pin("A12", 12, { x: 220, y: 310 }, "PP_VDD_MAIN");
}

describe("buildPinMap — component pin map from SchematicPinLocation (R4)", () => {
  it("lists pin A12 with name, page, coordinates and its net PP_VDD_MAIN", () => {
    const map = buildPinMap([a12()]);
    expect(map).toHaveLength(1);
    expect(map[0]).toMatchObject({
      pinNumber: "A12",
      pinName: "A12",
      pageNumber: 12,
      coordinates: { x: 220, y: 310 },
      connectedNetName: "PP_VDD_MAIN",
    });
  });

  it("includes every pin in the component's pin set in order", () => {
    const map = buildPinMap([a12(), pin("B5", 12, { x: 320, y: 410 }, "PP_3V3_DIG")]);
    expect(map.map((r) => r.pinNumber)).toEqual(["A12", "B5"]);
  });

  it("preserves each pin's page when banks span multiple pages", () => {
    const map = buildPinMap([a12(), pin("C9", 13, { x: 120, y: 110 }, "PP_1V8")]);
    expect(map.map((r) => r.pageNumber)).toEqual([12, 13]);
  });

  it("omits the pin name when the location declares none", () => {
    const unnamed = new SchematicPinLocation({
      id: "u2700-a12",
      refDes: "U2700",
      pinNumber: "A12",
      pageNumber: 12,
      bounds: new BoundingBox2D(200, 300, 240, 320),
      connectionPoint: { x: 220, y: 310 },
    });
    expect(buildPinMap([unnamed])[0].pinName).toBeUndefined();
  });

  it("returns an empty map for a component with no pins", () => {
    expect(buildPinMap([])).toEqual([]);
  });
});

describe("collectConnectedNets — nets from a pin set (R4)", () => {
  it("reports the unique connected nets in ascending order", () => {
    const nets = collectConnectedNets([a12(), pin("B5", 12, { x: 320, y: 410 }, "PP_3V3_DIG")]);
    expect(nets).toEqual(["PP_3V3_DIG", "PP_VDD_MAIN"]);
  });

  it("dedupes a repeated net across multiple pins", () => {
    const nets = collectConnectedNets([a12(), pin("A13", 12, { x: 220, y: 350 }, "PP_VDD_MAIN")]);
    expect(nets).toEqual(["PP_VDD_MAIN"]);
  });

  it("ignores pins with no connected net", () => {
    const noNet = new SchematicPinLocation({
      id: "u2700-nc",
      refDes: "U2700",
      pinNumber: "NC",
      pageNumber: 12,
      bounds: new BoundingBox2D(0, 0, 20, 20),
      connectionPoint: { x: 10, y: 10 },
    });
    expect(collectConnectedNets([a12(), noNet])).toEqual(["PP_VDD_MAIN"]);
  });
});
