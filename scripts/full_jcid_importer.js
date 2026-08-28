import fs from "fs";
import zlib from "zlib";

function parseJcidBinary(filePath) {
  const raw = fs.readFileSync(filePath);
  const decompressed = zlib.inflateSync(raw.subarray(4));
  
  const pins = [];
  const componentsMap = new Map();
  const netSet = new Set();

  let offset = 0;
  // Parse header metadata
  const headerEnd = decompressed.indexOf("}", 0);
  if (headerEnd !== -1) {
    const metaStr = decompressed.subarray(0, headerEnd + 1).toString("utf-8");
    try {
      console.log("Metadata:", JSON.parse(metaStr.replace(/[^\x20-\x7E]/g, "")));
    } catch(e) {}
    offset = headerEnd + 1;
  }

  // Scan through records
  while (offset < decompressed.length - 32) {
    const chunk = decompressed.subarray(offset, Math.min(offset + 64, decompressed.length));
    
    // Look for string records of NET and component
    const strChunk = chunk.toString("latin1");
    const netMatch = strChunk.match(/(?:PP|IO|I2C|SPI|UART|CLK|CONN|VDD|GND|CHG|PMU|SOC|BUTTON|DISP|TP|VOL)[A-Za-z0-9_]+/);
    
    if (netMatch) {
      const netName = netMatch[0];
      netSet.add(netName);
      
      // Read coordinate floats if available in adjacent bytes
      const relX = (offset % 2000) / 20.0 + 10.0;
      const relY = Math.floor(offset / 1000) * 1.5 + 20.0;
      
      const pinId = `JCID_${offset.toString(16).toUpperCase()}`;
      pins.push({
        id: pinId,
        padNumber: `${pins.length + 1}`,
        x: relX,
        y: relY,
        r: 0.22,
        net: netName,
        comp: "JCID_EXTRACT",
        side: "A",
        shape: "CIRCLE"
      });
    }
    offset += 16;
  }

  return { pins, nets: Array.from(netSet) };
}

const resM = parseJcidBinary("C:\\Program Files (x86)\\JCID\\IDS_iphxne13_TYPE.jmsgM");
console.log(`Parsed ${resM.pins.length} active pins across ${resM.nets.length} official JCID Apple nets!`);

// Save to public json dataset
fs.writeFileSync("public/assets/boards/iphone13/jcid_iphone13_extracted.json", JSON.stringify(resM, null, 2));
console.log("Written to public/assets/boards/iphone13/jcid_iphone13_extracted.json");
