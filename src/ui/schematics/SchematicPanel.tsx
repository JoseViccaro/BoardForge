/**
 * SchematicPanel (PR 3E, boardforge-redesign).
 *
 * Thin zero-logic React adapter that composes the pure schematic cores from
 * units 3A-3D. It performs NO business/domain logic of its own — every behavior
 * lives in the already-tested cores:
 *
 *   - renders pages via VectorRenderer (`renderPage`)
 *   - hit-tests clicks via HitTester on token bounds
 *   - draws the cross-probe overlay via overlay-resolve (`resolveNetOverlay`)
 *   - navigates pages via schematic-nav (`SchematicNavigator`, `jumpToRefDes`)
 *   - shows the detail pin row / connected nets via schematic-pinmap
 *     (`buildPinMap`, `collectConnectedNets`)
 *
 * It subscribes to the workbench `selection.change` bus event so a boardview
 * selection (net / refDes) drives the schematic highlight and page navigation
 * at sub-second latency, mirroring the BoardViewPanel adapter (PR 2).
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { WorkbenchFacade } from "../../application/workbench/WorkbenchFacade.js";
import type { SchematicDocument } from "../../domain/schematics/aggregates/SchematicDocument.js";
import type { SchematicCrossProbeIndex } from "../../domain/schematics/services/SchematicCrossProbeIndex.js";
import type { VectorToken } from "../../domain/schematics/value-objects/VectorToken.js";
import { renderPage, type Draw2D } from "./VectorRenderer.js";
import { HitTester } from "./HitTester.js";
import {
  resolveNetOverlay,
  type OverlayResolveResult,
} from "./overlay-resolve.js";
import {
  SchematicNavigator,
  jumpToRefDes,
} from "./schematic-nav.js";
import {
  buildPinMap,
  collectConnectedNets,
  type PinMapRow,
} from "./schematic-pinmap.js";

/**
 * Adapt a real canvas 2D context to the renderer's structural Draw2D port.
 * CanvasRenderingContext2D exposes every member Draw2D needs; only the DOM
 * `fillStyle` union is wider than the port's `string`, hence the cast.
 */
function toDraw2D(ctx: CanvasRenderingContext2D): Draw2D {
  return ctx as unknown as Draw2D;
}

export interface SchematicPanelProps {
  facade: WorkbenchFacade;
  document: SchematicDocument;
  crossProbe: SchematicCrossProbeIndex;
}

/** Detail model shown in the pin row: a refDes, its page list and pin map. */
interface ComponentDetail {
  refDes: string;
  pageList: number[];
  pins: PinMapRow[];
  connectedNets: string[];
}

export function SchematicPanel({
  facade,
  document,
  crossProbe,
}: SchematicPanelProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [overlay, setOverlay] = useState<OverlayResolveResult>({
    notInSchematic: false,
    pageNumbers: [],
    highlights: [],
  });
  const [notInSchematic, setNotInSchematic] = useState<boolean>(false);
  const [activeNet, setActiveNet] = useState<string | null>(null);
  const [detail, setDetail] = useState<ComponentDetail | null>(null);

  // Navigator initialized to page 1 over the document's page count.
  const navigator = useMemo(
    () => new SchematicNavigator(document.pageCount, 1),
    [document.pageCount]
  );
  const [currentPage, setCurrentPage] = useState<number>(navigator.currentPage);

  // Flat token list across all pages (fed to HitTester + per-page render).
  const allTokens = useMemo<VectorToken[]>(() => {
    const tokens: VectorToken[] = [];
    for (const page of document.pages.values()) {
      tokens.push(...page.tokens);
    }
    return tokens;
  }, [document]);

  const hitTester = useMemo(() => new HitTester(allTokens), [allTokens]);

  const currentPageTokens = useMemo(
    () => allTokens.filter((t) => t.pageNumber === currentPage),
    [allTokens, currentPage]
  );

  const currentPageSize = useMemo(
    () => document.getPage(currentPage),
    [document, currentPage]
  );

  // Increment a render counter to trigger repaint after state settles.
  const [, setFrame] = useState(0);
  const repaint = useCallback(() => setFrame((n) => n + 1), []);

  // Bus subscription: a boardview selection drives the schematic overlay/nav.
  useEffect(() => {
    return facade.bus.subscribe("selection.change", (selection) => {
      if (selection.net) {
        const result = resolveNetOverlay(crossProbe, selection.net);
        setOverlay(result);
        setNotInSchematic(result.notInSchematic);
        setActiveNet(selection.net);
        if (result.pageNumbers.length > 0) {
          navigator.jumpTo(result.pageNumbers[0]);
          setCurrentPage(navigator.currentPage);
        }
      }
      if (selection.refDes) {
        const aggregate = document.getSymbol(selection.refDes);
        if (aggregate) {
          const jump = jumpToRefDes(aggregate);
          navigator.jumpTo(jump.pageNumber);
          setCurrentPage(navigator.currentPage);
          const pins = document.findPinsForRefDes(aggregate.refDes);
          setDetail({
            refDes: aggregate.refDes,
            pageList: jump.pageList,
            pins: buildPinMap(pins),
            connectedNets: collectConnectedNets(pins),
          });
        }
      }
      repaint();
    });
  }, [facade, crossProbe, document, navigator, repaint]);

  // Paint frame — pure pipeline composed from the tested cores.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const displayWidth = canvas.clientWidth;
    const displayHeight = canvas.clientHeight;
    if (
      canvas.width !== displayWidth * dpr ||
      canvas.height !== displayHeight * dpr
    ) {
      canvas.width = displayWidth * dpr;
      canvas.height = displayHeight * dpr;
    }

    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, displayWidth, displayHeight);

    const pageWidth = currentPageSize?.width ?? displayWidth;
    const pageHeight = currentPageSize?.height ?? displayHeight;

    // Fit-scale the page into the canvas and center it.
    const fitScale = Math.min(displayWidth / pageWidth, displayHeight / pageHeight);
    const ox = (displayWidth - pageWidth * fitScale) / 2;
    const oy = (displayHeight - pageHeight * fitScale) / 2;

    ctx.save();
    ctx.translate(ox, oy);
    ctx.scale(fitScale, fitScale);

    // Render the current page's tokens through the VectorRenderer core.
    renderPage(currentPageTokens, currentPage, toDraw2D(ctx), pageWidth, pageHeight);

    // Stroke the cross-probe overlay for the active page (adapter glue only).
    if (!overlay.notInSchematic) {
      ctx.save();
      ctx.strokeStyle = "#eab308";
      ctx.fillStyle = "rgba(234, 179, 8, 0.12)";
      ctx.lineWidth = 2 / fitScale;
      for (const page of overlay.highlights) {
        if (page.pageNumber !== currentPage) continue;
        ctx.fillRect(
          page.bounds.minX,
          page.bounds.minY,
          page.bounds.width,
          page.bounds.height
        );
        ctx.strokeRect(
          page.bounds.minX,
          page.bounds.minY,
          page.bounds.width,
          page.bounds.height
        );
      }
      ctx.restore();
    }

    ctx.restore();
    ctx.restore();
  }, [currentPageTokens, currentPage, overlay, currentPageSize, repaint]);

  // ---- Interaction ---------------------------------------------------------

  const handlePrev = () => {
    navigator.previous();
    setCurrentPage(navigator.currentPage);
  };

  const handleNext = () => {
    navigator.next();
    setCurrentPage(navigator.currentPage);
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    const pageWidth = currentPageSize?.width ?? canvas.clientWidth;
    const pageHeight = currentPageSize?.height ?? canvas.clientHeight;
    const fitScale = Math.min(canvas.clientWidth / pageWidth, canvas.clientHeight / pageHeight);
    const ox = (canvas.clientWidth - pageWidth * fitScale) / 2;
    const oy = (canvas.clientHeight - pageHeight * fitScale) / 2;
    const worldX = (cx - ox) / fitScale;
    const worldY = (cy - oy) / fitScale;
    const hit = hitTester.hitTest(worldX, worldY, currentPage);
    if (!hit) return;
    // Clicking a schematic token emits it as a selection so cross-panel sync reacts.
    const netName = hit.text.toUpperCase();
    facade.select({
      boardId: facade.sessionStore.getSnapshot().pairing?.boardId ?? "",
      net: netName,
    });
  };

  // ---- Render --------------------------------------------------------------

  return (
    <div className="flex-1 flex flex-col bg-slate-950 overflow-hidden min-w-0">
      <div className="h-9 bg-slate-900 border-b border-slate-800 px-4 flex items-center justify-between text-xs shrink-0">
        <div className="flex items-center space-x-2 font-mono">
          <span className="text-slate-400">Net:</span>
          <span className="px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 font-bold">
            {activeNet ?? "—"}
          </span>
          {notInSchematic && (
            <span className="px-2 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/30 font-semibold">
              NOT IN SCHEMATIC
            </span>
          )}
          <span className="text-slate-500">|</span>
          <span className="text-slate-400">Page:</span>
          <span className="text-amber-400 font-bold">
            {currentPage}
            <span className="text-slate-500">/{document.pageCount}</span>
          </span>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={handlePrev}
            disabled={!navigator.hasPrevious}
            className="p-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-300 rounded border border-slate-700"
            title="Previous page"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleNext}
            disabled={!navigator.hasNext}
            className="p-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-300 rounded border border-slate-700"
            title="Next page"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col relative overflow-hidden">
        <div className="flex-1 flex items-center justify-center overflow-hidden w-full h-full">
          <canvas
            ref={canvasRef}
            onClick={handleCanvasClick}
            className="w-full h-full bg-[#040508] cursor-crosshair"
          />
        </div>

        {detail && (
          <div className="h-28 bg-slate-900 border-t border-slate-800 px-3 py-2 overflow-y-auto shrink-0">
            <div className="flex items-center space-x-2 text-[11px] font-mono mb-1">
              <span className="text-amber-400 font-bold">{detail.refDes}</span>
              <span className="text-slate-500">pages</span>
              <span className="text-slate-200">{detail.pageList.join(", ")}</span>
              <span className="text-slate-500">nets</span>
              <span className="text-cyan-400">
                {detail.connectedNets.length > 0
                  ? detail.connectedNets.join(", ")
                  : "—"}
              </span>
            </div>
            <div className="space-y-0.5 text-[10px] font-mono">
              {detail.pins.map((pin) => (
                <div key={pin.pinNumber} className="flex space-x-3 text-slate-300">
                  <span className="text-amber-400 font-semibold w-8">
                    {pin.pinNumber}
                  </span>
                  <span className="text-slate-400 w-32 truncate">
                    {pin.pinName ?? "—"}
                  </span>
                  <span className="text-slate-400 w-8">p{pin.pageNumber}</span>
                  <span className="text-slate-500">
                    ({pin.coordinates.x.toFixed(1)}, {pin.coordinates.y.toFixed(1)})
                  </span>
                  <span className="text-cyan-400">
                    {pin.connectedNetName ?? "—"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
