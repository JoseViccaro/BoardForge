import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { FastifyInstance } from "fastify";
import { createFastifyApp } from "../../../src/interfaces/http/app.js";
import { registerV1Routes } from "../../../src/interfaces/http/routes/v1/index.js";
import { TokenManager } from "../../../src/modules/identity-access/domain/services/TokenManager.js";
import { UserRole } from "../../../src/modules/identity-access/domain/value-objects/UserRole.js";
import { SchematicsFacade } from "../../../src/application/schematics/SchematicsFacade.js";
import { iPhone13SchematicFixtures } from "../../../src/infrastructure/seeds/iPhone13SchematicFixtures.js";

describe("Schematics Cross-Probing Controller (/api/v1/schematics)", () => {
  let app: FastifyInstance;
  let tokenManager: TokenManager;
  let schematicsFacade: SchematicsFacade;
  let techToken: string;
  let leadToken: string;

  beforeEach(async () => {
    const fixture = iPhone13SchematicFixtures.createFixtures();
    schematicsFacade = new SchematicsFacade();
    schematicsFacade.saveDocument(fixture.document);

    tokenManager = new TokenManager({
      jwtSecret: "test-secret-key-at-least-32-characters!",
    });

    const techPair = await tokenManager.generateTokenPair({
      id: "usr_tech",
      organizationId: "org_1",
      role: UserRole.Tech,
    });
    techToken = techPair.accessToken;

    const leadPair = await tokenManager.generateTokenPair({
      id: "usr_lead",
      organizationId: "org_1",
      role: UserRole.LeadTech,
    });
    leadToken = leadPair.accessToken;

    app = await createFastifyApp({
      tokenManager,
      enableRateLimiting: false,
      routesRegister: async (instance) => {
        await registerV1Routes(instance, {
          identityAccessFacade: {} as any,
          schematicsFacade,
        });
      },
    });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it("GET /api/v1/schematics/:schematic_id/search?query=PP_VDD_MAIN should return matching symbols and bounding boxes", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/schematics/DOC_IPHONE13_820_02106/search?query=PP_VDD_MAIN",
      headers: {
        authorization: `Bearer ${techToken}`,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.matches.length).toBeGreaterThan(0);
    expect(body.matches[0].pageNumber).toBe(12);
  });

  it("GET /api/v1/schematics/:schematic_id/pages/:page_number should return vector metadata for page", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/schematics/DOC_IPHONE13_820_02106/pages/12",
      headers: {
        authorization: `Bearer ${techToken}`,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.pageNumber).toBe(12);
    expect(body.symbols.length).toBeGreaterThan(0);
  });

  it("POST /api/v1/schematics/upload should allow LeadTech to upload PDF schematics", async () => {
    const boundary = "----WebKitFormBoundary7MA4YWxkTrZu0gW";
    const pdfContent = "%PDF-1.7\nSample schematic data stream";
    const payload =
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="file"; filename="iphone13.pdf"\r\n` +
      `Content-Type: application/pdf\r\n\r\n` +
      `${pdfContent}\r\n` +
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="schematic_id"\r\n\r\n` +
      `DOC_IPHONE13_NEW\r\n` +
      `--${boundary}--\r\n`;

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/schematics/upload",
      headers: {
        "content-type": `multipart/form-data; boundary=${boundary}`,
        authorization: `Bearer ${leadToken}`,
      },
      payload,
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.payload);
    expect(body.schematicId).toBe("DOC_IPHONE13_NEW");
  });
});
