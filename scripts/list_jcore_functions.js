import fs from "fs";

function listExports(filePath) {
  const buf = fs.readFileSync(filePath);
  const peOffset = buf.readUInt32LE(0x3c);
  const optionalHeaderOffset = peOffset + 24;
  const is64 = buf.readUInt16LE(optionalHeaderOffset) === 0x20b;
  const exportTableRvaOffset = is64 ? optionalHeaderOffset + 112 : optionalHeaderOffset + 96;
  const exportRva = buf.readUInt32LE(exportTableRvaOffset);

  const numSections = buf.readUInt16LE(peOffset + 6);
  const sectionHeaderOffset = optionalHeaderOffset + (is64 ? 240 : 224);

  const rvaToOffset = (rva) => {
    for (let i = 0; i < numSections; i++) {
      const secOffset = sectionHeaderOffset + i * 40;
      const vSize = buf.readUInt32LE(secOffset + 8);
      const vAddr = buf.readUInt32LE(secOffset + 12);
      const rOffset = buf.readUInt32LE(secOffset + 20);
      if (rva >= vAddr && rva < vAddr + vSize) {
        return rOffset + (rva - vAddr);
      }
    }
    return 0;
  };

  const expOffset = rvaToOffset(exportRva);
  const numNames = buf.readUInt32LE(expOffset + 24);
  const namesRva = buf.readUInt32LE(expOffset + 32);
  const namesOffset = rvaToOffset(namesRva);

  const names = [];
  for (let i = 0; i < numNames; i++) {
    const nameRva = buf.readUInt32LE(namesOffset + i * 4);
    const nameOff = rvaToOffset(nameRva);
    let str = "";
    let p = nameOff;
    while (buf[p] !== 0) {
      str += String.fromCharCode(buf[p]);
      p++;
    }
    names.push(str);
  }

  console.log("Exported functions from jcore.dll:", names);
}

listExports("C:\\Program Files (x86)\\JCID\\jcore.dll");
