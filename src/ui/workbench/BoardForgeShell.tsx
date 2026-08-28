import React, { useSyncExternalStore } from "react";
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
import { createIPhone13LogicBoardFixture } from "../../infrastructure/seeds/iPhone13_820_02106_Seed.js";
import { iPhone13SchematicFixtures } from "../../infrastructure/seeds/iPhone13SchematicFixtures.js";

/**
 * BoardForgeShell — workbench panel shell (PR 1 skeleton).
 *
 * Renders the four panel slots (boardview, schematics, navigator, measurements)
 * and subscribes to the SessionStore via useSyncExternalStore (D1). Real panels
 * land in PR 2-6; until then each slot shows a placeholder.
 */

export function BoardForgeShell({ facade }: { facade: WorkbenchFacade }) {
  const session = useSyncExternalStore(
    (listener) => facade.sessionStore.subscribe(listener),
    () => facade.sessionStore.getSnapshot()
  );

  const pairing = session.pairing;

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
            <div className="text-[11px] text-slate-400">Synchronized repair workbench — panels land in PR 2-6</div>
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
          className="flex-1 bg-slate-950 border-r border-slate-800 flex items-center justify-center"
        >
          <div className="text-center text-slate-600">
            <div className="text-[11px] font-mono uppercase tracking-wider mb-1">BoardView Panel</div>
            <div className="text-[10px] font-mono text-slate-700">slot · placeholder (PR 2)</div>
          </div>
        </section>
        <section
          data-panel="schematics"
          className="flex-1 bg-slate-950 flex items-center justify-center"
        >
          <div className="text-center text-slate-600">
            <div className="text-[11px] font-mono uppercase tracking-wider mb-1">Schematics Panel</div>
            <div className="text-[10px] font-mono text-slate-700">slot · placeholder (PR 3)</div>
          </div>
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