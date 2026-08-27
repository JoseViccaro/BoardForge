import { describe, it, expect } from "vitest";
import { SafeBinaryReader, PrematureEndOfStreamError, PayloadTooLargeError } from "../../../../src/infrastructure/boardview/io/SafeBinaryReader.js";

describe("SafeBinaryReader", () => {
  it("should reject buffers larger than 128 MB (134217728 bytes) with PayloadTooLargeError", () => {
    const hugeBuffer = { byteLength: 128 * 1024 * 1024 + 1 } as unknown as Uint8Array;
    expect(() => new SafeBinaryReader(hugeBuffer)).toThrow(PayloadTooLargeError);
  });

  it("should read primitive values correctly in Little Endian and Big Endian", () => {
    const buffer = new Uint8Array([
      0x01, 0x02, 0x03, 0x04, // int32 LE = 0x04030201 = 67305985
      0x00, 0x00, 0x80, 0x3f, // float32 LE = 1.0
      0x12, 0x34              // uint16 BE = 0x1234 = 4660
    ]);
    const reader = new SafeBinaryReader(buffer);
    expect(reader.readInt32LE()).toBe(67305985);
    expect(reader.readFloat32LE()).toBeCloseTo(1.0);
    expect(reader.readUInt16BE()).toBe(0x1234);
    expect(reader.isEOF()).toBe(true);
  });

  it("should throw PrematureEndOfStreamError when reading beyond EOF", () => {
    const buffer = new Uint8Array([0x01, 0x02]);
    const reader = new SafeBinaryReader(buffer);
    expect(() => reader.readInt32LE()).toThrow(PrematureEndOfStreamError);
  });

  it("should read fixed string and null-terminated string safely", () => {
    const text = "Hello\0World";
    const bytes = new TextEncoder().encode(text);
    const reader = new SafeBinaryReader(bytes);

    const str = reader.readNullTerminatedString();
    expect(str).toBe("Hello");
    expect(reader.getOffset()).toBe(6);
  });

  it("should enforce max limit of 2048 chars for readNullTerminatedString if not terminated", () => {
    const longBytes = new Uint8Array(3000);
    longBytes.fill(65); // 'A'
    const reader = new SafeBinaryReader(longBytes);

    expect(() => reader.readNullTerminatedString(2048)).toThrow(PrematureEndOfStreamError);
  });

  it("should throw PrematureEndOfStreamError with offset context when readFixedBytes exceeds buffer", () => {
    const buffer = new Uint8Array([1, 2, 3]);
    const reader = new SafeBinaryReader(buffer);
    reader.seek(2);
    try {
      reader.readFixedBytes(10);
      expect.fail("Should have thrown");
    } catch (err: any) {
      expect(err).toBeInstanceOf(PrematureEndOfStreamError);
      expect(err.currentOffset).toBe(2);
      expect(err.requestedLength).toBe(10);
    }
  });
});
