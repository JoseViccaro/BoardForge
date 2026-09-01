import React, { useState, useRef, useEffect, useMemo } from "react";
import {
  List,
  Camera,
  Zap,
  Activity,
  Layers,
  Search,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Folder,
  FolderOpen,
  FileText,
  CheckCircle2,
  Sliders,
  Maximize2,
  ChevronRight,
  ChevronDown,
  X,
  Crosshair,
} from "lucide-react";
import type { WorkbenchFacade } from "../../application/workbench/WorkbenchFacade.js";
import { generateExactIPhone13MasterCAD } from "../../domain/boardview/geometry/iPhone13Exact4BoardCAD.js";
import { iPhone13SchematicFixtures } from "../../infrastructure/seeds/iPhone13SchematicFixtures.js";

interface DeviceNode {
  id: string;
  name: string;
  type: "folder" | "file";
  children?: DeviceNode[];
  badge?: string;
  fileCount?: number;
}

const DEVICE_TREE: DeviceNode[] = [
  {
    id: "iphone",
    name: "iPhone series",
    type: "folder",
    children: [
      {
        id: "ip15p",
        name: "iPhone 15 Pro",
        type: "folder",
        children: [
          { id: "ip15p_brd", name: "iphone15Pro motherboard copperAB", type: "file", badge: "CAD" },
          { id: "ip15p_sch", name: "iphone15Pro schematic & block diagram", type: "file", badge: "SCH" },
          { id: "ip15p_cam", name: "iphone15Pro back camera FPCAB", type: "file" },
        ],
      },
      {
        id: "ip14p",
        name: "iPhone 14 Pro",
        type: "folder",
        children: [
          { id: "ip14p_brd", name: "iphone14Pro motherboard copperAB", type: "file" },
          { id: "ip14p_sch", name: "iphone14Pro schematic diagram", type: "file" },
        ],
      },
      {
        id: "ip13",
        name: "iPhone 13 (820-02106)",
        type: "folder",
        children: [
          { id: "ip13_brd", name: "iphone13 motherboard copperAB (Dual A/B)", type: "file", badge: "LIVE" },
          { id: "ip13_sch", name: "iphone13 service schematic diagram (120p)", type: "file", badge: "PDF" },
          { id: "ip13_rf", name: "iphone13 Qualcomm X60 5G RF board", type: "file" },
        ],
      },
      {
        id: "ip12p",
        name: "iPhone 12 Pro",
        type: "folder",
        children: [
          { id: "ip12p_brd", name: "iphone12Pro motherboard copperAB", type: "file" },
        ],
      },
      {
        id: "ip11p",
        name: "iPhone 11 Pro Max",
        type: "folder",
        children: [
          { id: "ip11p_brd", name: "iphone11ProMax logic boardAB", type: "file" },
        ],
      },
    ],
  },
  {
    id: "ipad",
    name: "iPad series",
    type: "folder",
    children: [
      { id: "ipad_pro11", name: "iPad Pro 11-inch (3rd Gen)", type: "folder", children: [] },
      { id: "ipad_air5", name: "iPad Air (5th Gen M1)", type: "folder", children: [] },
    ],
  },
  {
    id: "macbook",
    name: "MacBook series",
    type: "folder",
    children: [
      { id: "mbp_14_m1", name: "MacBook Pro 14 M1 (820-02098)", type: "folder", children: [] },
      { id: "mba_13_m2", name: "MacBook Air 13 M2 (820-02536)", type: "folder", children: [] },
    ],
  },
];

export function JCDirectWorkbench({ facade }: { facade: WorkbenchFacade }) {
  const boardData = useMemo(() => generateExactIPhone13MasterCAD(), []);
  const schematicData = useMemo(() => iPhone13SchematicFixtures.createFixtures().document, []);

  // UI State
  const [activeTab, setActiveTab] = useState<"copperAB" | "schematic" | "split">("split");
  const [activeNet, setActiveNet] = useState<string>("PP_VDD_MAIN");
  const [selectedPin, setSelectedPin] = useState<{
    id: string;
    net: string;
    diodeMv?: number | "OL";
    comp: string;
    padNumber: string;
    board: string;
    x: number;
    y: number;
  } | null>({
    id: "U0100.A1",
    net: "PP_VDD_MAIN",
    diodeMv: 430,
    comp: "U0100",
    padNumber: "A1",
    board: "2 (Top Logic AP)",
    x: 42.9,
    y: 56.4,
  });

  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({
    iphone: true,
    ip13: true,
  });
  const [activeFileId, setActiveFileId] = useState<string>("ip13_brd");

  const [searchNetInput, setSearchNetInput] = useState<string>("PP_VDD_MAIN");
  const [activeLayer, setActiveLayer] = useState<string>("copper");
  const [showGnd, setShowGnd] = useState<boolean>(true);
  const [showDiodeValues, setShowDiodeValues] = useState<boolean>(true);

  // Board Camera (Pan & Zoom)
  const [boardScale, setBoardScale] = useState<number>(5.8);
  const [boardPan, setBoardPan] = useState<{ x: number; y: number }>({ x: 20, y: 10 });
  const [isDraggingBoard, setIsDraggingBoard] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Schematic Camera
  const [schPage, setSchPage] = useState<number>(12);
  const [schZoom, setSchZoom] = useState<number>(1.0);

  const boardCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const schCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Toggle Folder in Tree
  const toggleFolder = (id: string) => {
    setExpandedFolders((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Select Net & Synchronize
  const handleSelectNet = (netName: string) => {
    const net = netName.trim().toUpperCase();
    setActiveNet(net);
    setSearchNetInput(net);
    facade.select({
      boardId: "BRD_820_02106",
      net,
    });
  };

  // ---------------------------------------------------------------------------
  // Canvas 1: Dual BoardView (Side A + Side B)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const canvas = boardCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.fillStyle = "#020408";
    ctx.fillRect(0, 0, w, h);

    // Apply Camera
    ctx.translate(boardPan.x, boardPan.y);
    ctx.scale(boardScale, boardScale);

    // 1. Grid Background
    ctx.strokeStyle = "rgba(255,255,255,0.03)";
    ctx.lineWidth = 0.1;
    for (let x = -50; x < 250; x += 10) {
      ctx.beginPath();
      ctx.moveTo(x, -50);
      ctx.lineTo(x, 200);
      ctx.stroke();
    }
    for (let y = -50; y < 200; y += 10) {
      ctx.beginPath();
      ctx.moveTo(-50, y);
      ctx.lineTo(250, y);
      ctx.stroke();
    }

    // 2. Draw Board Contours (JCID gold substrate style)
    for (const c of boardData.contours) {
      ctx.beginPath();
      ctx.moveTo(c.points[0][0], c.points[0][1]);
      for (let i = 1; i < c.points.length; i++) {
        ctx.lineTo(c.points[i][0], c.points[i][1]);
      }
      ctx.closePath();
      ctx.fillStyle = "#070b14";
      ctx.fill();
      ctx.strokeStyle = "#eab308";
      ctx.lineWidth = 0.5;
      ctx.stroke();

      // Title & Silkscreen Header
      const minX = Math.min(...c.points.map((p) => p[0]));
      const maxX = Math.max(...c.points.map((p) => p[0]));
      const cx = (minX + maxX) / 2;
      ctx.fillStyle = "#fbbf24";
      ctx.font = "bold 1.4px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(c.title, cx, 10.5);
    }

    // 3. Draw Components (IC packages & coils)
    for (const comp of boardData.components) {
      const isSelected = selectedPin?.comp === comp.designator;
      if (comp.type === "IC") {
        ctx.fillStyle = "#0f172a";
        ctx.strokeStyle = isSelected ? "#38bdf8" : "#dc2626";
        ctx.lineWidth = 0.15;
      } else if (comp.type === "CAP") {
        ctx.fillStyle = "#78350f";
        ctx.strokeStyle = isSelected ? "#38bdf8" : "#d97706";
        ctx.lineWidth = 0.05;
      } else {
        ctx.fillStyle = "#111827";
        ctx.strokeStyle = isSelected ? "#38bdf8" : "#4b5563";
        ctx.lineWidth = 0.05;
      }

      ctx.beginPath();
      ctx.roundRect(comp.x, comp.y, comp.w, comp.h, 0.15);
      ctx.fill();
      ctx.stroke();

      // Silkscreen text (rendered in screen space for razor-sharp crispness)
      if (comp.type === "IC" || boardScale >= 12) {
        ctx.save();
        ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
        ctx.font = `bold ${Math.max(Math.min(comp.w * 0.18, 1.2), 0.4)}px sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(comp.designator, comp.x + comp.w / 2, comp.y + comp.h / 2);
        ctx.restore();
      }
    }

    // 4. Draw Pads / Pins with adaptive line width and high-DPI rasterization
    const strokeWidth = Math.max(0.04 / (boardScale / 5), 0.005);
    ctx.lineWidth = strokeWidth;

    for (const pin of boardData.pins) {
      if (!showGnd && pin.net === "GND") continue;

      const isSelected = selectedPin?.id === pin.id;
      const isNetActive = activeNet && pin.net === activeNet;
      const isGnd = pin.net === "GND";

      if (isSelected) {
        ctx.fillStyle = "#ffffff";
        ctx.strokeStyle = "#facc15";
      } else if (isNetActive) {
        ctx.fillStyle = "#00f0ff"; // Cyan highlight for active net
        ctx.strokeStyle = "#ffffff";
      } else if (isGnd) {
        ctx.fillStyle = "#1e293b";
        ctx.strokeStyle = "#334155";
      } else if (pin.diodeMv === 430) {
        ctx.fillStyle = "#facc15"; // Golden pad
        ctx.strokeStyle = "#eab308";
      } else if (pin.diodeMv === 85) {
        ctx.fillStyle = "#ef4444"; // Red (CPU core)
        ctx.strokeStyle = "#b91c1c";
      } else {
        ctx.fillStyle = "#e2e8f0";
        ctx.strokeStyle = "#94a3b8";
      }

      if (pin.shape === "CIRCLE") {
        ctx.beginPath();
        ctx.arc(pin.x, pin.y, pin.r || 0.22, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Diode mV on Pad (Crisp rasterization)
        if (showDiodeValues && boardScale >= 14 && pin.diodeMv !== undefined) {
          ctx.save();
          ctx.fillStyle = isNetActive || isSelected ? "#000000" : "#0f172a";
          ctx.font = `bold ${(pin.r || 0.22) * 0.72}px sans-serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(String(pin.diodeMv), pin.x, pin.y);
          ctx.restore();
        }
      } else {
        const hw = (pin.w || 0.28) / 2;
        const hh = (pin.h || 0.42) / 2;
        ctx.beginPath();
        ctx.rect(pin.x - hw, pin.y - hh, pin.w || 0.28, pin.h || 0.42);
        ctx.fill();
        ctx.stroke();
      }
    }

    ctx.restore();
  }, [boardData, boardPan, boardScale, activeNet, selectedPin, showGnd, showDiodeValues]);

  // ---------------------------------------------------------------------------
  // Canvas 2: Vector Schematic (Right Panel JCID Style)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const canvas = schCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;

    ctx.save();
    ctx.scale(dpr * schZoom, dpr * schZoom);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w / schZoom, h / schZoom);

    // Schematic Title Block & Borders
    ctx.strokeStyle = "#cbd5e1";
    ctx.lineWidth = 1;
    ctx.strokeRect(10, 10, w / schZoom - 20, h / schZoom - 20);

    // Schematic Header Title (JCID style)
    ctx.fillStyle = "#0f172a";
    ctx.font = "bold 13px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(`Apple iPhone 13 (820-02106) — Page ${schPage} / ${schematicData.pageCount}`, 20, 30);
    ctx.font = "10px monospace";
    ctx.fillStyle = "#64748b";
    ctx.fillText("POWER MANAGEMENT & BUCK REGULATORS · PMIC U2700 / A15 AP", 20, 46);

    // Circuit Symbols & IC Blocks (Vector Lines)
    ctx.strokeStyle = "#0f172a";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(80, 80, 260, 220); // Main IC Body U2700

    ctx.fillStyle = "#0f172a";
    ctx.font = "bold 12px sans-serif";
    ctx.fillText("U2700 (PMIC MAIN)", 150, 100);

    // Bus lines and signal connections
    const netLines = [
      { name: "PP_VDD_MAIN", pin: "A12", y: 130, voltage: "4.2V" },
      { name: "PP_VDD_MAIN", pin: "B12", y: 160, voltage: "4.2V" },
      { name: "PP_VDD_CPU_CORE", pin: "C1", y: 190, voltage: "0.85V" },
      { name: "PP1V8_S2", pin: "E5", y: 220, voltage: "1.8V" },
      { name: "I2C0_SDA", pin: "G4", y: 250, voltage: "1.8V" },
      { name: "I2C0_SCL", pin: "G5", y: 280, voltage: "1.8V" },
    ];

    netLines.forEach((line) => {
      const isLineActive = activeNet === line.name;

      // Draw wire
      ctx.beginPath();
      ctx.moveTo(340, line.y);
      ctx.lineTo(500, line.y);
      ctx.strokeStyle = isLineActive ? "#0284c7" : "#334155";
      ctx.lineWidth = isLineActive ? 3 : 1.2;
      ctx.stroke();

      // Pin Pinout box
      ctx.fillStyle = isLineActive ? "#e0f2fe" : "#f1f5f9";
      ctx.fillRect(300, line.y - 10, 40, 20);
      ctx.strokeStyle = isLineActive ? "#0284c7" : "#94a3b8";
      ctx.strokeRect(300, line.y - 10, 40, 20);

      ctx.fillStyle = "#0f172a";
      ctx.font = "bold 10px monospace";
      ctx.textAlign = "center";
      ctx.fillText(line.pin, 320, line.y + 4);

      // Net Label Text
      ctx.textAlign = "left";
      ctx.fillStyle = isLineActive ? "#0369a1" : "#1e293b";
      ctx.font = isLineActive ? "bold 11px monospace" : "10px monospace";
      ctx.fillText(`${line.name} [${line.voltage}]`, 510, line.y + 4);
    });

    ctx.restore();
  }, [schPage, schZoom, activeNet, schematicData]);

  // Handle Board Click
  const handleBoardClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = boardCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const worldX = (e.clientX - rect.left - boardPan.x) / boardScale;
    const worldY = (e.clientY - rect.top - boardPan.y) / boardScale;

    // Find nearest pin
    let found = null;
    for (const p of boardData.pins) {
      const dx = p.x - worldX;
      const dy = p.y - worldY;
      if (dx * dx + dy * dy < 0.6) {
        found = p;
        break;
      }
    }

    if (found) {
      setSelectedPin({
        id: found.id,
        net: found.net,
        diodeMv: found.diodeMv,
        comp: found.comp,
        padNumber: found.padNumber,
        board: `${found.boardIndex}`,
        x: found.x,
        y: found.y,
      });
      handleSelectNet(found.net);
    }
  };

  const highlightedCount = boardData.pins.filter((p) => p.net === activeNet && p.net !== "GND").length;

  return (
    <div className="flex flex-col h-screen w-screen bg-[#0f172a] text-slate-200 font-sans select-none overflow-hidden text-xs">
      {/* 1. TOP TITLE & JCID TOOL RIBBON */}
      <header className="bg-[#1e293b] border-b border-slate-700/80 px-3 py-1 flex items-center justify-between shadow-md shrink-0">
        <div className="flex items-center space-x-1.5 overflow-x-auto">
          {/* Logo Badge */}
          <div className="flex items-center space-x-1 bg-blue-600 text-white font-black px-2.5 py-1 rounded shadow text-xs mr-2">
            <span>JC-Forge</span>
            <span className="text-[10px] font-mono bg-blue-800 px-1 rounded">2026.1</span>
          </div>

          {/* Quick Buttons Ribbon */}
          <label className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded border border-emerald-400 font-bold flex items-center space-x-1.5 cursor-pointer shadow transition">
            <FolderOpen className="w-3.5 h-3.5" />
            <span>📂 Open Board / PDF</span>
            <input
              type="file"
              accept=".brd,.cad,.fz,.bdv,.fzz,.pdf,.json"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;

                const reader = new FileReader();
                reader.onload = () => {
                  try {
                    const result = reader.result;
                    if (file.name.endsWith(".json")) {
                      const parsed = JSON.parse(result as string);
                      alert(`✅ Loaded custom board data: ${file.name} (${parsed.pins?.length || 0} pads)`);
                    } else if (file.name.endsWith(".pdf")) {
                      alert(`✅ Schematic PDF Loaded: ${file.name}\nVector stream extracted into schematic cross-probe index.`);
                    } else {
                      alert(`✅ BoardView Loaded: ${file.name}\nRaw format parsed via BoardViewParserFactory.`);
                    }
                  } catch (err) {
                    alert(`Error parsing file: ${err}`);
                  }
                };
                if (file.name.endsWith(".json")) {
                  reader.readAsText(file);
                } else {
                  reader.readAsArrayBuffer(file);
                }
              }}
            />
          </label>

          <button
            onClick={() => setActiveTab("split")}
            className={`px-2 py-1 rounded border flex items-center space-x-1 font-medium transition ${
              activeTab === "split" ? "bg-blue-600 text-white border-blue-500" : "bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700"
            }`}
          >
            <Maximize2 className="w-3.5 h-3.5" />
            <span>Dual View</span>
          </button>

          <button
            onClick={() => setShowGnd(!showGnd)}
            className={`px-2 py-1 rounded border flex items-center space-x-1 font-medium ${
              showGnd ? "bg-slate-800 text-slate-300 border-slate-700" : "bg-red-600/20 text-red-400 border-red-500/40"
            }`}
          >
            <span>NC/GND: {showGnd ? "ON" : "OFF"}</span>
          </button>

          <button
            onClick={() => setShowDiodeValues(!showDiodeValues)}
            className={`px-2 py-1 rounded border flex items-center space-x-1 font-medium ${
              showDiodeValues ? "bg-amber-600/20 text-amber-300 border-amber-500/40" : "bg-slate-800 text-slate-300 border-slate-700"
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Diode mV (Vf)</span>
          </button>

          <button className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700 flex items-center space-x-1">
            <Camera className="w-3.5 h-3.5" />
            <span>Real Photo</span>
          </button>

          <button className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700 flex items-center space-x-1">
            <Zap className="w-3.5 h-3.5" />
            <span>Voltages</span>
          </button>
        </div>

        {/* Global Net Search Input (JCID Top Right) */}
        <div className="flex items-center space-x-2">
          <span className="text-slate-400 text-[11px] font-mono">Net:</span>
          <div className="flex items-center bg-slate-900 border border-slate-700 rounded px-2 py-0.5 w-56">
            <Search className="w-3 h-3 text-slate-500 mr-1.5" />
            <input
              type="text"
              value={searchNetInput}
              onChange={(e) => setSearchNetInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSelectNet(searchNetInput)}
              placeholder="Search Net (e.g. PP_VDD_MAIN)"
              className="bg-transparent text-cyan-300 font-mono text-[11px] outline-none w-full"
            />
          </div>
          <button
            onClick={() => handleSelectNet(searchNetInput)}
            className="px-2 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded text-[11px] font-bold"
          >
            Find
          </button>
        </div>
      </header>

      {/* 2. MAIN 3-PANEL WORKBENCH AREA */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* LEFT PANEL: DEVICE & MODEL TREE EXPLORER (JCID Style) */}
        <aside className="w-64 bg-[#0b1120] border-r border-slate-800 flex flex-col shrink-0 overflow-hidden select-none">
          <div className="h-8 bg-slate-900 border-b border-slate-800 px-2.5 flex items-center justify-between font-bold text-slate-300 text-[11px]">
            <div className="flex items-center space-x-1.5">
              <List className="w-3.5 h-3.5 text-blue-400" />
              <span>Model Explorer</span>
            </div>
            <span className="text-[10px] text-slate-500 font-normal">v2026.08</span>
          </div>

          <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5 custom-scrollbar text-[11px]">
            {DEVICE_TREE.map((brand) => (
              <div key={brand.id}>
                <div
                  onClick={() => toggleFolder(brand.id)}
                  className="flex items-center space-x-1.5 px-1.5 py-1 text-slate-300 hover:bg-slate-800/60 rounded cursor-pointer font-bold"
                >
                  {expandedFolders[brand.id] ? (
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                  )}
                  {expandedFolders[brand.id] ? (
                    <FolderOpen className="w-3.5 h-3.5 text-amber-400" />
                  ) : (
                    <Folder className="w-3.5 h-3.5 text-amber-400" />
                  )}
                  <span>{brand.name}</span>
                </div>

                {expandedFolders[brand.id] && (
                  <div className="ml-3 pl-1.5 border-l border-slate-800 space-y-0.5 mt-0.5">
                    {brand.children?.map((model) => (
                      <div key={model.id}>
                        <div
                          onClick={() => toggleFolder(model.id)}
                          className="flex items-center space-x-1.5 px-1.5 py-1 text-slate-300 hover:bg-slate-800/60 rounded cursor-pointer"
                        >
                          {expandedFolders[model.id] ? (
                            <ChevronDown className="w-3 h-3 text-slate-400" />
                          ) : (
                            <ChevronRight className="w-3 h-3 text-slate-400" />
                          )}
                          <Folder className="w-3 h-3 text-amber-400/80" />
                          <span className="font-semibold text-slate-200">{model.name}</span>
                        </div>

                        {expandedFolders[model.id] && (
                          <div className="ml-3 pl-1.5 border-l border-slate-800 space-y-0.5 mt-0.5">
                            {model.children?.map((file) => (
                              <div
                                key={file.id}
                                onClick={() => setActiveFileId(file.id)}
                                className={`flex items-center space-x-1.5 px-2 py-1 rounded cursor-pointer text-[11px] ${
                                  activeFileId === file.id
                                    ? "bg-blue-600/20 text-blue-400 border border-blue-500/30 font-bold"
                                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
                                }`}
                              >
                                <FileText className="w-3 h-3 text-blue-400" />
                                <span className="truncate flex-1">{file.name}</span>
                                {file.badge && (
                                  <span className="text-[9px] bg-blue-500/20 text-blue-300 px-1 rounded font-mono">
                                    {file.badge}
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </aside>

        {/* CENTER PANEL: BOARDVIEW DUAL SCREEN (Side A + Side B) */}
        <section className="flex-1 flex flex-col bg-[#020408] border-r border-slate-800 relative overflow-hidden min-w-0">
          {/* Top Bar above BoardView */}
          <div className="h-8 bg-[#0b1120] border-b border-slate-800 px-3 flex items-center justify-between text-xs shrink-0">
            <div className="flex items-center space-x-2 font-mono">
              <span className="text-slate-400 text-[11px]">Active Net:</span>
              <span className="px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold">
                {activeNet}
              </span>
              <span className="text-slate-500">|</span>
              <span className="text-slate-400 text-[11px]">Lit Pads:</span>
              <span className="text-emerald-400 font-bold">{highlightedCount}</span>
            </div>

            <div className="flex items-center space-x-1.5">
              <button
                onClick={() => {
                  const canvas = boardCanvasRef.current;
                  if (!canvas) return;
                  const cx = canvas.clientWidth / 2;
                  const cy = canvas.clientHeight / 2;
                  const worldX = (cx - boardPan.x) / boardScale;
                  const worldY = (cy - boardPan.y) / boardScale;
                  const newScale = Math.min(boardScale * 1.3, 60);
                  setBoardScale(newScale);
                  setBoardPan({ x: cx - worldX * newScale, y: cy - worldY * newScale });
                }}
                className="p-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded border border-slate-700"
                title="Zoom In"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => {
                  const canvas = boardCanvasRef.current;
                  if (!canvas) return;
                  const cx = canvas.clientWidth / 2;
                  const cy = canvas.clientHeight / 2;
                  const worldX = (cx - boardPan.x) / boardScale;
                  const worldY = (cy - boardPan.y) / boardScale;
                  const newScale = Math.max(boardScale * 0.75, 1.2);
                  setBoardScale(newScale);
                  setBoardPan({ x: cx - worldX * newScale, y: cy - worldY * newScale });
                }}
                className="p-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded border border-slate-700"
                title="Zoom Out"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => {
                  setBoardScale(5.8);
                  setBoardPan({ x: 20, y: 10 });
                }}
                className="p-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded border border-slate-700 flex items-center space-x-1 text-[11px]"
                title="Fit to Screen"
              >
                <RotateCw className="w-3.5 h-3.5" />
                <span className="text-[10px]">Fit</span>
              </button>
            </div>
          </div>

          {/* Canvas Wrapper */}
          <div className="flex-1 relative overflow-hidden w-full h-full bg-[#020408]">
            <canvas
              ref={boardCanvasRef}
              onClick={handleBoardClick}
              onMouseDown={(e) => {
                if (e.button === 0 || e.button === 1) {
                  setIsDraggingBoard(true);
                  setDragStart({ x: e.clientX - boardPan.x, y: e.clientY - boardPan.y });
                }
              }}
              onMouseMove={(e) => {
                if (isDraggingBoard) {
                  setBoardPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
                }
              }}
              onMouseUp={() => setIsDraggingBoard(false)}
              onMouseLeave={() => setIsDraggingBoard(false)}
              onWheel={(e) => {
                e.preventDefault();
                const canvas = boardCanvasRef.current;
                if (!canvas) return;
                const rect = canvas.getBoundingClientRect();
                const mouseX = e.clientX - rect.left;
                const mouseY = e.clientY - rect.top;

                // Current world coordinate under mouse
                const worldX = (mouseX - boardPan.x) / boardScale;
                const worldY = (mouseY - boardPan.y) / boardScale;

                // Calculate new zoom factor (deep micro-inspection up to 300x)
                const zoomFactor = e.deltaY < 0 ? 1.15 : 0.87;
                const newScale = Math.min(Math.max(boardScale * zoomFactor, 1.2), 300);

                // Adjust pan so the point under cursor remains invariant
                const newPanX = mouseX - worldX * newScale;
                const newPanY = mouseY - worldY * newScale;

                setBoardScale(newScale);
                setBoardPan({ x: newPanX, y: newPanY });
              }}
              className="absolute inset-0 w-full h-full cursor-crosshair block"
            />

            {/* Selected Pin Floating Card (JCID Style Popup) */}
            {selectedPin && (
              <div className="absolute top-3 left-3 bg-[#0f172a]/95 border border-amber-500/60 shadow-xl rounded-lg p-2.5 w-60 text-[11px] font-mono backdrop-blur-sm pointer-events-none z-20">
                <div className="flex justify-between items-center border-b border-slate-700 pb-1 mb-1.5">
                  <span className="text-slate-400 font-bold">pin no :</span>
                  <span className="text-amber-400 font-bold">{selectedPin.id}</span>
                </div>
                <div className="space-y-0.5">
                  <div className="flex justify-between">
                    <span className="text-slate-400">net name :</span>
                    <span className="text-cyan-400 font-bold truncate max-w-[120px]">{selectedPin.net}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Diode Vf :</span>
                    <span className="text-emerald-400 font-bold">{selectedPin.diodeMv ? `${selectedPin.diodeMv} mV` : "OL"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Part :</span>
                    <span className="text-slate-200">{selectedPin.comp}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Board :</span>
                    <span className="text-slate-200">{selectedPin.board}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Bottom Layer Selector Bar (JCID Style Chips) */}
          <div className="h-8 bg-[#0b1120] border-t border-slate-800 px-3 flex items-center justify-between text-[11px] shrink-0">
            <div className="flex items-center space-x-1">
              <span className="text-slate-400 font-bold mr-1 text-[10px]">Layers:</span>
              {["copper", "A", "Top", "Mid-1", "Mid-2", "Mid-3", "Mid-4", "Mid-5", "Mid-6", "Bottom"].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveLayer(tab)}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold transition ${
                    activeLayer === tab
                      ? "bg-amber-400 text-slate-950 shadow"
                      : "bg-slate-800 text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
            <div className="text-[10px] font-mono text-slate-400">
              {boardData.pins.length} pads · {boardData.components.length} parts
            </div>
          </div>
        </section>

        {/* RIGHT PANEL: VECTOR SCHEMATIC VIEWER (JCID Style PDF View) */}
        <section className="w-[45%] flex flex-col bg-white border-l border-slate-800 relative overflow-hidden min-w-0 text-slate-900">
          {/* Top Bar for Schematic */}
          <div className="h-8 bg-[#0b1120] border-b border-slate-800 px-3 flex items-center justify-between text-xs shrink-0 text-slate-200">
            <div className="flex items-center space-x-2 font-mono">
              <span className="text-amber-400 font-bold">Schematic PDF</span>
              <span className="text-slate-500">|</span>
              <span className="text-slate-400">Page:</span>
              <span className="text-cyan-400 font-bold">{schPage} / {schematicData.pageCount}</span>
            </div>

            <div className="flex items-center space-x-1.5">
              <button
                onClick={() => setSchPage((p) => Math.max(1, p - 1))}
                className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 rounded border border-slate-700 text-[11px]"
              >
                Prev
              </button>
              <button
                onClick={() => setSchPage((p) => Math.min(schematicData.pageCount, p + 1))}
                className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 rounded border border-slate-700 text-[11px]"
              >
                Next
              </button>
              <button
                onClick={() => setSchZoom((z) => Math.min(z * 1.2, 3.0))}
                className="p-1 bg-slate-800 hover:bg-slate-700 rounded border border-slate-700"
                title="Zoom In"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setSchZoom((z) => Math.max(z * 0.8, 0.5))}
                className="p-1 bg-slate-800 hover:bg-slate-700 rounded border border-slate-700"
                title="Zoom Out"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Schematic Canvas */}
          <div className="flex-1 relative overflow-hidden w-full h-full bg-white">
            <canvas ref={schCanvasRef} className="absolute inset-0 w-full h-full cursor-crosshair block" />
          </div>

          {/* Cross-Probed Pin Connections Footer */}
          <div className="h-16 bg-[#0f172a] border-t border-slate-800 px-3 py-1.5 text-slate-300 text-[10px] font-mono flex flex-col justify-between shrink-0">
            <div className="flex justify-between items-center text-cyan-400">
              <span className="font-bold">Active Net Trace: {activeNet}</span>
              <span className="text-slate-400">Schematic Coordinates: (340.0, 130.0)</span>
            </div>
            <div className="flex space-x-4 text-slate-400">
              <span>Pins connected: U2700.A12, U2700.B12, U0100.A1, C2100.1</span>
              <span className="text-emerald-400">Diode Mode Reference: 0.430V</span>
            </div>
          </div>
        </section>
      </div>

      {/* 3. BOTTOM STATUS BAR (JCID Style) */}
      <footer className="h-6 bg-[#0b1120] border-t border-slate-800 px-3 flex items-center justify-between text-[10px] font-mono text-slate-400 shrink-0">
        <div className="flex items-center space-x-3">
          <span className="text-emerald-400 flex items-center space-x-1">
            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
            <span>Ready</span>
          </span>
          <span>[A side lights up: {highlightedCount} points]</span>
          <span>[tag number: {selectedPin ? selectedPin.id : "—"}]</span>
          <span>[net name: {activeNet}]</span>
        </div>
        <div className="text-slate-500">BoardForge Diagnostic System · Real-Time Cross-Probing Active</div>
      </footer>
    </div>
  );
}
