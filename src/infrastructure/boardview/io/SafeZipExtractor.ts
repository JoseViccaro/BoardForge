import * as zlib from "node:zlib";
import { SafeBinaryReader, PrematureEndOfStreamError } from "./SafeBinaryReader.js";

export class ZipBombError extends Error {
  constructor(message: string, public readonly code: string = "DECOMPRESSION_BOMB_DETECTED") {
    super(message);
    this.name = "ZipBombError";
  }
}

export interface ExtractorOptions {
  maxRatio?: number;            // Default: 10
  maxUncompressedSize?: number; // Default: 50 MB
  maxEntries?: number;          // Default: 100
}

export interface ExtractedFile {
  filename: string;
  data: Uint8Array;
}

export class SafeZipExtractor {
  private readonly maxRatio: number;
  private readonly maxUncompressedSize: number;
  private readonly maxEntries: number;

  constructor(options?: ExtractorOptions) {
    this.maxRatio = options?.maxRatio ?? 10;
    this.maxUncompressedSize = options?.maxUncompressedSize ?? 50 * 1024 * 1024;
    this.maxEntries = options?.maxEntries ?? 100;
  }

  public extract(zipBuffer: Uint8Array): ExtractedFile[] {
    const files: ExtractedFile[] = [];
    const reader = new SafeBinaryReader(zipBuffer);

    let totalUncompressedSize = 0;
    let entryCount = 0;

    // Scan through local headers
    while (reader.getOffset() + 30 <= reader.getLength()) {
      const signature = reader.readUInt32LE();
      if (signature !== 0x04034b50) {
        // End of local file headers or reached central directory (0x02014b50)
        break;
      }

      entryCount++;
      if (entryCount > this.maxEntries) {
        throw new ZipBombError(`ZIP archive exceeds maximum allowed entry count of ${this.maxEntries}.`);
      }

      reader.skip(2); // version needed
      reader.skip(2); // flags
      const compressionMethod = reader.readUInt16LE(); // 0 = store, 8 = deflate
      reader.skip(4); // time + date
      reader.skip(4); // crc32
      const compressedSize = reader.readUInt32LE();
      const uncompressedSize = reader.readUInt32LE();
      const filenameLen = reader.readUInt16LE();
      const extraLen = reader.readUInt16LE();

      const filename = reader.readFixedString(filenameLen);
      reader.skip(extraLen);

      // Check decompression bomb conditions
      if (compressedSize > 0) {
        const ratio = uncompressedSize / compressedSize;
        if (ratio > this.maxRatio) {
          throw new ZipBombError(`Decompression ratio ${ratio.toFixed(1)}:1 exceeds limit of ${this.maxRatio}:1 for file ${filename}`);
        }
      }

      totalUncompressedSize += uncompressedSize;
      if (totalUncompressedSize > this.maxUncompressedSize) {
        throw new ZipBombError(`Total uncompressed size of ${totalUncompressedSize} bytes exceeds limit of ${this.maxUncompressedSize} bytes.`);
      }

      const compressedData = reader.readFixedBytes(compressedSize);
      let decompressedData: Uint8Array;

      if (compressionMethod === 0) {
        decompressedData = compressedData;
      } else if (compressionMethod === 8) {
        try {
          decompressedData = zlib.inflateRawSync(compressedData);
        } catch (e: any) {
          throw new ZipBombError(`Failed to decompress entry ${filename}: ${e.message}`, "DECOMPRESSION_FAILED");
        }
      } else {
        throw new ZipBombError(`Unsupported compression method ${compressionMethod} in zip.`);
      }

      files.push({
        filename,
        data: decompressedData
      });
    }

    return files;
  }
}
