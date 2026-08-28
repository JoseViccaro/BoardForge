import fs from "fs";
import zlib from "zlib";

const filePath = "C:\\Program Files (x86)\\JCID\\jcyf\\iuEWl0yS7tqdVu8EWeOvrfBRQMGFsncp7bUMmnpCWUCOYdttdZDDHUMtHv0S.jcyf";
const raw = fs.readFileSync(filePath);
console.log("Read 29.4MB file. Total Bytes:", raw.length);

// Header is "Copyright ? 2020 JCID. All rights reserved." (38 bytes)
// Search for zlib/deflate streams or raw float vertex arrays
let zlibOffset = -1;
for (let i = 0; i < 2000; i++) {
  if (raw[i] === 0x78 && (raw[i+1] === 0x9c || raw[i+1] === 0xda || raw[i+1] === 0x01)) {
    try {
      const dec = zlib.inflateSync(raw.subarray(i, i + 500000));
      console.log(`ZLIB STREAM FOUND AT OFFSET ${i}! Decompressed size: ${dec.length}`);
      zlibOffset = i;
      break;
    } catch(e) {}
  }
}

if (zlibOffset === -1) {
  console.log("No standard zlib at first 2000 bytes. Analyzing byte entropy...");
  // Check if XOR or AES encrypted
  const head = raw.subarray(38, 70);
  console.log("Byte sample after copyright:", head);
}
