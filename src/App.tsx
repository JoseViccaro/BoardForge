/// <reference types="vite/client" />
import React, { useState, useEffect } from "react";
import {
  BoardForgeShell,
  createWorkbenchFacade,
} from "./ui/workbench/BoardForgeShell.js";
import type { WorkbenchFacade } from "./application/workbench/WorkbenchFacade.js";

// Feature flag (unit 6E shell finalize): the new BoardForgeShell workbench is now
// the default entry point. The legacy single-pane boardview render was removed —
// the flag is kept as a named constant for a behavioral regression test and for
// future opt-out wiring (VITE_WORKBENCH=false is honored if ever re-introduced).
export const WORKBENCH_ENABLED = true;

export function App() {
  const [workspaceFacade, setWorkspaceFacade] = useState<WorkbenchFacade | null>(null);

  useEffect(() => {
    let cancelled = false;
    void createWorkbenchFacade().then((facade) => {
      if (!cancelled) setWorkspaceFacade(facade);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (workspaceFacade === null) {
    return (
      <div className="h-screen w-screen bg-slate-950 text-slate-100 flex items-center justify-center font-mono text-xs">
        Initializing workbench…
      </div>
    );
  }
  return <BoardForgeShell facade={workspaceFacade} />;
}
