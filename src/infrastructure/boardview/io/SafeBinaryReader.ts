export class PrematureEndOfStreamError extends Error {
  constructor(public readonly currentOffset: number, public readonly requestedLength: number, totalLength: number) {
    super(`Premature end of stream: requested ${requestedLength} bytes at offset ${currentOffset}, but total buffer length is ${totalLength}`);
    this.name = "PrematureEndOfStreamError";
  }
}

export class PayloadTooLargeError extends Error {
  constructor(public readonly actualBytes: number, public readonly maxAllowedBytes: number) {
    super(`Payload size of ${actualBytes} bytes exceeds maximum allowed limit of ${maxAllowedBytes} bytes.`);
    this.name = "PayloadTooLargeError";
  }
}

export class SafeBinaryReader {
  public static readonly MAX_BUFFER_SIZE = 128 * 1024 * 1024; // 128 MB
  public static readonly MAX_STRING_LENGTH = 2048;

  private readonly buffer: Uint8Array;
  private readonly dataView: DataView;
  private offset: number = 0;

  constructor(buffer: Uint8Array, maxAllowedSize: number = SafeBinaryReader.MAX_BUFFER_SIZE) {
    if (buffer.byteLength > maxAllowedSize) {
      throw new PayloadTooLargeError(buffer.byteLength, maxAllowedSize);
    }
    this.buffer = buffer;
    this.dataView = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  }

  public getOffset(): number {
    return this.offset;
  }

  public getLength(): number {
    return this.buffer.byteLength;
  }

  public isEOF(): boolean {
    return this.offset >= this.buffer.byteLength;
  }

  public seek(position: number): void {
    if (position < 0 || position > this.buffer.byteLength) {
      throw new PrematureEndOfStreamError(this.offset, position - this.offset, this.buffer.byteLength);
    }
    this.offset = position;
  }

  public skip(bytes: number): void {
    this.seek(this.offset + bytes);
  }

  private ensureAvailable(bytes: number): void {
    if (this.offset + bytes > this.buffer.byteLength) {
      throw new PrematureEndOfStreamError(this.offset, bytes, this.buffer.byteLength);
    }
  }

  public readUInt8(): number {
    this.ensureAvailable(1);
    const val = this.dataView.getUint8(this.offset);
    this.offset += 1;
    return val;
  }

  public readInt8(): number {
    this.ensureAvailable(1);
    const val = this.dataView.getInt8(this.offset);
    this.offset += 1;
    return val;
  }

  public readUInt16LE(): number {
    this.ensureAvailable(2);
    const val = this.dataView.getUint16(this.offset, true);
    this.offset += 2;
    return val;
  }

  public readUInt16BE(): number {
    this.ensureAvailable(2);
    const val = this.dataView.getUint16(this.offset, false);
    this.offset += 2;
    return val;
  }

  public readInt16LE(): number {
    this.ensureAvailable(2);
    const val = this.dataView.getInt16(this.offset, true);
    this.offset += 2;
    return val;
  }

  public readInt16BE(): number {
    this.ensureAvailable(2);
    const val = this.dataView.getInt16(this.offset, false);
    this.offset += 2;
    return val;
  }

  public readUInt32LE(): number {
    this.ensureAvailable(4);
    const val = this.dataView.getUint32(this.offset, true);
    this.offset += 4;
    return val;
  }

  public readUInt32BE(): number {
    this.ensureAvailable(4);
    const val = this.dataView.getUint32(this.offset, false);
    this.offset += 4;
    return val;
  }

  public readInt32LE(): number {
    this.ensureAvailable(4);
    const val = this.dataView.getInt32(this.offset, true);
    this.offset += 4;
    return val;
  }

  public readInt32BE(): number {
    this.ensureAvailable(4);
    const val = this.dataView.getInt32(this.offset, false);
    this.offset += 4;
    return val;
  }

  public readFloat32LE(): number {
    this.ensureAvailable(4);
    const val = this.dataView.getFloat32(this.offset, true);
    this.offset += 4;
    return val;
  }

  public readFloat64LE(): number {
    this.ensureAvailable(8);
    const val = this.dataView.getFloat64(this.offset, true);
    this.offset += 8;
    return val;
  }

  public readFixedBytes(length: number): Uint8Array {
    this.ensureAvailable(length);
    const slice = this.buffer.subarray(this.offset, this.offset + length);
    this.offset += length;
    return slice;
  }

  public readFixedString(length: number, encoding: string = "utf-8"): string {
    const bytes = this.readFixedBytes(length);
    return new TextDecoder(encoding).decode(bytes);
  }

  public readNullTerminatedString(maxLen: number = SafeBinaryReader.MAX_STRING_LENGTH): string {
    let len = 0;
    while (this.offset + len < this.buffer.byteLength && len < maxLen) {
      if (this.buffer[this.offset + len] === 0) {
        break;
      }
      len++;
    }

    if (this.offset + len >= this.buffer.byteLength || len >= maxLen) {
      if (this.offset + len >= this.buffer.byteLength && (this.offset + len === this.buffer.byteLength && this.buffer[this.offset + len - 1] === 0)) {
        // ended at exactly null at end
      } else {
        throw new PrematureEndOfStreamError(this.offset, maxLen, this.buffer.byteLength);
      }
    }

    const strBytes = this.buffer.subarray(this.offset, this.offset + len);
    this.offset += len + 1; // skip null byte
    return new TextDecoder("utf-8").decode(strBytes);
  }
}
