import React, { useState, useEffect } from "react";
import { JCDirectWorkbench } from "./ui/workbench/JCDirectWorkbench.js";
import { createWorkbenchFacade } from "./ui/workbench/BoardForgeShell.js";
import type { WorkbenchFacade } from "./application/workbench/WorkbenchFacade.js";

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
      <div className="h-screen w-screen bg-[#0f172a] text-slate-100 flex items-center justify-center font-mono text-xs">
        Initializing JC-Forge Workbench…
      </div>
    );
  }
  return <JCDirectWorkbench facade={workspaceFacade} />;
}
