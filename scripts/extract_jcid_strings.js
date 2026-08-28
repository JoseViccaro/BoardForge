import fs from "fs";
import zlib from "zlib";

const bufM = fs.readFileSync("C:\\Program Files (x86)\\JCID\\IDS_iphxne13_TYPE.jmsgM");
const decompressed = zlib.inflateSync(bufM.subarray(4));

// Save decompressed binary stream to examine exact records
fs.writeFileSync("scripts/iphone13_decompressed.bin", decompressed);
console.log("Saved decompressed payload. Length:", decompressed.length);

// Scan for ASCII and UTF-8 strings
const str = decompressed.toString("latin1");
const lines = str.match(/[\x20-\x7E]{4,}/g) || [];
console.log("Total readable ASCII strings found:", lines.length);
console.log("First 40 strings extracted from real JCID iPhone 13 database:\n", lines.slice(0, 40));
