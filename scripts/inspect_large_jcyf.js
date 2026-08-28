import fs from "fs";

const filePath = "C:\\Program Files (x86)\\JCID\\jcyf\\iuEWl0yS7tqdVu8EWeOvrfBRQMGFsncp7bUMmnpCWUCOYdttdZDDHUMtHv0S.jcyf";
const fd = fs.openSync(filePath, "r");
const buf = Buffer.alloc(128);
fs.readSync(fd, buf, 0, 128, 0);
fs.closeSync(fd);

console.log("File size: 29.4MB");
console.log("Header bytes:", buf.subarray(0, 32));
console.log("ASCII:", buf.subarray(0, 64).toString("latin1").replace(/[^\x20-\x7E]/g, "."));
