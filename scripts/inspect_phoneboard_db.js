import fs from "fs";

const buf = fs.readFileSync("C:\\Users\\LAB-JOSE\\AppData\\Local\\phoneboard.co\\Phoneboard\\smb_database.db");
console.log("Read Phoneboard smb_database.db size:", buf.length);

// SQLite header: "SQLite format 3\0"
console.log("Header:", buf.subarray(0, 16).toString("latin1"));

// Extract all ASCII/UTF-8 strings
const str = buf.toString("latin1");
const matches = str.match(/[\x20-\x7E]{4,}/g) || [];
console.log("Extracted strings from Phoneboard DB (first 50):", matches.slice(0, 50));
