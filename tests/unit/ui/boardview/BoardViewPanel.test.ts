/**
 * PR 2 (boardforge-redesign) — BoardView panel extraction. Strict-TDD RED specs.
 *
 * Pure logic tests (no DOM, node env): the extracted paint pipeline, hit
 * testing, pin->selection mapping, bus subscription effects, and cross-probe
 * reveals. The React component in BoardViewPanel.tsx consumes exactly these
 * functions, so failing here fails the panel.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { generateExactIPhone11ProMasterCAD } from "../../../../src/domain/boardview/geometry/iPhone11ProExact4BoardCAD.js";
import { iPhone13SchematicFixtures } from "../../../../src/infrastructure/seeds/iPhone13SchematicFixtures.js";
import { SchematicCrossProbeIndex } from "../../../../src/domain/schematics/services/SchematicCrossProbeIndex.js";
import { NetClassification } from "../../../../src/domain/boardview/value-objects/NetClassification.js";
import { WorkbenchFacade } from "../../../../src/application/workbench/WorkbenchFacade.js";
import { WorkbenchEventBus } from "../../../../src/application/workbench/WorkbenchEventBus.js";
import { SessionStore } from "../../../../src/application/workbench/SessionStore.js";
import {
  renderBoard,
  hitTestPin,
  selectionTargetForPin,
  applySelectionToBoard,
  crossProbeRevealForPin,
  classifyNet,
  pinsForLayer,
  isPinHighlighted,
  BOARD_LAYER_TABS,
  type BoardGeometryData,
  type Draw2D,
} from "../../../../src/ui/extract-render.js";

// ---------------------------------------------------------------------------
// Recording canvas fakes — assert what renderBoard ACTUALLY painted
// ---------------------------------------------------------------------------

interface RecordedCtx {
  calls: string[];
  fills: string[];
  strokes: string[];
  count: (method: string) => number;
  countFill: (color: string) => number;
  countStroke: (color: string) => number;
}

function makeFakeCanvas(): {
  canvas: { width: number; height: number; clientWidth: number; clientHeight: number; getContext(): Draw2D | null };
  ctx: RecordedCtx;
} {
  const calls: string[] = [];
  const fills: string[] = [];
  const strokes: string[] = [];
  let fillStyle = "#000";
  let strokeStyle = "#000";

  const ctx: Draw2D = {
    save: () => calls.push("save"),
    restore: () => calls.push("restore"),
    scale: () => calls.push("scale"),
    translate: () => calls.push("translate"),
    clearRect: () => calls.push("clearRect"),
    beginPath: () => calls.push("beginPath"),
    moveTo: () => calls.push("moveTo"),
    lineTo: () => calls.push("lineTo"),
    closePath: () => calls.push("closePath"),
    fill: () => {
      calls.push("fill");
      fills.push(fillStyle);
    },
    stroke: () => {
      calls.push("stroke");
      strokes.push(strokeStyle);
    },
    arc: () => calls.push("arc"),
    rect: () => calls.push("rect"),
    roundRect: () => calls.push("roundRect"),
    fillText: () => calls.push("fillText"),
    get fillStyle() { return fillStyle; },
    set fillStyle(v: string) { fillStyle = v; },
    get strokeStyle() { return strokeStyle; },
    set strokeStyle(v: string) { strokeStyle = v; },
    lineWidth: 0,
    font: "",
    textAlign: "",
    textBaseline: "",
  };

  const recorded: RecordedCtx = {
    calls,
    fills,
    strokes,
    count: (m) => calls.filter((c) => c === m).length,
    countFill: (color) => fills.filter((f) => f === color).length,
    countStroke: (color) => strokes.filter((s) => s === color).length,
  };

  return {
    canvas: {
      width: 0,
      height: 0,
      clientWidth: 950,
      clientHeight: 700,
      getContext: () => ctx,
    },
    ctx: recorded,
  };
}

// ---------------------------------------------------------------------------
// Controlled two-sided board — deterministic basis for layer/highlight specs
// ---------------------------------------------------------------------------

function makeTwoSidedBoard(): BoardGeometryData {
  const pins: BoardGeometryData["pins"] = [
    { id: "U2700.A1", padNumber: "A1", x: 0.5, y: 0.5, r: 0.25, net: "PP_VDD_MAIN", comp: "U2700", boardIndex: 1, side: "A", diodeMv: 430, shape: "CIRCLE" },
    { id: "U2700.E5", padNumber: "E5", x: 1.0, y: 1.0, r: 0.25, net: "PP1V8_S2", comp: "U2700", boardIndex: 1, side: "A", diodeMv: 365, shape: "CIRCLE" },
    { id: "U2700.C9", padNumber: "C9", x: 1.5, y: 1.5, r: 0.25, net: "PP_VDD_MAIN", comp: "U2700", boardIndex: 1, side: "B", shape: "CIRCLE" },
    { id: "U2700.F8", padNumber: "F8", x: 0.75, y: 1.25, r: 0.25, net: "GND", comp: "U2700", boardIndex: 1, side: "B", shape: "CIRCLE" },
  ];
  return {
    contours: [{ boardIndex: 1, title: "TEST BOARD", points: [[0, 0], [2, 0], [2, 2], [0, 2]] }],
    components: [{ designator: "U2700", name: "Main PMIC", x: 0.4, y: 0.4, w: 1.2, h: 1.2, boardIndex: 1, type: "IC", pins }],
    pins,
  };
}

const HIGHLIGHT_CYAN = "#00f0ff";
const SELECTED_WHITE = "#ffffff";

// ---------------------------------------------------------------------------
// 2.2 renderBoard — pure paint pipeline extracted from App.tsx
// ---------------------------------------------------------------------------

describe("renderBoard (extracted from App.tsx)", () => {
  it("renders the full legacy board from fixture data without a DOM", () => {
    const board = generateExactIPhone11ProMasterCAD();
    const { canvas, ctx } = makeFakeCanvas();

    const result = renderBoard(canvas, board, {
      scale: 4.4,
      pan: { x: 30, y: -40 },
      activeNet: "PP_VDD_MAIN",
      layerTab: "copper",
    });

    expect(result).not.toBeNull();
    // Every pin is drawn exactly once (arc for BGA balls, rect for SMT pads)
    expect(ctx.count("arc") + ctx.count("rect")).toBe(board.pins.length);
    // Contours + components + pins each get exactly one fill
    expect(ctx.count("fill")).toBe(board.contours.length + board.components.length + board.pins.length);
    // Camera transform applied once per frame, canvas cleared once
    expect(ctx.count("translate")).toBe(1);
    expect(ctx.count("clearRect")).toBe(1);
    // Real pads painted: gold default pads, dark ground pads, and net highlight
    expect(ctx.countFill("#fef08a")).toBeGreaterThan(0);
    expect(ctx.countFill("#1e293b")).toBeGreaterThan(0);
    expect(ctx.countFill(HIGHLIGHT_CYAN)).toBeGreaterThan(0);
  });

  it("highlights exactly the active net's pins (spec: dim non-selected, cyan selected net)", () => {
    const board = makeTwoSidedBoard();
    const { canvas, ctx } = makeFakeCanvas();

    renderBoard(canvas, board, { scale: 4.4, pan: { x: 0, y: 0 }, activeNet: "PP_VDD_MAIN", layerTab: "Top" });

    // Top layer: A1 (net) highlighted, E5 (other net) not, GND never highlighted
    expect(ctx.countFill(HIGHLIGHT_CYAN)).toBe(1);
    expect(ctx.count("fill")).toBe(1 + 1 + 2); // contour + component + 2 visible pins
  });

  it("paints the selected pin white/yellow and keeps other pins untouched", () => {
    const board = makeTwoSidedBoard();
    const { canvas, ctx } = makeFakeCanvas();

    renderBoard(canvas, board, {
      scale: 4.4,
      pan: { x: 0, y: 0 },
      activeNet: "PP_VDD_MAIN",
      selectedPinId: "U2700.E5",
      layerTab: "Top",
    });

    expect(ctx.countFill(SELECTED_WHITE)).toBe(1);
    expect(ctx.countStroke("#eab308")).toBe(1);
    expect(ctx.countFill(HIGHLIGHT_CYAN)).toBe(1); // net highlight preserved alongside selection
  });

  it("flipping the layer preserves the net highlight on that side's pads (spec scenario)", () => {
    const board = makeTwoSidedBoard();
    const opts = { scale: 4.4, pan: { x: 0, y: 0 } as const, activeNet: "PP_VDD_MAIN" };

    const top = makeFakeCanvas();
    renderBoard(top.canvas, board, { ...opts, layerTab: "Top" });
    expect(top.ctx.countFill(HIGHLIGHT_CYAN)).toBe(1); // A1, side A

    const bottom = makeFakeCanvas();
    renderBoard(bottom.canvas, board, { ...opts, layerTab: "Bottom" });
    expect(bottom.ctx.countFill(HIGHLIGHT_CYAN)).toBe(1); // C9, side B — same net, other side
    expect(bottom.ctx.count("arc")).toBe(2); // only the two side-B pins are painted
  });
});

// ---------------------------------------------------------------------------
// 2.1 hit testing + selection emission (net click path)
// ---------------------------------------------------------------------------

describe("pin hit testing and selection emission", () => {
  it("hit-tests BGA balls (radius) and SMT pads (rect bounds); miss returns null", () => {
    const board = generateExactIPhone11ProMasterCAD();
    const circle = board.pins.find((p) => p.shape === "CIRCLE")!;
    expect(hitTestPin(board, circle.x + 0.1, circle.y)).toBe(circle);
    const rect = board.pins.find((p) => p.shape === "RECT")!;
    expect(hitTestPin(board, rect.x, rect.y)).toBe(rect);
    expect(hitTestPin(board, 1000, 1000)).toBeNull();
  });

  it("emits selection.change with net/refDes/pin when a net pin is clicked", () => {
    const bus = new WorkbenchEventBus();
    const sessionStore = new SessionStore({
      read: async () => null,
      write: async () => undefined,
      delete: async () => undefined,
    });
    const facade = new WorkbenchFacade({
      boardViewFacade: {
        uploadBoardView: vi.fn(),
        getBoardView: vi.fn(async () => ({ boardId: "BRD_820_02106", boardNumber: "820-02106", stackType: "SANDWICH_INTERPOSER", subBoards: [] })),
        getNets: vi.fn(async () => ({ nets: [] })),
      },
      schematicsFacade: {
        saveDocument: vi.fn(),
        uploadSchematic: vi.fn(),
        searchSymbols: vi.fn(),
        getPage: vi.fn(),
      },
      measurementsFacade: {
        getReferences: vi.fn(),
        createReference: vi.fn(),
        recordMeasurement: vi.fn(),
      },
      bus,
      sessionStore,
      defaultBoardModel: "iPhone13",
    });
    const handler = vi.fn();
    bus.subscribe("selection.change", handler);

    const board = makeTwoSidedBoard();
    const pin = board.pins.find((p) => p.id === "U2700.E5")!;
    // Exactly what the panel click handler does: map the pin, publish via facade
    facade.select(selectionTargetForPin(pin, "BRD_820_02106"));

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith({ boardId: "BRD_820_02106", net: "PP1V8_S2", refDes: "U2700", pin: "E5" });
  });

  it("never lets GND hijack the active net", () => {
    const board = makeTwoSidedBoard();
    const gnd = board.pins.find((p) => p.net === "GND")!;
    const target = selectionTargetForPin(gnd, "BRD_820_02106");
    expect(target.net).toBeUndefined();
    expect(target.refDes).toBe("U2700");
    expect(target.pin).toBe("F8");
  });
});

// ---------------------------------------------------------------------------
// 2.3 bus subscription — external selection.change drives the highlight
// ---------------------------------------------------------------------------

describe("applySelectionToBoard (bus subscription effect)", () => {
  it("maps a pin+net selection to activeNet and selectedPinId", () => {
    const board = makeTwoSidedBoard();
    const effect = applySelectionToBoard({ boardId: "BRD_820_02106", net: "PP1V8_S2", refDes: "U2700", pin: "E5" }, board);
    expect(effect.activeNet).toBe("PP1V8_S2");
    expect(effect.selectedPinId).toBe("U2700.E5");
    expect(isPinHighlighted(board.pins[1], effect.activeNet!)).toBe(true);
  });

  it("net-only selection highlights without selecting a pin", () => {
    const board = makeTwoSidedBoard();
    const effect = applySelectionToBoard({ boardId: "BRD_820_02106", net: "PP_VDD_MAIN" }, board);
    expect(effect.activeNet).toBe("PP_VDD_MAIN");
    expect(effect.selectedPinId).toBeNull();
  });

  it("handles unknown refDes/pin gracefully (keeps net, no pin)", () => {
    const board = makeTwoSidedBoard();
    const effect = applySelectionToBoard({ boardId: "BRD_820_02106", net: "PP_VDD_MAIN", refDes: "U9999", pin: "ZZ9" }, board);
    expect(effect.activeNet).toBe("PP_VDD_MAIN");
    expect(effect.selectedPinId).toBeNull();
  });

  it("pin-only selection selects the pin but keeps the current net", () => {
    const board = makeTwoSidedBoard();
    const effect = applySelectionToBoard({ boardId: "BRD_820_02106", refDes: "U2700", pin: "E5" }, board);
    expect(effect.activeNet).toBeNull();
    expect(effect.selectedPinId).toBe("U2700.E5");
  });
});

// ---------------------------------------------------------------------------
// 2.3 click reveal — SchematicCrossProbeIndex consumption (spec scenario)
// ---------------------------------------------------------------------------

describe("crossProbeRevealForPin (SchematicCrossProbeIndex consumption)", () => {
  let index: SchematicCrossProbeIndex;

  beforeEach(() => {
    index = new SchematicCrossProbeIndex();
    index.registerSchematicDocument(iPhone13SchematicFixtures.createFixtures().document);
  });

  it("reveals linked schematic pages, pin coordinates, and connected net for a mapped pin", () => {
    const board = makeTwoSidedBoard();
    const pin = board.pins.find((p) => p.padNumber === "E5")!;
    const reveal = crossProbeRevealForPin(index, pin);

    expect(reveal.refDes).toBe("U2700");
    expect(reveal.hits).toHaveLength(1);
    expect(reveal.hits[0].pageNumber).toBe(13);
    expect(reveal.hits[0].refDes).toBe("U2700");
    expect(reveal.hits[0].connectionPoint).toEqual({ x: expect.any(Number), y: expect.any(Number) });
    expect(reveal.pages).toEqual([13]);
    expect(reveal.connectedNets).toEqual(["PP1V8_S2"]);
  });

  it("returns an empty reveal for pins with no schematic mapping (no duplicate domain logic)", () => {
    const board = generateExactIPhone11ProMasterCAD();
    const unmapped = board.pins[0]; // legacy J5700 pin — absent from iPhone 13 schematic fixtures
    const reveal = crossProbeRevealForPin(index, unmapped);
    expect(reveal.hits).toEqual([]);
    expect(reveal.pages).toEqual([]);
    expect(reveal.connectedNets).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// 2.3 layer tabs + classification (hover info per spec)
// ---------------------------------------------------------------------------

describe("boardview pure selectors", () => {
  it("filters pins by layer tab (Top/Bottom sides) and keeps all on copper/mid layers", () => {
    const board = makeTwoSidedBoard();
    expect(pinsForLayer(board, "Top").map((p) => p.id).sort()).toEqual(["U2700.A1", "U2700.E5"]);
    expect(pinsForLayer(board, "Bottom").map((p) => p.id).sort()).toEqual(["U2700.C9", "U2700.F8"]);
    expect(pinsForLayer(board, "A").map((p) => p.id).sort()).toEqual(["U2700.A1", "U2700.E5"]);
    expect(pinsForLayer(board, "B").map((p) => p.id).sort()).toEqual(["U2700.C9", "U2700.F8"]);
    expect(pinsForLayer(board, "copper").map((p) => p.id)).toHaveLength(4);
    expect(pinsForLayer(board, "Mid-3").map((p) => p.id)).toHaveLength(4);
  });

  it("exposes the standard layer tab set", () => {
    expect(BOARD_LAYER_TABS).toContain("copper");
    expect(BOARD_LAYER_TABS).toContain("Top");
    expect(BOARD_LAYER_TABS).toContain("Bottom");
  });

  it.each([
    ["PP_VDD_MAIN", NetClassification.POWER_MAIN],
    ["PP_BATT_VCC", NetClassification.POWER_MAIN],
    ["GND", NetClassification.GROUND],
    ["I2C0_SDA", NetClassification.SIGNAL_I2C],
    ["SPI1_MOSI", NetClassification.SIGNAL_SPI],
    ["ANT_1_RF", NetClassification.RF_ANTENNA],
    ["PP_VDD_RF_MAIN", NetClassification.POWER_MAIN],
    ["UNKNOWN_X", NetClassification.POWER_BUCK],
  ])("classifies net %s as %s", (net, expected) => {
    expect(classifyNet(net)).toBe(expected);
  });
});