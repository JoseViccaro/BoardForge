import React, { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";
import { WorkbenchFacade } from "../../application/workbench/WorkbenchFacade.js";
import { BoardViewFacade } from "../../application/boardview/BoardViewFacade.js";
import { SchematicsFacade } from "../../application/schematics/SchematicsFacade.js";
import { MeasurementsFacade } from "../../application/measurements/MeasurementsFacade.js";
import { WorkbenchEventBus } from "../../application/workbench/WorkbenchEventBus.js";
import {
  SessionStore,
  IndexedDbSessionStorage,
} from "../../application/workbench/SessionStore.js";
import { InMemoryCompositeBoardRepository } from "../../infrastructure/persistence/in-memory/InMemoryCompositeBoardRepository.js";
import { InMemoryNetTopologyRepository } from "../../infrastructure/persistence/in-memory/InMemoryNetTopologyRepository.js";
import { InMemoryMeasurementRepository } from "../../infrastructure/persistence/in-memory/InMemoryMeasurementRepository.js";
import { BoardViewParserFactory } from "../../infrastructure/boardview/parsers/BoardViewParserFactory.js";
import { BoardViewToCanonicalTransformer } from "../../domain/boardview/services/BoardViewToCanonicalTransformer.js";
import { SchematicCrossProbeIndex } from "../../domain/schematics/services/SchematicCrossProbeIndex.js";
import { createIPhone13LogicBoardFixture } from "../../infrastructure/seeds/iPhone13_820_02106_Seed.js";
import { iPhone13SchematicFixtures } from "../../infrastructure/seeds/iPhone13SchematicFixtures.js";
import { generateExactIPhone13MasterCAD } from "../../domain/boardview/geometry/iPhone13Exact4BoardCAD.js";
import type { SchematicDocument } from "../../domain/schematics/aggregates/SchematicDocument.js";
import { BoardViewPanel } from "../boardview/BoardViewPanel.js";
import { SchematicPanel } from "../schematics/SchematicPanel.js";
import { NetNavigatorPanel } from "../net/NetNavigatorPanel.js";
import { MeasurementPanel } from "../measure/MeasurementPanel.js";
import {
  resolveShortcut,
  type KeyboardEventDescriptor,
  type WorkbenchAction,
} from "./keyboardShortcuts.js";
import { computePanelWidths } from "./panelResize.js";

/** Board opened by the shell through the workbench facade (seeded iPhone 13). */
const SHELL_BOARD_ID = "BRD_820_02106";

/**
 * BoardForgeShell — workbench panel shell (PR 1 skeleton + PR 2 boardview).
 *
 * Renders the four panel slots (boardview, schematics, navigator, measurements)
 * and subscribes to the SessionStore via useSyncExternalStore (D1). The
 * boardview slot is live since PR 2; the remaining slots land in PR 3-6.
 */

export function BoardForgeShell({ facade }: { facade: WorkbenchFacade }) {
  const session = useSyncExternalStore(
    (listener) => facade.sessionStore.subscribe(listener),
    () => facade.sessionStore.getSnapshot()
  );

  const pairing = session.pairing;

  // Open the seeded iPhone 13 board on mount: resolves the companion schematic
  // (pairing.resolved on the bus) and provides the selection boardId.
  useEffect(() => {
    void facade.openBoard(SHELL_BOARD_ID, { boardModel: "iPhone13", boardRevision: "820-02106" });
  }, [facade]);

  // --- Keyboard shortcuts (Unit 4B) ----------------------------------------
  //
  // Cross-probe enabled state. Toggled by the Ctrl+Shift+X shortcut.
  // The shell owns this state; panels can consume it via props when wired.
  const [crossProbeEnabled, setCrossProbeEnabled] = React.useState(true);

  /**
   * Applies a resolved keyboard shortcut action to the workbench.
   * The shell is a zero-logic adapter: it translates pure-core actions into
   * DOM side effects (focus) or bus events (search-focus, cross-probe-toggle).
   */
  const applyAction = useCallback(
    (action: WorkbenchAction) => {
      switch (action.type) {
        case "panel-focus": {
          const el = document.querySelector<HTMLElement>(
            `[data-panel="${action.panel}"]`
          );
          el?.focus();
          break;
        }
        case "search-focus": {
          // Emit on the bus so future search consumers can react.
          facade.bus.publish("search.focus", { query: "" });
          break;
        }
        case "cross-probe-toggle": {
          setCrossProbeEnabled((prev) => !prev);
          break;
        }
      }
    },
    [facade]
  );

  // Attach a global keydown listener that normalizes the DOM event into a
  // KeyboardEventDescriptor and delegates to the pure resolveShortcut core.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const desc: KeyboardEventDescriptor = {
        ctrlKey: e.ctrlKey,
        metaKey: e.metaKey,
        altKey: e.altKey,
        shiftKey: e.shiftKey,
        key: e.key,
      };

      const action = resolveShortcut(desc);
      if (action !== null) {
        e.preventDefault();
        applyAction(action);
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [applyAction]);

  // --- Panel resize (D5 interactive splitter) --------------------------------
  //
  // Pure-core panel resize: the shell tracks pointer events on a draggable
  // divider, delegates width computation to the DOM-free computePanelWidths
  // core, and persists the result through the existing session pipeline.
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = React.useState(0);
  const dragRef = React.useRef<{
    pointerId: number;
    startX: number;
    containerWidth: number;
    startLeftWidth: number;
  } | null>(null);
  const dragLeftWidthRef = React.useRef<number | null>(null);
  const [dragLeftWidth, setDragLeftWidth] = React.useState<number | null>(null);

  // Track container width for live resize calculations.
  React.useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) setContainerWidth(entry.contentRect.width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Read persisted panel widths from the session.
  const boardviewPanel = session.panels.find((p) => p.id === "boardview");

  // Clamp persisted width against current container; drag override takes precedence.
  const clampedLeftWidth =
    containerWidth > 0 && boardviewPanel?.size?.width != null
      ? computePanelWidths(containerWidth, boardviewPanel.size.width).leftWidth
      : undefined;
  const effectiveLeftWidth = dragLeftWidth ?? clampedLeftWidth;
  const hasExplicitWidth = effectiveLeftWidth != null;

  // Divider pointer handlers — logic delegates to the pure panelResize core.
  const onDividerPointerDown = React.useCallback(
    (e: React.PointerEvent) => {
      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const currentLeft = effectiveLeftWidth ?? rect.width / 2;
      dragRef.current = {
        pointerId: e.pointerId,
        startX: e.clientX,
        containerWidth: rect.width,
        startLeftWidth: currentLeft,
      };
      dragLeftWidthRef.current = currentLeft;
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      e.preventDefault();
    },
    [effectiveLeftWidth],
  );

  const onDividerPointerMove = React.useCallback(
    (e: React.PointerEvent) => {
      if (!dragRef.current || e.pointerId !== dragRef.current.pointerId) return;
      const delta = e.clientX - dragRef.current.startX;
      const raw = dragRef.current.startLeftWidth + delta;
      const { leftWidth } = computePanelWidths(dragRef.current.containerWidth, raw);
      dragLeftWidthRef.current = leftWidth;
      setDragLeftWidth(leftWidth);
    },
    [],
  );

  const onDividerPointerUp = React.useCallback(
    (e: React.PointerEvent) => {
      if (!dragRef.current || e.pointerId !== dragRef.current.pointerId) return;
      const cw = dragRef.current.containerWidth;
      const finalLeft = dragLeftWidthRef.current ?? dragRef.current.startLeftWidth;
      dragRef.current = null;
      dragLeftWidthRef.current = null;
      setDragLeftWidth(null);

      // Persist the new panel sizes through the session pipeline.
      const panels = session.panels.map((p) => {
        if (p.id === "boardview")
          return { ...p, size: { width: finalLeft, height: p.size?.height ?? 0 } };
        if (p.id === "schematics")
          return { ...p, size: { width: cw - finalLeft, height: p.size?.height ?? 0 } };
        return p;
      });
      facade.sessionStore.update({ ...session, panels });
      void facade.sessionStore.save();
    },
    [session, facade],
  );

  // Panel data: iPhone 13 CAD geometry (matches the opened board + schematic).
  const boardData = useMemo(() => generateExactIPhone13MasterCAD(), []);

  // Cross-probe index fed from the schematic fixture (consumed on pin click),
  // plus the fixture's schematic document consumed by the SchematicPanel.
  const schematicDocument: SchematicDocument = useMemo(
    () => iPhone13SchematicFixtures.createFixtures().document,
    []
  );

  const crossProbe = useMemo(() => {
    const index = new SchematicCrossProbeIndex();
    index.registerSchematicDocument(schematicDocument);
    return index;
  }, [schematicDocument]);

  // Measurement profile backing the diode-mode references (read from the seed).
  const measurementProfile = useMemo(
    () => createIPhone13LogicBoardFixture().measurementProfile,
    []
  );

  const boardId = pairing?.boardId ?? SHELL_BOARD_ID;

  return (
    <div className="flex flex-col h-screen w-screen bg-slate-950 text-slate-100 overflow-hidden font-sans select-none">
      {/* JCID / ZXW Professional Top Diagnostic Ribbon */}
      <header className="h-10 bg-[#0f172a] border-b border-slate-700/80 px-2 flex items-center justify-between shrink-0 z-30 select-none">
        {/* Left: Quick Actions Ribbon */}
        <div className="flex items-center space-x-1">
          <div className="flex items-center space-x-1.5 px-2 py-0.5 bg-gradient-to-r from-blue-600 to-indigo-600 rounded text-white font-black text-xs shadow-sm mr-2">
            <span>JC-Forge</span>
            <span className="text-[9px] font-normal opacity-80">v3.2</span>
          </div>

          <div className="flex items-center space-x-1 border-r border-slate-700 pr-2 mr-1">
            <button className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded text-[11px] font-medium flex items-center space-x-1">
              <span>📱 Model Tree</span>
            </button>
            <button className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded text-[11px] font-medium flex items-center space-x-1">
              <span>📷 Real View</span>
            </button>
            <button className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 rounded text-[11px] font-medium flex items-center space-x-1">
              <span>⚡ Volt (mV)</span>
            </button>
            <button className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-slate-700 rounded text-[11px] font-medium flex items-center space-x-1">
              <span>Ω Diode/Ress</span>
            </button>
          </div>

          <div className="flex items-center space-x-1">
            <span className="px-2 py-0.5 bg-blue-500/10 text-blue-400 border border-blue-500/30 rounded text-[10px] font-mono font-bold">
              iPhone 13 (820-02106)
            </span>
            <span className="px-2 py-0.5 bg-amber-500/10 text-amber-400 border border-amber-500/30 rounded text-[10px] font-mono">
              Dual BoardView (Side A + Side B)
            </span>
          </div>
        </div>

        {/* Right: Companion Pairing & Status */}
        <div className="flex items-center space-x-2 text-xs font-mono">
          <span className="text-slate-400 text-[11px]">Pairing:</span>
          {pairing ? (
            <span
              className={`px-2 py-0.5 rounded border text-[10px] font-bold ${
                pairing.diagnostic === "OK"
                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                  : "bg-amber-500/10 text-amber-400 border-amber-500/30"
              }`}
            >
              {pairing.diagnostic === "OK" ? `SYNC OK · ${pairing.schematicId}` : "NO_COMPANION"}
            </span>
          ) : (
            <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-500 border border-slate-700 text-[10px]">—</span>
          )}
        </div>
      </header>

      <div ref={containerRef} className="flex-1 flex overflow-hidden">
        <section
          data-panel="boardview"
          style={hasExplicitWidth ? { flex: `0 0 ${effectiveLeftWidth}px` } : undefined}
          className="flex-1 bg-slate-950 border-r border-slate-800 flex flex-col overflow-hidden"
        >
          <BoardViewPanel
            facade={facade}
            boardId={boardId}
            boardData={boardData}
            crossProbe={crossProbe}
          />
        </section>
        <div
          className="w-1 shrink-0 cursor-col-resize bg-slate-700 hover:bg-slate-500 active:bg-slate-400 z-10"
          onPointerDown={onDividerPointerDown}
          onPointerMove={onDividerPointerMove}
          onPointerUp={onDividerPointerUp}
        />
        <section
          data-panel="schematics"
          className="flex-1 bg-slate-950 flex flex-col overflow-hidden"
        >
          <SchematicPanel
            facade={facade}
            document={schematicDocument}
            crossProbe={crossProbe}
          />
        </section>
      </div>

      <div className="flex h-44 border-t border-slate-800 bg-slate-900/60">
        <section
          data-panel="navigator"
          className="w-72 border-r border-slate-800 flex flex-col overflow-hidden"
        >
          <NetNavigatorPanel facade={facade} crossProbe={crossProbe} />
        </section>
        <section data-panel="measurements" className="flex-1 flex flex-col overflow-hidden">
          <MeasurementPanel facade={facade} profile={measurementProfile} />
        </section>
      </div>

      <footer className="h-8 bg-slate-900 border-t border-slate-800 px-4 flex items-center justify-between text-[10px] font-mono text-slate-500 shrink-0">
        <span>
          session v{session.version} · panels {session.panels.filter((p) => p.visible).length}/4 ·{" "}
          {session.searchHistory.length} search entries
        </span>
        <span className="text-slate-600">{session.updatedAt}</span>
      </footer>
    </div>
  );
}

/**
 * Composition root for the workbench slice: wires the existing facades with the
 * seeded iPhone 13 fixtures, the event bus, and the IndexedDB-backed SessionStore.
 */
export async function createWorkbenchFacade(): Promise<WorkbenchFacade> {
  const boardFixture = createIPhone13LogicBoardFixture();

  const boardRepo = new InMemoryCompositeBoardRepository();
  await boardRepo.save(boardFixture.compositeBoard);

  const topologyRepo = new InMemoryNetTopologyRepository();
  for (const topology of boardFixture.netTopologies) {
    await topologyRepo.save(topology);
  }

  const measurementRepo = new InMemoryMeasurementRepository();
  await measurementRepo.save(boardFixture.measurementProfile);

  const boardViewFacade = new BoardViewFacade(
    boardRepo,
    topologyRepo,
    new BoardViewParserFactory(),
    new BoardViewToCanonicalTransformer()
  );

  const schematicsFacade = new SchematicsFacade();
  schematicsFacade.saveDocument(iPhone13SchematicFixtures.createFixtures().document);

  const measurementsFacade = new MeasurementsFacade(measurementRepo);

  const bus = new WorkbenchEventBus();
  const sessionStore = new SessionStore(new IndexedDbSessionStorage());

  return new WorkbenchFacade({
    boardViewFacade,
    schematicsFacade,
    measurementsFacade,
    bus,
    sessionStore,
    defaultBoardModel: "iPhone13",
  });
}