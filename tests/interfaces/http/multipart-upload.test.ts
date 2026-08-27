import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { FastifyInstance } from "fastify";
import { createFastifyApp } from "../../../src/interfaces/http/app.js";
import { UserRole } from "../../../src/modules/identity-access/domain/value-objects/UserRole.js";
import { TokenManager } from "../../../src/modules/identity-access/domain/services/TokenManager.js";
import { parseMultipartUpload } from "../../../src/interfaces/http/middlewares/multipart-handler.js";

describe("Fastify Multipart Ingestion & Stream Limiter", () => {
  let app: FastifyInstance;
  let tokenManager: TokenManager;
  let leadToken: string;

  beforeEach(async () => {
    tokenManager = new TokenManager({
      jwtSecret: "test-secret-key-at-least-32-characters!",
    });
    const pair = await tokenManager.generateTokenPair({
      id: "usr_lead_1",
      organizationId: "org_1",
      role: UserRole.LeadTech,
    });
    leadToken = pair.accessToken;

    app = await createFastifyApp({
      tokenManager,
      enableRateLimiting: false,
    });

    app.post(
      "/api/v1/test/upload-pdf",
      {
        preHandler: [app.authenticate],
      },
      async (req, reply) => {
        const file = await parseMultipartUpload(req, {
          expectedType: "pdf",
          maxSizeBytes: 100 * 1024 * 1024, // 100 MB
        });
        return reply.status(201).send({
          filename: file.filename,
          size: file.buffer.length,
          detectedType: file.detectedType,
        });
      }
    );

    app.post(
      "/api/v1/test/upload-brd",
      {
        preHandler: [app.authenticate],
      },
      async (req, reply) => {
        const file = await parseMultipartUpload(req, {
          expectedType: "boardview",
          maxSizeBytes: 50 * 1024 * 1024, // 50 MB
        });
        return reply.status(201).send({
          filename: file.filename,
          size: file.buffer.length,
          detectedType: file.detectedType,
        });
      }
    );

    app.post(
      "/api/v1/test/upload-tiny",
      {
        preHandler: [app.authenticate],
      },
      async (req, reply) => {
        const file = await parseMultipartUpload(req, {
          expectedType: "boardview",
          maxSizeBytes: 100, // 100 bytes limit
        });
        return reply.status(201).send({ size: file.buffer.length });
      }
    );

    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it("should successfully ingest valid PDF stream under quota", async () => {
    const boundary = "----WebKitFormBoundary7MA4YWxkTrZu0gW";
    const pdfContent = "%PDF-1.7\nSample schematic data...";
    const payload =
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="file"; filename="schematic.pdf"\r\n` +
      `Content-Type: application/pdf\r\n\r\n` +
      `${pdfContent}\r\n` +
      `--${boundary}--\r\n`;

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/test/upload-pdf",
      headers: {
        "content-type": `multipart/form-data; boundary=${boundary}`,
        authorization: `Bearer ${leadToken}`,
      },
      payload,
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.payload);
    expect(body.filename).toBe("schematic.pdf");
    expect(body.detectedType).toBe("pdf");
  });

  it("should reject executable masquerading as BRD with HTTP 415", async () => {
    const boundary = "----WebKitFormBoundary7MA4YWxkTrZu0gW";
    const fakeExe = Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00]);
    const header =
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="file"; filename="malware.brd"\r\n` +
      `Content-Type: application/octet-stream\r\n\r\n`;
    const footer = `\r\n--${boundary}--\r\n`;

    const payload = Buffer.concat([Buffer.from(header), fakeExe, Buffer.from(footer)]);

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/test/upload-brd",
      headers: {
        "content-type": `multipart/form-data; boundary=${boundary}`,
        authorization: `Bearer ${leadToken}`,
      },
      payload,
    });

    expect(res.statusCode).toBe(415);
    const body = JSON.parse(res.payload);
    expect(body.type).toBe("https://boardforge.io/errors/unsupported-media-type");
  });

  it("should reject file exceeding size limit with HTTP 413", async () => {
    const boundary = "----WebKitFormBoundary7MA4YWxkTrZu0gW";
    const largeContent = "[format]\n" + "x".repeat(500);
    const payload =
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="file"; filename="large.brd"\r\n` +
      `Content-Type: text/plain\r\n\r\n` +
      `${largeContent}\r\n` +
      `--${boundary}--\r\n`;

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/test/upload-tiny",
      headers: {
        "content-type": `multipart/form-data; boundary=${boundary}`,
        authorization: `Bearer ${leadToken}`,
      },
      payload,
    });

    expect(res.statusCode).toBe(413);
    const body = JSON.parse(res.payload);
    expect(body.type).toBe("https://boardforge.io/errors/payload-too-large");
  });
});
