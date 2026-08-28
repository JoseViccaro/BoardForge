import fs from "fs";

function inspectFile(filePath) {
  const buf = fs.readFileSync(filePath);
  console.log("File:", filePath, "Size:", buf.length);
  console.log("Header (hex):", buf.subarray(0, 16).toString("hex"));
  console.log("Header (ascii):", buf.subarray(0, 64).toString("latin1").replace(/[^\x20-\x7E]/g, "."));
}

inspectFile("C:\\Program Files (x86)\\JCID\\jcpf\\IDS_iphxne13_motherboardABFull.arj");
inspectFile("C:\\Program Files (x86)\\JCID\\jcof\\IDS_iphxne13_motherboard.xlsr");
