/**
 * NetNavigatorPanel (Unit 5C) — thin zero-logic React adapter.
 * All behavior lives in navigator-marker.ts + WorkbenchSearchService.
 * Calls recordSearch on query submit (5B learning).
 */
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Search, Clock, MapPin } from "lucide-react";
import type { WorkbenchFacade } from "../../application/workbench/WorkbenchFacade.js";
import type { SchematicCrossProbeIndex } from "../../domain/schematics/services/SchematicCrossProbeIndex.js";
import { computeFilteredNets, type FilteredNetEntry } from "./navigator-marker.js";

export interface NetNavigatorPanelProps {
  facade: WorkbenchFacade;
  crossProbe: SchematicCrossProbeIndex;
}

export function NetNavigatorPanel({ facade, crossProbe }: NetNavigatorPanelProps) {
  const [query, setQuery] = useState("");
  const [activeNet, setActiveNet] = useState<string | null>(null);
  const [allNets, setAllNets] = useState<string[]>([]);
  const lastSubmittedRef = useRef("");

  const filteredNets: FilteredNetEntry[] = useMemo(
    () => computeFilteredNets(allNets, query, crossProbe),
    [allNets, query, crossProbe],
  );
  const history: string[] = facade.searchService.history();

  const handleQueryChange = (e: React.ChangeEvent<HTMLInputElement>) => setQuery(e.target.value);
  const handleSubmit = () => {
    const trimmed = query.trim();
    if (trimmed.length > 0 && trimmed !== lastSubmittedRef.current) {
      facade.searchService.recordSearch(trimmed);
      lastSubmittedRef.current = trimmed;
    }
  };
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") handleSubmit();
  };

  useEffect(() => {
    return facade.bus.subscribe("selection.change", (sel) => {
      if (sel.net) {
        setActiveNet(sel.net);
        setAllNets((prev) => (prev.includes(sel.net!) ? prev : [...prev, sel.net!]));
      }
    });
  }, [facade]);

  useEffect(() => {
    const snap = facade.sessionStore.getSnapshot();
    const netsFromSession = snap.selection?.net ? [snap.selection.net] : [];
    if (netsFromSession.length > 0) setAllNets(netsFromSession);
  }, [facade]);

  return (
    <div className="h-full flex flex-col bg-slate-950 overflow-hidden font-mono text-[11px]" data-panel="navigator">
      <div className="h-8 px-2 flex items-center border-b border-slate-800 shrink-0">
        <Search className="w-3 h-3 text-slate-500 mr-1.5 shrink-0" />
        <input
          type="text"
          value={query}
          onChange={handleQueryChange}
          onKeyDown={handleKeyDown}
          placeholder="filter nets..."
          className="flex-1 bg-transparent text-slate-200 placeholder-slate-600 outline-none text-[11px]"
        />
      </div>

      <div className="flex-1 overflow-y-auto min-h-0">
        {query.trim().length > 0 && <SearchResults query={query} facade={facade} />}

        {filteredNets.length > 0 && (
          <div className="py-1">
            {filteredNets.map(({ net, marker }) => (
              <button
                key={net}
                onClick={() => facade.select({ boardId: "BRD_820_02106", net })}
                className={`w-full text-left px-2.5 py-1 flex items-center space-x-1.5 ${
                  activeNet === net ? "bg-cyan-500/10 text-cyan-400" : "text-slate-300 hover:bg-slate-800/60"
                }`}
              >
                <span className="truncate flex-1">{net}</span>
                {marker.type === "mapped" && (
                  <span className="shrink-0 flex items-center space-x-0.5 text-emerald-500">
                    <MapPin className="w-2.5 h-2.5" />
                    <span className="text-[9px]">{marker.pageNumbers.join(",")}</span>
                  </span>
                )}
                {marker.type === "not-in-schematic" && (
                  <span className="shrink-0 text-[9px] text-red-500/70">NOT IN SCHEMATIC</span>
                )}
              </button>
            ))}
          </div>
        )}

        {filteredNets.length === 0 && (
          <div className="px-2.5 py-2 text-slate-600 text-[10px]">
            {query.trim().length > 0 ? "no matching nets" : "no nets loaded"}
          </div>
        )}
      </div>

      {history.length > 0 && (
        <div className="border-t border-slate-800 px-2 py-1.5 shrink-0 max-h-16 overflow-y-auto">
          <div className="flex items-center space-x-1 text-[9px] text-slate-600 mb-1">
            <Clock className="w-2.5 h-2.5" />
            <span>history</span>
          </div>
          <div className="flex flex-wrap gap-1">
            {history.map((h) => (
              <button
                key={h}
                onClick={() => setQuery(h)}
                className="px-1.5 py-0.5 bg-slate-800/50 text-slate-400 hover:text-slate-200 hover:bg-slate-700/50 rounded text-[9px] truncate max-w-[100px]"
                title={h}
              >
                {h}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SearchResults({ query, facade }: { query: string; facade: WorkbenchFacade }) {
  const hits = facade.search(query);
  if (hits.length === 0) return null;
  return (
    <div className="border-b border-slate-800 py-1">
      {hits.slice(0, 5).map((hit) => (
        <div key={hit.id} className="px-2.5 py-0.5 flex items-center space-x-1.5 text-slate-400 hover:bg-slate-800/40">
          <span className="text-amber-400 font-semibold truncate flex-1">{hit.label}</span>
          <span className="text-[9px] text-slate-600 shrink-0">{hit.field}</span>
        </div>
      ))}
    </div>
  );
}
