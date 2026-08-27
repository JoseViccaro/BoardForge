import { Readable } from "node:stream";

export interface MagicBytesInspectionResult {
  isValid: boolean;
  detectedType?: "pdf" | "boardview" | "archive";
  isExecutable?: boolean;
  reason?: string;
}

export class MagicBytesValidator {
  public static inspectBuffer(buffer: Buffer): MagicBytesInspectionResult {
    if (!buffer || buffer.length === 0) {
      return { isValid: false, reason: "Empty buffer" };
    }

    // 1. Check for Executables / Shell Scripts
    // Windows PE / DOS MZ
    if (buffer.length >= 2 && buffer[0] === 0x4d && buffer[1] === 0x5a) {
      return { isValid: false, isExecutable: true, reason: "Windows PE/DOS executable detected." };
    }

    // Linux ELF
    if (
      buffer.length >= 4 &&
      buffer[0] === 0x7f &&
      buffer[1] === 0x45 &&
      buffer[2] === 0x4c &&
      buffer[3] === 0x46
    ) {
      return { isValid: false, isExecutable: true, reason: "Linux ELF executable detected." };
    }

    // Shell script (#!/bin/...)
    if (buffer.length >= 2 && buffer[0] === 0x23 && buffer[1] === 0x21) {
      return { isValid: false, isExecutable: true, reason: "Shell script detected." };
    }

    // 2. Check PDF signature (%PDF-)
    if (
      buffer.length >= 5 &&
      buffer[0] === 0x25 && // %
      buffer[1] === 0x50 && // P
      buffer[2] === 0x44 && // D
      buffer[3] === 0x46 && // F
      buffer[4] === 0x2d // -
    ) {
      return { isValid: true, detectedType: "pdf" };
    }

    // 3. Check Zip / FZZ archive PK\x03\x04
    if (
      buffer.length >= 4 &&
      buffer[0] === 0x50 &&
      buffer[1] === 0x4b &&
      buffer[2] === 0x03 &&
      buffer[3] === 0x04
    ) {
      return { isValid: true, detectedType: "boardview" };
    }

    // 4. Binary Landrex BRD header
    if (
      buffer.length >= 3 &&
      buffer[0] === 0x42 && // B
      buffer[1] === 0x52 && // R
      buffer[2] === 0x44 // D
    ) {
      return { isValid: true, detectedType: "boardview" };
    }

    // 5. Text formats: [format], XML, JSON, CAD, BDV
    const headerStr = buffer.slice(0, Math.min(buffer.length, 512)).toString("utf8").trimStart();

    if (
      headerStr.toLowerCase().startsWith("[format]") ||
      headerStr.startsWith("{") ||
      headerStr.startsWith("[") ||
      headerStr.startsWith("<") ||
      headerStr.toUpperCase().startsWith("GENCAD") ||
      headerStr.toUpperCase().startsWith("$HEADER") ||
      headerStr.toUpperCase().startsWith("PAR_") ||
      headerStr.toLowerCase().startsWith("board")
    ) {
      return { isValid: true, detectedType: "boardview" };
    }

    return { isValid: false, reason: "Unrecognized file signature" };
  }

  public static async inspectStream(stream: Readable): Promise<MagicBytesInspectionResult> {
    return new Promise((resolve) => {
      const chunks: Buffer[] = [];
      let totalBytes = 0;

      const onData = (chunk: Buffer) => {
        chunks.push(chunk);
        totalBytes += chunk.length;
        if (totalBytes >= 512) {
          stream.removeListener("data", onData);
          stream.pause();
          const sample = Buffer.concat(chunks, 512);
          resolve(MagicBytesValidator.inspectBuffer(sample));
        }
      };

      stream.on("data", onData);
      stream.on("end", () => {
        const sample = Buffer.concat(chunks);
        resolve(MagicBytesValidator.inspectBuffer(sample));
      });
      stream.on("error", () => {
        resolve({ isValid: false, reason: "Stream read error" });
      });
    });
  }
}
