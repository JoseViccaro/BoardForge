import { describe, it, expect } from "vitest";
import { MagicBytesValidator } from "../../../src/interfaces/http/middlewares/magic-bytes-validator.js";
import { Readable } from "node:stream";

describe("MagicBytesValidator", () => {
  it("should validate PDF signatures (%PDF-)", async () => {
    const validPdfBuffer = Buffer.from("%PDF-1.7 header content here");
    const result = MagicBytesValidator.inspectBuffer(validPdfBuffer);

    expect(result.isValid).toBe(true);
    expect(result.detectedType).toBe("pdf");

    // Test stream inspection
    const stream = Readable.from(validPdfBuffer);
    const streamResult = await MagicBytesValidator.inspectStream(stream);
    expect(streamResult.isValid).toBe(true);
    expect(streamResult.detectedType).toBe("pdf");
  });

  it("should validate BoardView format headers ([format], BRD, BDV, FZZ zip, XML/JSON)", async () => {
    // 1. Text BDV [format]
    const bdvBuf = Buffer.from("[format]\nversion=1\n");
    expect(MagicBytesValidator.inspectBuffer(bdvBuf).isValid).toBe(true);
    expect(MagicBytesValidator.inspectBuffer(bdvBuf).detectedType).toBe("boardview");

    // 2. Binary Landrex BRD
    const brdBuf = Buffer.from("BRD2020\x00\x01\x02");
    expect(MagicBytesValidator.inspectBuffer(brdBuf).isValid).toBe(true);
    expect(MagicBytesValidator.inspectBuffer(brdBuf).detectedType).toBe("boardview");

    // 3. FZZ Zip archive PK\x03\x04
    const zipBuf = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00, 0x00]);
    expect(MagicBytesValidator.inspectBuffer(zipBuf).isValid).toBe(true);
    expect(MagicBytesValidator.inspectBuffer(zipBuf).detectedType).toBe("boardview");

    // 4. JSON / XML
    const jsonBuf = Buffer.from('{"format": "cad"}');
    expect(MagicBytesValidator.inspectBuffer(jsonBuf).isValid).toBe(true);
    expect(MagicBytesValidator.inspectBuffer(jsonBuf).detectedType).toBe("boardview");
  });

  it("should reject executables (MZ, ELF) and shell scripts", () => {
    // Windows PE / DOS MZ
    const mzBuf = Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03]);
    const mzRes = MagicBytesValidator.inspectBuffer(mzBuf);
    expect(mzRes.isValid).toBe(false);
    expect(mzRes.isExecutable).toBe(true);

    // Linux ELF
    const elfBuf = Buffer.from([0x7f, 0x45, 0x4c, 0x46, 0x02]);
    const elfRes = MagicBytesValidator.inspectBuffer(elfBuf);
    expect(elfRes.isValid).toBe(false);
    expect(elfRes.isExecutable).toBe(true);

    // Shell script
    const shBuf = Buffer.from("#!/bin/bash\nrm -rf /");
    const shRes = MagicBytesValidator.inspectBuffer(shBuf);
    expect(shRes.isValid).toBe(false);
  });
});
