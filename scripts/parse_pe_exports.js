import fs from "fs";

function parsePeExports(filePath) {
  const buf = fs.readFileSync(filePath);
  const peOffset = buf.readUInt32LE(0x3c);
  const optionalHeaderOffset = peOffset + 24;
  const magic = buf.readUInt16LE(optionalHeaderOffset);
  const is64 = magic === 0x20b;
  const exportTableRvaOffset = is64 ? optionalHeaderOffset + 112 : optionalHeaderOffset + 96;
  const exportRva = buf.readUInt32LE(exportTableRvaOffset);
  const exportSize = buf.readUInt32LE(exportTableRvaOffset + 4);

  console.log(`PE offset: 0x${peOffset.toString(16)}, Magic: 0x${magic.toString(16)} (${is64 ? "PE64" : "PE32"})`);
  console.log(`Export Table RVA: 0x${exportRva.toString(16)}, Size: ${exportSize}`);

  // Find section containing export RVA
  const numSections = buf.readUInt16LE(peOffset + 6);
  const sectionHeaderOffset = optionalHeaderOffset + (is64 ? 240 : 224);

  let fileOffset = 0;
  for (let i = 0; i < numSections; i++) {
    const secOffset = sectionHeaderOffset + i * 40;
    const secName = buf.subarray(secOffset, secOffset + 8).toString("latin1").replace(/\0.*$/, "");
    const vSize = buf.readUInt32LE(secOffset + 8);
    const vAddr = buf.readUInt32LE(secOffset + 12);
    const rSize = buf.readUInt32LE(secOffset + 16);
    const rOffset = buf.readUInt32LE(secOffset + 20);

    if (exportRva >= vAddr && exportRva < vAddr + vSize) {
      fileOffset = rOffset + (exportRva - vAddr);
      console.log(`Export table in section ${secName}, file offset: 0x${fileOffset.toString(16)}`);
      break;
    }
  }

  if (!fileOffset) {
    console.log("Export table not found or DLL has no exports.");
    return;
  }

  const numNames = buf.readUInt32LE(fileOffset + 24);
  const namePointersRva = buf.readUInt32LE(fileOffset + 32);
  console.log(`Number of exported function names: ${numNames}`);
}

parsePeExports("C:\\Program Files (x86)\\JCID\\jcore.dll");
