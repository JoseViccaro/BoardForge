/**
 * BoardViewPanel (PR 2, boardforge-redesign).
 *
 * Thin React adapter over the pure boardview core in `src/ui/extract-render.ts`.
 * Renders the board canvas, layer tabs, hover tooltip (net info + classification)
 * and pin click reveal (linked schematic pages/coordinates/nets via the
 * SchematicCrossProbeIndex). Subscribes to `selection.change` on the workbench
 * bus so external selections drive the highlight at sub-second latency, and
 * publishes clicks through `facade.select` (same topic).
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import { ZoomIn, ZoomOut, Layers } from "lucide-react";
import type { WorkbenchFacade } from "../../application/workbench/WorkbenchFacade.js";
import type { SchematicCrossProbeIndex } from "../../domain/schematics/services/SchematicCrossProbeIndex.js";
import {
  renderBoard,
  hitTestPin,
  selectionTargetForPin,
  applySelectionToBoard,
  crossProbeRevealForPin,
  classifyNet,
  isPinHighlighted,
  BOARD_LAYER_TABS,
  type BoardGeometryData,
  type CanvasLike,
  type CrossProbeReveal,
} from "../extract-render.js";

export interface BoardViewPanelProps {
  facade: WorkbenchFacade;
  boardId: string;
  boardData: BoardGeometryData;
  crossProbe: SchematicCrossProbeIndex;
}

export function BoardViewPanel({ facade, boardId, boardData, crossProbe }: BoardViewPanelProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [activeNet, setActiveNet] = useState<string>("PP_VDD_MAIN");
  const [selectedPinId, setSelectedPinId] = useState<string | null>(null);
  const [hoveredPinId, setHoveredPinId] = useState<string | null>(null);
  const [activeLayerTab, setActiveLayerTab] = useState<string>("copper");
  const [reveal, setReveal] = useState<CrossProbeReveal | null>(null);

  // Camera transform calibrated for clean view of the 4 board layout
  const [scale, setScale] = useState<number>(6.5);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 40, y: 30 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Bus subscription: external selection.change drives the highlight state
  useEffect(() => {
    return facade.bus.subscribe("selection.change", (selection) => {
      const effect = applySelectionToBoard(selection, boardData);
      setActiveNet((prev) => effect.activeNet ?? prev);
      if (effect.selectedPinId !== null) setSelectedPinId(effect.selectedPinId);
    });
  }, [facade, boardData]);

  // Paint frame (pure pipeline — no behavior change from the legacy render)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    renderBoard(canvas as CanvasLike, boardData, {
      activeNet,
      selectedPinId,
      hoveredPinId,
      showDiodeValues: true,
      scale,
      pan,
      layerTab: activeLayerTab,
      devicePixelRatio: window.devicePixelRatio || 1,
    });
  }, [boardData, activeNet, selectedPinId, hoveredPinId, scale, pan, activeLayerTab]);

  const handleWheel = useCallback(
    (e: React.WheelEvent<HTMLCanvasElement>) => {
      e.preventDefault();
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      const zoomFactor = e.deltaY < 0 ? 1.2 : 0.83;
      const newScale = Math.min(Math.max(scale * zoomFactor, 1.2), 180.0);
      setScale(newScale);
      setPan({
        x: mouseX - (mouseX - pan.x) * (newScale / scale),
        y: mouseY - (mouseY - pan.y) * (newScale / scale),
      });
    },
    [scale, pan]
  );

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.button === 0 || e.button === 1) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (isDragging) {
      setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
      return;
    }
    const rect = canvas.getBoundingClientRect();
    const worldX = (e.clientX - rect.left - pan.x) / scale;
    const worldY = (e.clientY - rect.top - pan.y) / scale;
    const hit = hitTestPin(boardData, worldX, worldY);
    setHoveredPinId(hit?.id ?? null);
  };

  const handleMouseUp = () => setIsDragging(false);

  const handleCanvasClick = () => {
    if (!hoveredPinId) return;
    const pin = boardData.pins.find((p) => p.id === hoveredPinId);
    if (!pin) return;
    setSelectedPinId(pin.id);
    setReveal(crossProbeRevealForPin(crossProbe, pin));
    // Click path: pin -> selection target -> workbench bus (cross-panel sync)
    facade.select(selectionTargetForPin(pin, boardId));
  };

  const highlightedCount = boardData.pins.filter((p) => isPinHighlighted(p, activeNet)).length;
  const selectedPin = selectedPinId ? boardData.pins.find((p) => p.id === selectedPinId) : undefined;

  return (
    <div className="flex-1 flex flex-col bg-slate-950 overflow-hidden min-w-0">
      <div className="h-9 bg-slate-900 border-b border-slate-800 px-4 flex items-center justify-between text-xs shrink-0">
        <div className="flex items-center space-x-2 font-mono">
          <span className="text-slate-400">Active Net:</span>
          <span className="px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 font-bold">
            {activeNet}
          </span>
          <span className="text-slate-500">|</span>
          <span className="text-slate-400">Highlighted Pads:</span>
          <span className="text-emerald-400 font-bold">{highlightedCount}</span>
          <span className="text-slate-500">|</span>
          <span className="text-slate-400">Zoom: {(scale * 20).toFixed(0)}%</span>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setScale((s) => Math.min(s * 1.3, 180.0))}
            className="p-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700"
            title="Zoom In"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setScale((s) => Math.max(s * 0.77, 1.2))}
            className="p-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700"
            title="Zoom Out"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden min-h-0 relative">
        <div className="flex-1 flex flex-col relative overflow-hidden min-w-0">
          <div className="flex-1 relative overflow-hidden w-full h-full bg-[#040508]">
            <canvas
              ref={canvasRef}
              onWheel={handleWheel}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onClick={handleCanvasClick}
              className="absolute inset-0 w-full h-full cursor-crosshair block"
            />
          </div>

          <div className="h-8 bg-slate-900 border-t border-slate-800 px-3 flex items-center justify-between text-[11px] shrink-0 z-10">
            <div className="flex items-center space-x-1 overflow-x-auto">
              <span className="px-2 py-0.5 bg-slate-950 text-slate-400 border border-slate-800 rounded font-semibold text-[10px] mr-1 flex items-center space-x-1">
                <Layers className="w-2.5 h-2.5" />
                <span>Layers:</span>
              </span>
              {BOARD_LAYER_TABS.map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveLayerTab(tab)}
                  className={`px-2 py-0.5 rounded text-[10px] font-medium transition ${
                    activeLayerTab === tab
                      ? "bg-amber-400 text-slate-950 font-bold shadow"
                      : "bg-slate-800 text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
            <div className="text-[10px] font-mono text-slate-400 shrink-0">
              {boardData.pins.length} pads · {boardData.components.length} components
            </div>
          </div>
        </div>

        <aside className="w-64 bg-slate-900 border-l border-slate-800 p-2.5 shrink-0 overflow-y-auto custom-scrollbar">
          <div className="bg-slate-950 border border-slate-800 rounded-lg p-3">
            <div className="text-[11px] font-bold text-slate-300 uppercase tracking-wider border-b border-slate-800 pb-1.5 mb-2">
              Pin Details
            </div>
            {selectedPin ? (
              <div className="space-y-1.5 text-xs font-mono">
                <div className="flex justify-between">
                  <span className="text-slate-400 text-[11px]">Pin:</span>
                  <strong className="text-amber-400">{selectedPin.id}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 text-[11px]">Net:</span>
                  <strong className="text-cyan-400">{selectedPin.net}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 text-[11px]">Class:</span>
                  <span className="text-slate-200">{classifyNet(selectedPin.net)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 text-[11px]">Board:</span>
                  <span className="text-slate-200">{selectedPin.boardIndex}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 text-[11px]">Diode Vf:</span>
                  <span className="text-emerald-400">
                    {selectedPin.diodeMv !== undefined ? `${selectedPin.diodeMv} mV` : "N/A"}
                  </span>
                </div>
              </div>
            ) : (
              <div className="text-[10px] text-slate-500">Click a pad on the board to inspect.</div>
            )}

            <div className="mt-2.5 pt-2.5 border-t border-slate-800">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                Schematic Reveal
              </div>
              {reveal ? (
                <div className="space-y-1 text-[10px] font-mono">
                  <div className="flex justify-between">
                    <span className="text-slate-400">RefDes:</span>
                    <span className="text-amber-400 font-bold">{reveal.refDes}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Pages:</span>
                    <span className="text-slate-200">
                      {reveal.pages.length > 0 ? reveal.pages.join(", ") : "—"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Nets:</span>
                    <span className="text-cyan-400">
                      {reveal.connectedNets.length > 0 ? reveal.connectedNets.join(", ") : "—"}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="text-[10px] text-slate-500">Click a pad to cross-probe.</div>
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}