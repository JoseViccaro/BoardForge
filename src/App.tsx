/// <reference types="vite/client" />
import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { 
  Search, 
  RotateCw, 
  Zap, 
  Activity, 
  Cpu, 
  ZoomIn, 
  ZoomOut, 
  Maximize2,
  Layers,
  Sparkles,
  ShieldCheck,
  Eye,
  Sliders,
  Radio,
  HardDrive,
  Upload,
  FileCode,
  CheckCircle2
} from "lucide-react";
import { generateExactIPhone11ProMasterCAD, IPhone11ProPin, IPhone11ProComp } from "./domain/boardview/geometry/iPhone11ProExact4BoardCAD";
import {
  BoardForgeShell,
  createWorkbenchFacade,
} from "./ui/workbench/BoardForgeShell.js";
import type { WorkbenchFacade } from "./application/workbench/WorkbenchFacade.js";

// Feature flag (PR 1 Platform Foundation): the legacy single-pane boardview stays
// the default until all workbench panels land (PR 6 flips the default to true).
// Enable via VITE_WORKBENCH=true|1.
const WORKBENCH_ENABLED =
  import.meta.env.VITE_WORKBENCH === "1" || import.meta.env.VITE_WORKBENCH === "true";

export function App() {
  const [workspaceFacade, setWorkspaceFacade] = useState<WorkbenchFacade | null>(null);

  useEffect(() => {
    if (!WORKBENCH_ENABLED) return;
    let cancelled = false;
    void createWorkbenchFacade().then((facade) => {
      if (!cancelled) setWorkspaceFacade(facade);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!WORKBENCH_ENABLED) {
    return <LegacyBoardView />;
  }
  if (workspaceFacade === null) {
    return (
      <div className="h-screen w-screen bg-slate-950 text-slate-100 flex items-center justify-center font-mono text-xs">
        Initializing workbench…
      </div>
    );
  }
  return <BoardForgeShell facade={workspaceFacade} />;
}

export function LegacyBoardView() {
  const [boardData, setBoardData] = useState(() => generateExactIPhone11ProMasterCAD());
  const [activeNet, setActiveNet] = useState<string>("PP_VDD_MAIN");
  const [selectedPin, setSelectedPin] = useState<IPhone11ProPin | null>(null);
  const [hoveredPin, setHoveredPin] = useState<IPhone11ProPin | null>(null);
  const [activeLayerTab, setActiveLayerTab] = useState<string>("copper");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [showDiodeValues, setShowDiodeValues] = useState<boolean>(true);
  
  // Camera transform calibrated for the 4-Board iPhone 11 Pro Layout
  const [scale, setScale] = useState<number>(4.4);
  const [pan, setPan] = useState<{ x: 30, y: -40 }>({ x: 30, y: -40 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Diagnostics
  const [meterProfile, setMeterProfile] = useState<string>("FLUKE_115");
  const [pmuState, setPmuState] = useState<string>("S0_FULL_EXECUTION");

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Set default selection to A13 Bionic
  useEffect(() => {
    const p = boardData.pins.find(pin => pin.comp === "U0100") || boardData.pins[0];
    if (p) setSelectedPin(p);
  }, [boardData]);

  // =========================================================================
  // MOUSE WHEEL ZOOM & PAN (CENTRALIZED ON CURSOR POSITION)
  // =========================================================================
  const handleWheel = useCallback((e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const zoomFactor = e.deltaY < 0 ? 1.2 : 0.83;
    const newScale = Math.min(Math.max(scale * zoomFactor, 1.2), 180.0);

    const newPanX = mouseX - (mouseX - pan.x) * (newScale / scale);
    const newPanY = mouseY - (mouseY - pan.y) * (newScale / scale);

    setScale(newScale);
    setPan({ x: newPanX, y: newPanY });
  }, [scale, pan]);

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
    } else {
      const rect = canvas.getBoundingClientRect();
      const worldX = (e.clientX - rect.left - pan.x) / scale;
      const worldY = (e.clientY - rect.top - pan.y) / scale;

      const hit = boardData.pins.find(p => {
        if (p.shape === "CIRCLE") {
          const dx = p.x - worldX;
          const dy = p.y - worldY;
          return (dx * dx + dy * dy) <= (p.r || 0.22) * (p.r || 0.22) * 2.2;
        } else {
          const hw = (p.w || 0.3) / 2;
          const hh = (p.h || 0.4) / 2;
          return worldX >= p.x - hw && worldX <= p.x + hw && worldY >= p.y - hh && worldY <= p.y + hh;
        }
      });
      setHoveredPin(hit || null);
    }
  };

  const handleMouseUp = () => setIsDragging(false);

  const handleCanvasClick = () => {
    if (hoveredPin) {
      setSelectedPin(hoveredPin);
      if (hoveredPin.net && hoveredPin.net !== "GND") {
        setActiveNet(hoveredPin.net);
      }
    }
  };

  // =========================================================================
  // 100% PURE VECTOR CAD RENDER ENGINE (4 BOARDS IPHONE 11 PRO)
  // =========================================================================
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const displayWidth = canvas.clientWidth || 950;
    const displayHeight = canvas.clientHeight || 700;

    if (canvas.width !== displayWidth * dpr || canvas.height !== displayHeight * dpr) {
      canvas.width = displayWidth * dpr;
      canvas.height = displayHeight * dpr;
    }

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, displayWidth, displayHeight);

    // Apply Camera Transform
    ctx.translate(pan.x, pan.y);
    ctx.scale(scale, scale);

    // 1. Draw 4 Exact iPhone 11 Pro Physical Board Substrates
    boardData.contours.forEach(c => {
      ctx.beginPath();
      ctx.moveTo(c.points[0][0], c.points[0][1]);
      for (let i = 1; i < c.points.length; i++) {
        ctx.lineTo(c.points[i][0], c.points[i][1]);
      }
      ctx.closePath();

      // Deep Black Solder Mask Substrate
      ctx.fillStyle = "#07090e";
      ctx.fill();

      // Golden Ground Copper Border
      ctx.strokeStyle = "#c59b27";
      ctx.lineWidth = 0.45;
      ctx.stroke();

      // Board Header Title
      const minX = Math.min(...c.points.map(p => p[0]));
      const maxX = Math.max(...c.points.map(p => p[0]));
      const cx = (minX + maxX) / 2;

      ctx.fillStyle = "#94a3b8";
      ctx.font = `bold 1.3px sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText(c.title, cx, 11.0);
    });

    // 2. Render Components (Exact Body Outlines, Silkscreen & Ferrite Coils)
    boardData.components.forEach(comp => {
      const isCompSelected = selectedPin?.comp === comp.designator;

      if (comp.type === "FPC") {
        ctx.fillStyle = "#0284c7";
        ctx.strokeStyle = isCompSelected ? "#facc15" : "#38bdf8";
        ctx.lineWidth = 0.12;
      } else if (comp.type === "IC") {
        ctx.fillStyle = "#0f172a";
        ctx.strokeStyle = isCompSelected ? "#facc15" : "#ef4444";
        ctx.lineWidth = 0.14;
      } else if (comp.type === "CAP") {
        ctx.fillStyle = "#78350f"; // Brown Ceramic Capacitor body
        ctx.strokeStyle = isCompSelected ? "#facc15" : "#92400e";
        ctx.lineWidth = 0.04;
      } else {
        ctx.fillStyle = "#09090b";
        ctx.strokeStyle = isCompSelected ? "#facc15" : "#52525b";
        ctx.lineWidth = 0.04;
      }

      ctx.beginPath();
      ctx.roundRect(comp.x, comp.y, comp.w, comp.h, 0.15);
      ctx.fill();
      ctx.stroke();

      // Silkscreen RefDes
      if (comp.type === "IC" || comp.type === "FPC" || scale >= 25.0) {
        ctx.fillStyle = "#ffffff";
        ctx.font = `bold ${Math.min(comp.w * 0.22, 1.2)}px monospace`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(comp.designator, comp.x + comp.w / 2, comp.y + comp.h / 2);
      }
    });

    // 3. Render All High-Density Solder Pads & BGA Balls (Exact Colors)
    boardData.pins.forEach(pin => {
      const isNetActive = pin.net === activeNet && pin.net !== "GND";
      const isPinSelected = selectedPin?.id === pin.id;
      const isGnd = pin.net === "GND";

      if (isPinSelected) {
        ctx.fillStyle = "#ffffff";
        ctx.strokeStyle = "#eab308";
      } else if (isNetActive) {
        ctx.fillStyle = "#00f0ff"; // Electric Cyan Blue for connected net
        ctx.strokeStyle = "#ffffff";
      } else if (isGnd) {
        ctx.fillStyle = "#1e293b"; // Dark Slate for GND
        ctx.strokeStyle = "#0f172a";
      } else if (pin.diodeMv === 92) {
        ctx.fillStyle = "#ef4444"; // Red for Low-Ohm CPU rail
        ctx.strokeStyle = "#991b1b";
      } else {
        ctx.fillStyle = "#fef08a"; // High-gloss Gold for standard pads
        ctx.strokeStyle = "#ca8a04";
      }

      ctx.lineWidth = 0.025;

      if (pin.shape === "CIRCLE") {
        ctx.beginPath();
        ctx.arc(pin.x, pin.y, pin.r || 0.22, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Diode Drop Value inside pad when zoomed in
        if (showDiodeValues && scale >= 20.0 && pin.diodeMv !== undefined) {
          ctx.fillStyle = (pin.diodeMv === 92 || isNetActive || isPinSelected) ? "#ffffff" : "#0f172a";
          ctx.font = `bold ${(pin.r || 0.22) * 0.85}px monospace`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(String(pin.diodeMv), pin.x, pin.y);
        }
      } else {
        // Rectangular SMT / FPC Pad
        const hw = (pin.w || 0.28) / 2;
        const hh = (pin.h || 0.42) / 2;
        ctx.beginPath();
        ctx.rect(pin.x - hw, pin.y - hh, pin.w || 0.28, pin.h || 0.42);
        ctx.fill();
        ctx.stroke();
      }

      if (isPinSelected) {
        ctx.strokeStyle = "#facc15";
        ctx.lineWidth = 0.08;
        ctx.stroke();
      }
    });

    // 4. Tooltip (Exact Phoneboard / JCID Style)
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
      ctx.font = `bold 0.28px monospace`;
      ctx.textAlign = "left";
      ctx.fillText(`pin no : ${hoveredPin.id}`, tx + 0.25, ty + 0.55);

      ctx.fillStyle = hoveredPin.net === "GND" ? "#94a3b8" : "#facc15";
      ctx.fillText(`net name : ${hoveredPin.net || "N/C"}`, tx + 0.25, ty + 1.15);

      ctx.fillStyle = "#38bdf8";
      ctx.font = `0.24px sans-serif`;
      ctx.fillText(`part name : ${hoveredPin.comp} • Placa ${hoveredPin.boardIndex}`, tx + 0.25, ty + 1.7);
      ctx.fillText(`Vf: ${hoveredPin.diodeMv !== undefined ? hoveredPin.diodeMv + 'mV' : 'N/A'} • Click para trazar`, tx + 0.25, ty + 2.25);
    }

    ctx.restore();
  }, [boardData, selectedPin, hoveredPin, activeNet, scale, pan, showDiodeValues]);

  // Extract unique active nets from board data
  const availableNets = useMemo(() => {
    const set = new Set<string>();
    boardData.pins.forEach(p => {
      if (p.net && p.net !== "GND" && p.net !== "N/C") set.add(p.net);
    });
    return Array.from(set);
  }, [boardData]);

  // Search logic
  const handleSearch = (q: string) => {
    setSearchQuery(q);
    const upper = q.toUpperCase().trim();
    if (!upper) return;

    const matched = boardData.pins.find(p => p.id.toUpperCase().includes(upper) || (p.net && p.net.toUpperCase() === upper) || p.comp.toUpperCase() === upper);
    if (matched) {
      setSelectedPin(matched);
      if (matched.net && matched.net !== "GND") setActiveNet(matched.net);
      setPan({
        x: (canvasRef.current?.clientWidth || 900) / 2 - matched.x * scale,
        y: (canvasRef.current?.clientHeight || 650) / 2 - matched.y * scale
      });
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-slate-950 text-slate-100 overflow-hidden font-sans select-none">
      
      {/* HEADER */}
      <header className="h-14 bg-slate-900 border-b border-slate-800 px-4 flex items-center justify-between shrink-0 z-30">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center font-black text-slate-950 text-base shadow-lg shadow-amber-500/20">
            BF
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-bold text-slate-100 tracking-tight text-sm">BoardForge &bull; Apple iPhone 11 Pro 4-Board Master CAD</span>
              <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded flex items-center space-x-1">
                <CheckCircle2 className="w-2.5 h-2.5" />
                <span>IPHONE 11 PRO NATIVE</span>
              </span>
              <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30 rounded">{boardData.pins.length} PADS</span>
            </div>
            <div className="text-[11px] text-slate-400">Apple iPhone 11 Pro (820-01600 / D42) &bull; <span className="text-amber-400 font-mono font-bold">A13 Bionic + Tigris + 280 Interposer</span></div>
          </div>
        </div>

        {/* CONTROLS */}
        <div className="flex items-center space-x-3 text-xs">
          <button 
            onClick={() => { setScale(14.0); setPan({ x: -500, y: -650 }); }}
            className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-bold flex items-center space-x-1.5 shadow-md transition"
          >
            <Cpu className="w-3.5 h-3.5" />
            <span>Enfocar A13 Bionic (U0100)</span>
          </button>

          <button 
            onClick={() => { setScale(14.0); setPan({ x: -1400, y: -450 }); }}
            className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-bold flex items-center space-x-1.5 shadow-md transition"
          >
            <Cpu className="w-3.5 h-3.5" />
            <span>Enfocar Módem LTE (U_BB)</span>
          </button>

          <button 
            onClick={() => { setScale(4.4); setPan({ x: 30, y: -40 }); }}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-medium flex items-center space-x-1.5 transition"
          >
            <Maximize2 className="w-3.5 h-3.5" />
            <span>Vista 4 Placas (100%)</span>
          </button>
        </div>
      </header>

      {/* MAIN VIEWPORT */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* LEFT COMPONENT & NET TREE */}
        <aside className="w-72 bg-slate-900/70 border-r border-slate-800 flex flex-col shrink-0">
          <div className="p-3 border-b border-slate-800">
            <div className="relative">
              <input 
                type="text" 
                placeholder="Buscar (ej. U0100, J5700, VDD_MAIN)..." 
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-400 font-mono"
              />
              <Search className="w-3.5 h-3.5 absolute right-2.5 top-2 text-slate-500" />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-4">
            {/* Rieles y Buses de Potencia */}
            <div>
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-2 mb-1.5 flex justify-between">
                <span>Líneas y Buses ({availableNets.length})</span>
                <span className="text-emerald-400 text-[10px]">Netlist</span>
              </div>
              <div className="space-y-1">
                {availableNets.map(netName => (
                  <button 
                    key={netName}
                    onClick={() => { setActiveNet(netName); }}
                    className={`w-full text-left px-2.5 py-1.5 rounded-md text-xs font-mono flex items-center justify-between transition border ${activeNet === netName ? 'bg-cyan-500/15 border-cyan-500/50 shadow-sm text-cyan-300 font-bold' : 'bg-slate-800/30 border-transparent hover:bg-slate-800/80 text-slate-300'}`}
                  >
                    <span className="font-semibold truncate max-w-[170px] flex items-center space-x-1.5">
                      <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
                      <span>{netName}</span>
                    </span>
                    <span className="text-[10px] text-slate-400 bg-slate-900 px-1.5 py-0.5 rounded">NET</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Componentes Principales */}
            <div>
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-2 mb-1.5">ICs y Conectores FPC</div>
              <div className="space-y-1.5 text-xs">
                {boardData.components.filter(c => c.type === 'IC' || c.type === 'FPC').map(comp => (
                  <div 
                    key={comp.designator}
                    onClick={() => handleSearch(comp.designator)} 
                    className="p-2 rounded border border-slate-800/60 bg-slate-800/30 hover:bg-slate-800/60 cursor-pointer"
                  >
                    <div className="font-bold text-amber-400 flex justify-between">
                      <span>{comp.designator}</span>
                      <span className="text-[10px] text-slate-500 font-normal">Placa {comp.boardIndex}</span>
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5 truncate">{comp.name}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </aside>

        {/* CENTER: VECTOR CAD CANVAS WORKSPACE */}
        <main className="flex-1 flex flex-col bg-slate-950 overflow-hidden">
          
          {/* TOP STATUS BAR */}
          <div className="h-9 bg-slate-900 border-b border-slate-800 px-4 flex items-center justify-between text-xs shrink-0">
            <div className="flex items-center space-x-2 font-mono">
              <span className="text-slate-400">Línea Activa:</span>
              <span className="px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 font-bold">
                {activeNet}
              </span>
              <span className="text-slate-500">|</span>
              <span className="text-slate-400">Pines Conectados:</span>
              <span className="text-emerald-400 font-bold">
                {boardData.pins.filter(p => p.net === activeNet && p.net !== "GND").length} Pads Iluminados en iPhone 11 Pro
              </span>
              <span className="text-slate-500">|</span>
              <span className="text-slate-400">Zoom: <strong className="text-amber-400">{(scale * 20).toFixed(0)}%</strong></span>
            </div>

            <div className="flex items-center space-x-2">
              <button onClick={() => setScale(s => Math.min(s * 1.3, 180.0))} className="p-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700" title="Zoom In">
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => setScale(s => Math.max(s * 0.77, 1.2))} className="p-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700" title="Zoom Out">
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* CANVAS WORKSPACE */}
          <div className="flex-1 bg-slate-950 flex flex-col relative overflow-hidden">
            <div className="flex-1 flex items-center justify-center overflow-hidden w-full h-full">
              <canvas 
                ref={canvasRef} 
                onWheel={handleWheel}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onClick={handleCanvasClick}
                className="w-full h-full bg-[#040508] cursor-crosshair"
              />
            </div>

            {/* BOTTOM LAYER BAR */}
            <div className="h-8 bg-slate-900 border-t border-slate-800 px-3 flex items-center justify-between text-[11px] shrink-0">
              <div className="flex items-center space-x-1">
                <span className="px-2 py-0.5 bg-slate-950 text-slate-400 border border-slate-800 rounded font-semibold text-[10px] mr-1">Capas:</span>
                {["copper", "A", "Top", "Mid-1", "Mid-2", "Mid-3", "Mid-4", "Mid-5", "Mid-6", "Mid-7", "Mid-8", "Bottom"].map((tab) => (
                  <button 
                    key={tab}
                    onClick={() => setActiveLayerTab(tab)}
                    className={`px-2 py-0.5 rounded text-[10px] font-medium transition ${activeLayerTab === tab ? 'bg-amber-400 text-slate-950 font-bold shadow' : 'bg-slate-800 text-slate-400 hover:text-slate-200'}`}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              <div className="text-[10px] font-mono text-slate-400">
                [Modelo: <strong className="text-amber-400">Apple iPhone 11 Pro 820-01600</strong>] &bull; [Interposer: 280 Pads]
              </div>
            </div>
          </div>
        </main>

        {/* RIGHT PANEL */}
        <aside className="w-80 bg-slate-900/90 border-l border-slate-800 flex flex-col shrink-0 overflow-y-auto custom-scrollbar p-3 space-y-4">
          
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 shadow-lg">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-2.5">
              <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">Detalles iPhone 11 Pro</span>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">ACTIVO</span>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Componente:</span>
                <strong className="text-amber-400 font-mono text-sm">{selectedPin?.comp || 'U0100'}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Placa Física:</span>
                <span className="text-slate-200 font-mono font-semibold">Placa {selectedPin?.boardIndex || 2}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Línea (NET):</span>
                <strong className="text-cyan-400 font-mono">{selectedPin?.net || activeNet}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Caída Modo Diodo:</span>
                <span className="text-emerald-400 font-mono font-bold">{selectedPin?.diodeMv !== undefined ? `${selectedPin.diodeMv} mV` : '430 mV'}</span>
              </div>
            </div>

            <div className="mt-3.5 pt-3 border-t border-slate-800/80">
              <button 
                onClick={() => { setScale(14.0); setPan({ x: -500, y: -650 }); }}
                className="w-full bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs py-1.5 px-3 rounded shadow transition flex items-center justify-center space-x-1.5"
              >
                <Cpu className="w-3.5 h-3.5" />
                <span>Centrar Zoom en A13 Bionic (U0100)</span>
              </button>
            </div>
          </div>

        </aside>
      </div>

    </div>
  );
}
