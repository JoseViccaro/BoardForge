import fs from "fs";

const buf = fs.readFileSync("C:\\Program Files\\Phoneboard\\phoneboard.exe");

// Search for qrc / Qt Resource magic: 0x71 0x72 0x65 0x73 ("qres")
const qresMagic = Buffer.from([0x71, 0x72, 0x65, 0x73]);
let pos = 0;
const qresPositions = [];
while ((pos = buf.indexOf(qresMagic, pos)) !== -1) {
  qresPositions.push(pos);
  pos += 4;
}

console.log("Found Qt Resource (qres) sections at offsets:", qresPositions);

// Search for strings with ".fz" or ".brd" in phoneboard.exe
const str = buf.toString("latin1");
const boardFileMatches = str.match(/[a-zA-Z0-9_\-\.\/]{3,50}\.(fz|brd|cad|json)/gi) || [];
console.log("Embedded board filename references in Phoneboard:", [...new Set(boardFileMatches)].slice(0, 30));
