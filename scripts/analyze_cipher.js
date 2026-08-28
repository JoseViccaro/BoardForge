import fs from "fs";

// Read and analyze the encrypted motherboard file
const buf = fs.readFileSync("C:\\Program Files (x86)\\JCID\\jcpf\\IDS_iphxne13_motherboardABFull.arj");
console.log("Analyzing 2.17MB JCID iPhone 13 Motherboard Archive...");

// Check common symmetric keystream patterns or known plaintexts (like XML, JSON, or CAD magic headers)
console.log("First 64 bytes:", buf.subarray(0, 64));

// Test 1-byte XOR keys
let bestScore = 0;
let bestKey = 0;
for (let k = 0; k < 256; k++) {
  let score = 0;
  for (let i = 0; i < 2000; i++) {
    const b = buf[i] ^ k;
    if ((b >= 65 && b <= 90) || (b >= 97 && b <= 122) || (b >= 48 && b <= 57) || b === 32 || b === 10 || b === 13) {
      score++;
    }
  }
  if (score > bestScore) {
    bestScore = score;
    bestKey = k;
  }
}

console.log(`Best 1-byte XOR key: 0x${bestKey.toString(16)} with score ${bestScore}/2000`);
if (bestScore > 1200) {
  console.log("Decrypted preview with 1-byte XOR:\n", Buffer.from(buf.subarray(0, 200).map(b => b ^ bestKey)).toString("latin1"));
} else {
  console.log("File is encrypted with block cipher (AES/CryptoPP). Direct bridge required.");
}
