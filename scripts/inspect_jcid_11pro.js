import fs from "fs";

function extractStrings(filePath) {
  const buf = fs.readFileSync(filePath);
  console.log("File:", filePath, "Size:", buf.length);
  const str = buf.toString("latin1");
  const matches = str.match(/[\x20-\x7E]{3,}/g) || [];
  console.log("Extracted strings count:", matches.length);
  console.log("Sample strings:", matches.slice(0, 40));
}

extractStrings("C:\\Program Files (x86)\\JCID\\jcof\\IDS_iphxne11Pro_motherboard.xlsr");
