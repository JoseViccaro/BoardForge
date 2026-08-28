import fs from "fs";
import zlib from "zlib";

const jcyfFiles = fs.readdirSync("C:\\Program Files (x86)\\JCID\\jcyf");
console.log("Total jcyf files:", jcyfFiles.length);

let found = 0;
for (const file of jcyfFiles.slice(0, 50)) {
  const fullPath = `C:\\Program Files (x86)\\JCID\\jcyf\\${file}`;
  try {
    const raw = fs.readFileSync(fullPath);
    // Test if zlib inflated
    if (raw[4] === 0x78 && raw[5] === 0x9c) {
      const decompressed = zlib.inflateSync(raw.subarray(4));
      const str = decompressed.toString("latin1");
      if (str.includes("U3300") || str.includes("U0100") || str.includes("820-02106") || str.includes("iPhone")) {
        console.log(`FOUND IPHONE 13 CAD in ${file}! Size: ${decompressed.length}`);
        found++;
      }
    }
  } catch(e) {}
}

if (found === 0) {
  console.log("Inspected 50 files without explicit plain strings; let's inspect format of jcyf payload.");
}
