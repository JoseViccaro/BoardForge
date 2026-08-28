import fs from "fs";
import zlib from "zlib";

function inspectJcidFile(filePath) {
  const buf = fs.readFileSync(filePath);
  console.log("File:", filePath, "Total Length:", buf.length);
  console.log("Header first 8 bytes:", buf.subarray(0, 8));

  // Notice bytes 4..5 are 0x78 0x9C (Zlib magic header!)
  const zlibPayload = buf.subarray(4);
  try {
    const decompressed = zlib.inflateSync(zlibPayload);
    console.log("Decompression SUCCESS! Decompressed size:", decompressed.length);
    console.log("First 300 characters:", decompressed.subarray(0, 300).toString("utf-8"));
  } catch (err) {
    console.error("Direct inflate error:", err.message);
  }
}

inspectJcidFile("C:\\Program Files (x86)\\JCID\\IDS_iphxne13_TYPE.jmsgM");
inspectJcidFile("C:\\Program Files (x86)\\JCID\\IDS_iphxne13_TYPE.jmsgB");
