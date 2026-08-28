import fs from "fs";

const buf = fs.readFileSync("scripts/iphone13_decompressed.bin");
console.log("Analyzing decompressed binary size:", buf.length);

// Extract all pin and net names
const nets = new Set();
const components = new Set();

let offset = 0;
while (offset < buf.length) {
  // Look for net names matching standard Apple microelectronics conventions
  const chunk = buf.subarray(offset, Math.min(offset + 128, buf.length)).toString("latin1");
  const matchNet = chunk.match(/(?:PP|IO|I2C|SPI|UART|CLK|CONN|VDD|GND|CHG|PMU|SOC|BUTTON)[A-Za-z0-9_]+/);
  if (matchNet) {
    nets.add(matchNet[0]);
  }
  const matchComp = chunk.match(/\b([UCRLQDJFLTPM][0-9]{3,5}|SB[0-9]{4})\b/);
  if (matchComp) {
    components.add(matchComp[0]);
  }
  offset += 32;
}

console.log("Unique Real Apple iPhone 13 Nets Extracted:", nets.size);
console.log("Sample Nets:", Array.from(nets).slice(0, 30));
console.log("Unique Real Components Extracted:", components.size);
console.log("Sample Components:", Array.from(components).slice(0, 30));
