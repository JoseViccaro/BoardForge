import fs from "fs";

const buf = fs.readFileSync("C:\\Program Files\\Phoneboard\\phoneboard.exe");
console.log("phoneboard.exe size:", buf.length);

// Search for strings related to iPhone 11 Pro or other embedded board models
const str = buf.toString("latin1");
const models = str.match(/iPhone[A-Za-z0-9_\-\s]{2,20}/g) || [];
const uniqueModels = [...new Set(models)];
console.log("Found embedded iPhone models in phoneboard.exe:", uniqueModels.slice(0, 30));
