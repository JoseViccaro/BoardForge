import { FastifyRequest } from "fastify";
import { MagicBytesValidator } from "./magic-bytes-validator.js";
import {
  UnsupportedMediaTypeError,
  PayloadTooLargeError,
  DomainValidationError,
} from "../errors/HttpErrors.js";

export interface MultipartUploadOptions {
  expectedType?: "pdf" | "boardview";
  maxSizeBytes?: number;
}

export interface ParsedMultipartFile {
  filename: string;
  mimetype: string;
  buffer: Buffer;
  detectedType: string;
  fields: Record<string, any>;
}

export async function parseMultipartUpload(
  req: FastifyRequest,
  options: MultipartUploadOptions = {}
): Promise<ParsedMultipartFile> {
  const isMultipart = (req as any).isMultipart ? (req as any).isMultipart() : false;
  if (!isMultipart && !(req.headers["content-type"] || "").includes("multipart/form-data")) {
    throw new UnsupportedMediaTypeError("Expected multipart/form-data content type.");
  }

  const data = await (req as any).file();
  if (!data) {
    throw new DomainValidationError("No file was uploaded in the multipart request.");
  }

  const maxBytes = options.maxSizeBytes ?? 100 * 1024 * 1024;
  const chunks: Buffer[] = [];
  let totalBytes = 0;

  for await (const chunk of data.file) {
    totalBytes += chunk.length;
    if (totalBytes > maxBytes) {
      // Drain remaining stream
      data.file.resume();
      throw new PayloadTooLargeError(
        `File size exceeds maximum allowable limit of ${Math.round(maxBytes / (1024 * 1024))}MB.`
      );
    }
    chunks.push(chunk);
  }

  const buffer = Buffer.concat(chunks);
  const inspection = MagicBytesValidator.inspectBuffer(buffer);

  if (!inspection.isValid) {
    throw new UnsupportedMediaTypeError(
      inspection.reason || "Uploaded file has an invalid or disallowed MIME signature."
    );
  }

  if (options.expectedType && inspection.detectedType !== options.expectedType) {
    throw new UnsupportedMediaTypeError(
      `Invalid file format: expected ${options.expectedType}, detected ${inspection.detectedType}.`
    );
  }

  const fields: Record<string, any> = {};
  if (data.fields) {
    for (const [key, field] of Object.entries(data.fields)) {
      fields[key] = (field as any)?.value;
    }
  }

  return {
    filename: data.filename || "upload.bin",
    mimetype: data.mimetype,
    buffer,
    detectedType: inspection.detectedType || "unknown",
    fields,
  };
}
