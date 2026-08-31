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
import {
  resolveShortcut,
  type KeyboardEventDescriptor,
  type WorkbenchAction,
} from "./keyboardShortcuts.js";

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

  const boardId = pairing?.boardId ?? SHELL_BOARD_ID;

  return (
    <div className="flex flex-col h-screen w-screen bg-slate-950 text-slate-100 overflow-hidden font-sans select-none">
      <header className="h-14 bg-slate-900 border-b border-slate-800 px-4 flex items-center justify-between shrink-0 z-30">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center font-black text-slate-950 text-base shadow-lg shadow-amber-500/20">
            BF
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-bold text-slate-100 tracking-tight text-sm">BoardForge Workbench</span>
              <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded">
                PLATFORM FOUNDATION
              </span>
            </div>
            <div className="text-[11px] text-slate-400">
              Synchronized repair workbench — boardview + schematics live (PR 2/3) · navigator/measure in PR 5-6
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2 text-xs font-mono">
          <span className="text-slate-400">Pairing:</span>
          {pairing ? (
            <span
              className={`px-2 py-0.5 rounded border font-bold ${
                pairing.diagnostic === "OK"
                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                  : "bg-amber-500/10 text-amber-400 border-amber-500/30"
              }`}
            >
              {pairing.diagnostic === "OK" ? `OK · ${pairing.schematicId}` : "NO_COMPANION"}
            </span>
          ) : (
            <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-500 border border-slate-700">—</span>
          )}
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <section
          data-panel="boardview"
          className="flex-1 bg-slate-950 border-r border-slate-800 flex flex-col overflow-hidden"
        >
          <BoardViewPanel
            facade={facade}
            boardId={boardId}
            boardData={boardData}
            crossProbe={crossProbe}
          />
        </section>
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
          className="w-72 border-r border-slate-800 flex items-center justify-center"
        >
          <div className="text-center text-slate-600">
            <div className="text-[11px] font-mono uppercase tracking-wider mb-1">Net Navigator</div>
            <div className="text-[10px] font-mono text-slate-700">slot · placeholder (PR 5)</div>
          </div>
        </section>
        <section data-panel="measurements" className="flex-1 flex items-center justify-center">
          <div className="text-center text-slate-600">
            <div className="text-[11px] font-mono uppercase tracking-wider mb-1">Measurement Capture</div>
            <div className="text-[10px] font-mono text-slate-700">slot · placeholder (PR 6)</div>
          </div>
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