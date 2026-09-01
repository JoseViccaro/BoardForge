/**
 * MeasurementPanel (Unit 6C) — thin zero-logic React adapter.
 *
 * Renders the diode-mode measurement form bound to the selected net/pin (via the
 * workbench bus), validates submissions through the pure `validateDiodeForm` core
 * (R1), captures via `MeasurementLogStore` (6A), and shows the chronological log,
 * trend and CSV/JSON export (6A historyFor/trendFor + 6B exportCSV/exportJSON).
 *
 * Zero business logic: validation lives in diode-form.ts, capture in the store.
 * In particular it SURFACES the store's record() rejection when no
 * MeasurementReference exists for the pad+state combo (6A learning) instead of
 * crashing silently.
 */
import React, { useEffect, useMemo, useState } from "react";
import { Download, RotateCcw } from "lucide-react";
import type { WorkbenchFacade } from "../../application/workbench/WorkbenchFacade.js";
import type { MeasurementProfile } from "../../domain/measurements/aggregates/MeasurementProfile.js";
import { DiagnosticBoardState } from "../../domain/measurements/value-objects/DiagnosticBoardState.js";
import { MultimeterProfile } from "../../domain/measurements/value-objects/MultimeterProfile.js";
import { validateDiodeForm, type DiodeFormInput } from "./diode-form.js";

export interface MeasurementPanelProps {
  facade: WorkbenchFacade;
  profile: MeasurementProfile;
}

const BOARD_STATES = Object.values(DiagnosticBoardState);
const METERS = [
  MultimeterProfile.FLUKE_115_STANDARD,
  MultimeterProfile.SUNSHINE_DT17N,
  MultimeterProfile.UNI_T_UT61E,
  MultimeterProfile.ANENG_Q1,
];

const ERROR_LABELS: Record<string, string> = {
  board_state_required: "board state is required",
  net_required: "net is required",
  pin_required: "pin is required",
  meter_required: "meter is required",
};

const TREND_CLASS: Record<string, string> = {
  UP: "text-red-400",
  DOWN: "text-cyan-400",
  STABLE: "text-emerald-400",
  NONE: "text-slate-500",
};

export function MeasurementPanel({ facade, profile }: MeasurementPanelProps) {
  const store = facade.measurementLogStore;

  const [boundNet, setBoundNet] = useState<string | null>(null);
  const [boundPin, setBoundPin] = useState<string | null>(null);
  const [boardState, setBoardState] = useState<DiagnosticBoardState | null>(
    DiagnosticBoardState.SPLIT_TOP
  );
  const [meter, setMeter] = useState<MultimeterProfile | null>(
    MultimeterProfile.FLUKE_115_STANDARD
  );
  const [volts, setVolts] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Bind the selected net/pin from the bus (mirrors NetNavigatorPanel).
  useEffect(() => {
    return facade.bus.subscribe("selection.change", (sel) => {
      if (sel.net) setBoundNet(sel.net);
      if (sel.pin) setBoundPin(sel.pin);
    });
  }, [facade]);

  const padId = boundPin;
  const history = useMemo(() => (padId ? store.historyFor(padId) : []), [store, padId]);
  const trend = useMemo(() => (padId ? store.trendFor(padId) : "NONE"), [store, padId]);

  const handleSubmit = async () => {
    setError(null);
    const parsed = Number.parseFloat(volts);
    const input: DiodeFormInput = {
      net: boundNet,
      pin: boundPin,
      boardState,
      meterProfile: meter,
      measuredVolts: Number.isFinite(parsed) ? parsed : NaN,
    };
    const verdict = validateDiodeForm(input);
    if (!verdict.ok) {
      setError("Cannot record: " + verdict.errors.map((c) => ERROR_LABELS[c] ?? c).join(", "));
      return;
    }
    try {
      await store.record({
        profile,
        padId: verdict.value.pin,
        boardState: verdict.value.boardState,
        measuredVolts: verdict.value.measuredVolts,
        meterProfile: verdict.value.meterProfile,
        netName: verdict.value.net,
      });
      setVolts("");
    } catch (e) {
      // 6A learning: record() rejects on a missing MeasurementReference.
      setError(e instanceof Error ? e.message : "Failed to record measurement.");
    }
  };

  const download = (blob: Blob, name: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  };

  const inputCls =
    "flex-1 bg-slate-900 border border-slate-700 rounded px-1.5 py-1 text-slate-200 placeholder-slate-600";
  const lab = "text-slate-500 w-10 shrink-0";

  return (
    <div className="h-full flex flex-col bg-slate-950 overflow-hidden font-mono text-[11px]" data-panel="measurements">
      <div className="h-8 px-3 flex items-center justify-between border-b border-slate-800 shrink-0">
        <span className="text-slate-400 font-semibold uppercase tracking-wider">Diode Measurement</span>
        <span className="flex items-center space-x-1">
          <button onClick={() => download(new Blob([store.exportCSV()], { type: "text/csv" }), "measurements.csv")} className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center space-x-1">
            <Download className="w-2.5 h-2.5" /> CSV
          </button>
          <button onClick={() => download(new Blob([store.exportJSON()], { type: "application/json" }), "measurements.json")} className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center space-x-1">
            <Download className="w-2.5 h-2.5" /> JSON
          </button>
        </span>
      </div>

      <div className="px-3 py-2 border-b border-slate-800 space-y-1.5 shrink-0">
        <div className="flex items-center space-x-2">
          <span className={lab}>Net</span>
          <span className="px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 font-bold truncate flex-1">{boundNet ?? "—"}</span>
          <span className={lab}>Pin</span>
          <span className="px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 font-bold truncate flex-1">{boundPin ?? "—"}</span>
        </div>
        <div className="flex items-center space-x-2">
          <span className={lab}>State</span>
          <select value={boardState ?? ""} onChange={(e) => setBoardState(e.target.value === "" ? null : (e.target.value as DiagnosticBoardState))} className={inputCls}>
            <option value="">— unset —</option>
            {BOARD_STATES.map((s) => (<option key={s} value={s}>{s}</option>))}
          </select>
        </div>
        <div className="flex items-center space-x-2">
          <span className={lab}>Meter</span>
          <select value={meter?.name ?? ""} onChange={(e) => setMeter(METERS.find((m) => m.name === e.target.value) ?? null)} className={inputCls}>
            <option value="">— none —</option>
            {METERS.map((m) => (<option key={m.name} value={m.name}>{m.name}</option>))}
          </select>
        </div>
        <div className="flex items-center space-x-2">
          <span className={lab}>Volts</span>
          <input type="number" step="0.001" value={volts} onChange={(e) => setVolts(e.target.value)} placeholder="0.000" className={inputCls} />
          <button onClick={handleSubmit} className="px-3 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-bold shrink-0">Record</button>
          <button onClick={() => { setVolts(""); setError(null); }} className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 shrink-0" title="Clear"><RotateCcw className="w-3 h-3" /></button>
        </div>
        {error && (
          <div className="px-2 py-1 rounded bg-red-500/10 text-red-400 border border-red-500/30 text-[10px] break-words">{error}</div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto min-h-0">
        {history.length === 0 ? (
          <div className="px-3 py-2 text-slate-600 text-[10px]">no readings for this pad</div>
        ) : (
          <div className="px-2 py-1">
            <div className="flex items-center space-x-2 text-[9px] text-slate-600 mb-1">
              <span>trend</span>
              <span className={`font-bold ${TREND_CLASS[trend] ?? "text-slate-500"}`}>{trend}</span>
            </div>
            {history.slice().reverse().map((entry) => (
              <div key={entry.recordedAt + entry.padId} className="flex items-center space-x-2 py-0.5 text-slate-300">
                <span className="text-amber-400 font-semibold w-10">{entry.normalizedVolts.toFixed(3)}V</span>
                <span className="text-slate-500">{entry.outcome}</span>
                <span className="ml-auto text-[9px] text-slate-600">{entry.recordedAt}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
