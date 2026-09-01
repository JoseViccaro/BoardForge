/**
 * BoardView extraction (PR 2, boardforge-redesign).
 *
 * Pure, DOM-free core extracted from the legacy inline render in App.tsx
 * (LegacyBoardView): the canvas paint pipeline (`renderBoard`) plus the
 * interaction/selection logic the BoardViewPanel component consumes:
 * hit testing, net->selection mapping, bus-selection effects, layer filters,
 * net classification, and SchematicCrossProbeIndex reveals.
 *
 * No React, no DOM, no side effects. `CanvasLike`/`Draw2D` are structural
 * ports so the paint pipeline runs against any 2D context (test double or
 * browser canvas). `src/domain` is only consumed, never modified.
 */
import { NetClassification } from "../domain/boardview/value-objects/NetClassification.js";
import type { SelectionChangePayload } from "../application/workbench/WorkbenchEventBus.js";
import type { SelectionTarget } from "../application/workbench/WorkbenchFacade.js";
import type { SchematicCrossProbeIndex, SchematicPinHit } from "../domain/schematics/services/SchematicCrossProbeIndex.js";

// ---------------------------------------------------------------------------
// Structural geometry types (both iPhone 11 Pro and iPhone 13 CAD fixtures conform)
// ---------------------------------------------------------------------------

export interface BoardPinLike {
  id: string;
  padNumber: string;
  x: number;
  y: number;
  w?: number;
  h?: number;
  r?: number;
  net: string;
  comp: string;
  boardIndex: number;
  side: string;
  diodeMv?: number | "OL";
  shape: "RECT" | "CIRCLE";
}

export interface BoardComponentLike {
  designator: string;
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  boardIndex: number;
  type: string;
  pins: BoardPinLike[];
}

export interface BoardContourLike {
  boardIndex: number;
  title: string;
  points: [number, number][];
}

export interface BoardGeometryData {
  contours: BoardContourLike[];
  components: BoardComponentLike[];
  pins: BoardPinLike[];
}

// ---------------------------------------------------------------------------
// Canvas ports (structural — same members as a real 2D context)
// ---------------------------------------------------------------------------

export interface Draw2D {
  save(): void;
  restore(): void;
  scale(x: number, y: number): void;
  translate(x: number, y: number): void;
  clearRect(x: number, y: number, w: number, h: number): void;
  beginPath(): void;
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  closePath(): void;
  fill(): void;
  stroke(): void;
  arc(x: number, y: number, radius: number, startAngle: number, endAngle: number): void;
  rect(x: number, y: number, w: number, h: number): void;
  roundRect(x: number, y: number, w: number, h: number, radii?: number): void;
  fillText(text: string, x: number, y: number): void;
  fillStyle: string;
  strokeStyle: string;
  lineWidth: number;
  font: string;
  textAlign: string;
  textBaseline: string;
}

export interface CanvasLike {
  width: number;
  height: number;
  clientWidth: number;
  clientHeight: number;
  getContext(kind: string): Draw2D | null;
}

export interface BoardRenderOptions {
  activeNet: string | null;
  selectedPinId?: string | null;
  hoveredPinId?: string | null;
  showDiodeValues?: boolean;
  scale: number;
  pan: { x: number; y: number };
  layerTab?: string;
  devicePixelRatio?: number;
}

// ---------------------------------------------------------------------------
// Layer model (preserves the legacy tab set; Top/A -> side A, Bottom/B -> side B)
// ---------------------------------------------------------------------------

export const BOARD_LAYER_TABS = [
  "copper",
  "A",
  "Top",
  "Mid-1",
  "Mid-2",
  "Mid-3",
  "Mid-4",
  "Mid-5",
  "Mid-6",
  "Mid-7",
  "Mid-8",
  "Bottom",
] as const;

export function pinsForLayer(board: BoardGeometryData, layerTab: string): BoardPinLike[] {
  if (layerTab === "A" || layerTab === "Top") {
    return board.pins.filter((p) => p.side === "A");
  }
  if (layerTab === "B" || layerTab === "Bottom") {
    return board.pins.filter((p) => p.side === "B");
  }
  return board.pins; // copper / Mid-* layers show the full stack
}

// ---------------------------------------------------------------------------
// Net highlight (spec: selected net visually distinct; GND never highlighted)
// ---------------------------------------------------------------------------

export function isPinHighlighted(pin: BoardPinLike, activeNet: string | null | undefined): boolean {
  return pin.net !== "GND" && activeNet !== null && activeNet !== undefined && pin.net === activeNet;
}

// ---------------------------------------------------------------------------
// Net classification (hover info per boardview spec: name + classification)
// ---------------------------------------------------------------------------

export function classifyNet(netName: string): NetClassification {
  if (netName === "GND" || netName.startsWith("GND")) return NetClassification.GROUND;
  if (netName.startsWith("PP_")) return NetClassification.POWER_MAIN;
  if (netName.includes("I2C")) return NetClassification.SIGNAL_I2C;
  if (netName.includes("SPI")) return NetClassification.SIGNAL_SPI;
  if (netName.includes("ANT")) return NetClassification.RF_ANTENNA;
  return NetClassification.POWER_BUCK;
}

// ---------------------------------------------------------------------------
// Pin hit testing (world coordinates; legacy App.tsx math preserved)
// ---------------------------------------------------------------------------

export function hitTestPin(board: BoardGeometryData, worldX: number, worldY: number): BoardPinLike | null {
  return (
    board.pins.find((p) => {
      if (p.shape === "CIRCLE") {
        const dx = p.x - worldX;
        const dy = p.y - worldY;
        const r = p.r || 0.22;
        return dx * dx + dy * dy <= r * r * 2.2;
      }
      const hw = (p.w || 0.3) / 2;
      const hh = (p.h || 0.4) / 2;
      return worldX >= p.x - hw && worldX <= p.x + hw && worldY >= p.y - hh && worldY <= p.y + hh;
    }) ?? null
  );
}

// ---------------------------------------------------------------------------
// Selection mapping (click path: pin -> SelectionTarget -> facade.select)
// ---------------------------------------------------------------------------

export function selectionTargetForPin(pin: BoardPinLike, boardId: string): SelectionTarget {
  return {
    boardId,
    net: pin.net && pin.net !== "GND" ? pin.net : undefined,
    refDes: pin.comp,
    pin: pin.padNumber,
  };
}

// ---------------------------------------------------------------------------
// Bus subscription effect (external selection.change drives panel highlight)
// ---------------------------------------------------------------------------

export interface BoardSelectionEffect {
  activeNet: string | null;
  selectedPinId: string | null;
}

export function applySelectionToBoard(
  selection: SelectionChangePayload,
  board: BoardGeometryData
): BoardSelectionEffect {
  const effect: BoardSelectionEffect = { activeNet: selection.net ?? null, selectedPinId: null };
  if (selection.refDes !== undefined && selection.pin !== undefined) {
    const match = board.pins.find(
      (p) => p.comp === selection.refDes && p.padNumber === selection.pin
    );
    effect.selectedPinId = match?.id ?? null;
  }
  return effect;
}

// ---------------------------------------------------------------------------
// Cross-probe reveal (click: linked schematic pages/coords/nets from the index)
// ---------------------------------------------------------------------------

export interface CrossProbeReveal {
  refDes: string;
  hits: SchematicPinHit[];
  pages: number[];
  connectedNets: string[];
}

export function crossProbeRevealForPin(
  index: SchematicCrossProbeIndex,
  pin: BoardPinLike
): CrossProbeReveal {
  const hits = index.queryFromBoardViewPin(pin.comp, pin.padNumber);
  const pages = [...new Set(hits.map((h) => h.pageNumber))].sort((a, b) => a - b);
  const connectedNets = [...new Set(hits.map((h) => h.netName).filter((n): n is string => n !== undefined))];
  return { refDes: pin.comp, hits, pages, connectedNets };
}

// ---------------------------------------------------------------------------
// Canvas paint pipeline (extracted verbatim from App.tsx LegacyBoardView)
// ---------------------------------------------------------------------------

const PIN_HIGHLIGHT_FILL = "#00f0ff";
const PIN_SELECTED_FILL = "#ffffff";
const PIN_SELECTED_STROKE = "#facc15";

export function renderBoard(
  canvas: CanvasLike,
  board: BoardGeometryData,
  options: BoardRenderOptions
): Draw2D | null {
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const dpr = options.devicePixelRatio ?? 1;
  const displayWidth = canvas.clientWidth || 950;
  const displayHeight = canvas.clientHeight || 700;

  if (canvas.width !== displayWidth * dpr || canvas.height !== displayHeight * dpr) {
    canvas.width = displayWidth * dpr;
    canvas.height = displayHeight * dpr;
  }

  const { activeNet, selectedPinId, hoveredPinId, showDiodeValues = true, scale, pan } = options;
  const selectedComp = selectedPinId
    ? board.pins.find((p) => p.id === selectedPinId)?.comp
    : undefined;
  const hoveredPin = hoveredPinId ? board.pins.find((p) => p.id === hoveredPinId) : undefined;

  ctx.save();
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, displayWidth, displayHeight);

  // Camera transform
  ctx.translate(pan.x, pan.y);
  ctx.scale(scale, scale);

  // 1. Board substrate contours
  for (const c of board.contours) {
    ctx.beginPath();
    ctx.moveTo(c.points[0][0], c.points[0][1]);
    for (let i = 1; i < c.points.length; i++) {
      ctx.lineTo(c.points[i][0], c.points[i][1]);
    }
    ctx.closePath();
    ctx.fillStyle = "#07090e";
    ctx.fill();
    ctx.strokeStyle = "#c59b27";
    ctx.lineWidth = 0.45;
    ctx.stroke();

    const minX = Math.min(...c.points.map((p) => p[0]));
    const maxX = Math.max(...c.points.map((p) => p[0]));
    const cx = (minX + maxX) / 2;
    ctx.fillStyle = "#94a3b8";
    ctx.font = "bold 1.3px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(c.title, cx, 11.0);
  }

  // 2. Component bodies (silkscreen + fills)
  for (const comp of board.components) {
    const isCompSelected = selectedComp === comp.designator;
    if (comp.type === "FPC") {
      ctx.fillStyle = "#0284c7";
      ctx.strokeStyle = isCompSelected ? PIN_SELECTED_STROKE : "#38bdf8";
      ctx.lineWidth = 0.12;
    } else if (comp.type === "IC") {
      ctx.fillStyle = "#0f172a";
      ctx.strokeStyle = isCompSelected ? PIN_SELECTED_STROKE : "#ef4444";
      ctx.lineWidth = 0.14;
    } else if (comp.type === "CAP") {
      ctx.fillStyle = "#78350f";
      ctx.strokeStyle = isCompSelected ? PIN_SELECTED_STROKE : "#92400e";
      ctx.lineWidth = 0.04;
    } else {
      ctx.fillStyle = "#09090b";
      ctx.strokeStyle = isCompSelected ? PIN_SELECTED_STROKE : "#52525b";
      ctx.lineWidth = 0.04;
    }

    ctx.beginPath();
    ctx.roundRect(comp.x, comp.y, comp.w, comp.h, 0.15);
    ctx.fill();
    ctx.stroke();

    if (comp.type === "IC" || comp.type === "FPC" || scale >= 25.0) {
      ctx.fillStyle = "#ffffff";
      ctx.font = `bold ${Math.min(comp.w * 0.22, 1.2)}px monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(comp.designator, comp.x + comp.w / 2, comp.y + comp.h / 2);
    }
  }

  // 3. Pads & BGA balls — visible layer only
  for (const pin of pinsForLayer(board, options.layerTab ?? "copper")) {
    const isPinSelected = selectedPinId === pin.id;
    const isNetActive = isPinHighlighted(pin, activeNet);
    const isGnd = pin.net === "GND";

    if (isPinSelected) {
      ctx.fillStyle = PIN_SELECTED_FILL;
      ctx.strokeStyle = "#eab308";
    } else if (isNetActive) {
      ctx.fillStyle = PIN_HIGHLIGHT_FILL;
      ctx.strokeStyle = "#ffffff";
    } else if (isGnd) {
      ctx.fillStyle = "#1e293b";
      ctx.strokeStyle = "#0f172a";
    } else if (pin.diodeMv === 92) {
      ctx.fillStyle = "#ef4444";
      ctx.strokeStyle = "#991b1b";
    } else {
      ctx.fillStyle = "#fef08a";
      ctx.strokeStyle = "#ca8a04";
    }

    ctx.lineWidth = 0.025;

    if (pin.shape === "CIRCLE") {
      ctx.beginPath();
      ctx.arc(pin.x, pin.y, pin.r || 0.22, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      if (showDiodeValues && scale >= 20.0 && pin.diodeMv !== undefined) {
        ctx.fillStyle = pin.diodeMv === 92 || isNetActive || isPinSelected ? "#ffffff" : "#0f172a";
        ctx.font = `bold ${(pin.r || 0.22) * 0.85}px monospace`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(String(pin.diodeMv), pin.x, pin.y);
      }
    } else {
      const hw = (pin.w || 0.28) / 2;
      const hh = (pin.h || 0.42) / 2;
      ctx.beginPath();
      ctx.rect(pin.x - hw, pin.y - hh, pin.w || 0.28, pin.h || 0.42);
      ctx.fill();
      ctx.stroke();
    }

    if (isPinSelected) {
      ctx.strokeStyle = PIN_SELECTED_STROKE;
      ctx.lineWidth = 0.08;
      ctx.stroke();
    }
  }

  // 4. Hover tooltip — net info + classification (boardview spec)
  if (hoveredPin) {
    const tx = hoveredPin.x + 0.6;
    const ty = hoveredPin.y - 2.8;
    const tw = 7.6;
    const th = 2.6;

    ctx.fillStyle = "rgba(8, 12, 20, 0.96)";
    ctx.strokeStyle = "#facc15";
    ctx.lineWidth = 0.06;

    ctx.beginPath();
    ctx.roundRect(tx, ty, tw, th, 0.15);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 0.28px monospace";
    ctx.textAlign = "left";
    ctx.fillText(`pin no : ${hoveredPin.id}`, tx + 0.25, ty + 0.55);

    ctx.fillStyle = hoveredPin.net === "GND" ? "#94a3b8" : "#facc15";
    ctx.fillText(`net name : ${hoveredPin.net || "N/C"}`, tx + 0.25, ty + 1.15);

    ctx.fillStyle = "#38bdf8";
    ctx.font = "0.24px sans-serif";
    ctx.fillText(
      `net class : ${classifyNet(hoveredPin.net || "N/C")} | ${hoveredPin.comp} | Board ${hoveredPin.boardIndex}`,
      tx + 0.25,
      ty + 1.7
    );
    ctx.fillText(
      `Vf: ${hoveredPin.diodeMv !== undefined ? `${hoveredPin.diodeMv}mV` : "N/A"} | Click to trace`,
      tx + 0.25,
      ty + 2.25
    );
  }

  ctx.restore();
  return ctx;
}