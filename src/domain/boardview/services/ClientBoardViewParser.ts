/**
 * CLIENT-SIDE PARSER ENGINE FOR STANDARD BOARDVIEW & CAD FILES (.brd, .cad, .fz, .bdv, .json)
 * Converts raw uploaded file text/buffers into pure mathematical vector structures for instant rendering.
 */

export interface ParsedPin {
  id: string;
  padNumber: string;
  x: number;
  y: number;
  w?: number;
  h?: number;
  r?: number;
  net: string;
  comp: string;
  side: "A" | "B";
  diodeMv?: number | "OL";
  shape: "RECT" | "CIRCLE";
}

export interface ParsedComponent {
  designator: string;
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  side: "A" | "B";
  type: "IC" | "COIL" | "CAP" | "RES" | "FPC" | "DIODE" | "CONNECTOR";
  pins: ParsedPin[];
}

export interface ParsedBoardView {
  fileName: string;
  format: "BRD_LANDREX" | "GENCAD" | "FRITZING_FZ" | "BDV_ASCII" | "JSON_RAW";
  width: number;
  height: number;
  components: ParsedComponent[];
  pins: ParsedPin[];
  nets: string[];
}

export function parseUploadedBoardView(fileName: string, content: string | ArrayBuffer): ParsedBoardView {
  const ext = fileName.split(".").pop()?.toLowerCase() || "";
  const text = typeof content === "string" ? content : new TextDecoder("utf-8").decode(content);

  const components: ParsedComponent[] = [];
  const pins: ParsedPin[] = [];
  const netSet = new Set<string>();

  // 1. JSON RAW FORMAT (e.g. Phoneboard / BoardForge JSON export)
  if (ext === "json" || text.trim().startsWith("{")) {
    try {
      const parsed = JSON.parse(text);
      if (parsed.pins && Array.isArray(parsed.pins)) {
        parsed.pins.forEach((p: any, idx: number) => {
          const pinObj: ParsedPin = {
            id: p.id || `PIN_${idx + 1}`,
            padNumber: p.padNumber || `${idx + 1}`,
            x: Number(p.x) || 0,
            y: Number(p.y) || 0,
            r: p.r || 0.25,
            w: p.w,
            h: p.h,
            net: p.net || "N/C",
            comp: p.comp || "UNNAMED",
            side: p.side === "B" ? "B" : "A",
            diodeMv: p.diodeMv,
            shape: p.shape === "RECT" ? "RECT" : "CIRCLE"
          };
          pins.push(pinObj);
          if (pinObj.net && pinObj.net !== "N/C" && pinObj.net !== "GND") {
            netSet.add(pinObj.net);
          }
        });
      }

      if (parsed.components && Array.isArray(parsed.components)) {
        parsed.components.forEach((c: any) => {
          components.push({
            designator: c.designator || c.name || "COMP",
            name: c.name || c.designator || "Component",
            x: Number(c.x) || 0,
            y: Number(c.y) || 0,
            w: Number(c.w) || 2.0,
            h: Number(c.h) || 2.0,
            side: c.side === "B" ? "B" : "A",
            type: c.type || "IC",
            pins: []
          });
        });
      }

      return {
        fileName,
        format: "JSON_RAW",
        width: 60,
        height: 120,
        components,
        pins,
        nets: Array.from(netSet)
      };
    } catch(e) {
      console.warn("JSON parse fallback to text scan:", e);
    }
  }

  // 2. BDV ASCII OR LANDREX TEXT PARSER (.bdv, .txt, .brd text stream)
  const lines = text.split(/\r?\n/);
  let currentComp = "GENERIC";

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("//")) continue;

    // Pattern: RefDes PinNum X Y Net Side
    // Example: U3300 1 20.5 65.2 PP_VDD_MAIN TOP
    const parts = trimmed.split(/[\s,;\t]+/);
    if (parts.length >= 5) {
      const comp = parts[0];
      const pinNum = parts[1];
      const x = parseFloat(parts[2]);
      const y = parseFloat(parts[3]);
      const net = parts[4] || "N/C";
      const side = (parts[5] && parts[5].toUpperCase().includes("B")) ? "B" : "A";

      if (!isNaN(x) && !isNaN(y)) {
        const pinId = `${comp}.${pinNum}`;
        pins.push({
          id: pinId,
          padNumber: pinNum,
          x,
          y,
          r: 0.25,
          net,
          comp,
          side,
          shape: "CIRCLE"
        });

        if (net && net !== "GND" && net !== "N/C") {
          netSet.add(net);
        }
      }
    }
  }

  return {
    fileName,
    format: ext === "brd" ? "BRD_LANDREX" : (ext === "cad" ? "GENCAD" : "BDV_ASCII"),
    width: 60,
    height: 120,
    components,
    pins,
    nets: Array.from(netSet)
  };
}
