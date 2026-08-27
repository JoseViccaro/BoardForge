import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { FastifyInstance } from "fastify";
import { createFastifyApp } from "../../../src/interfaces/http/app.js";
import { registerV1Routes } from "../../../src/interfaces/http/routes/v1/index.js";
import { TokenManager } from "../../../src/modules/identity-access/domain/services/TokenManager.js";
import { UserRole } from "../../../src/modules/identity-access/domain/value-objects/UserRole.js";
import { CatalogFacade } from "../../../src/application/catalog/CatalogFacade.js";
import { BoardViewFacade } from "../../../src/application/boardview/BoardViewFacade.js";
import { InMemoryCompositeBoardRepository } from "../../../src/infrastructure/persistence/in-memory/InMemoryCompositeBoardRepository.js";
import { InMemoryNetTopologyRepository } from "../../../src/infrastructure/persistence/in-memory/InMemoryNetTopologyRepository.js";
import { BoardViewParserFactory } from "../../../src/infrastructure/boardview/parsers/BoardViewParserFactory.js";
import { BoardViewToCanonicalTransformer } from "../../../src/domain/boardview/services/BoardViewToCanonicalTransformer.js";

describe("RBAC Privilege Escalation & Access Control Suite", () => {
  let app: FastifyInstance;
  let tokenManager: TokenManager;
  let viewerToken: string;
  let techToken: string;
  let leadToken: string;
  let adminToken: string;

  beforeEach(async () => {
    const boardRepo = new InMemoryCompositeBoardRepository();
    const topologyRepo = new InMemoryNetTopologyRepository();
    const parserFactory = new BoardViewParserFactory();
    const transformer = new BoardViewToCanonicalTransformer();

    const catalogFacade = new CatalogFacade(boardRepo);
    const boardViewFacade = new BoardViewFacade(boardRepo, topologyRepo, parserFactory, transformer);

    tokenManager = new TokenManager({
      jwtSecret: "test-secret-key-at-least-32-characters!",
    });

    const vPair = await tokenManager.generateTokenPair({
      id: "usr_v",
      organizationId: "ORG_TEST",
      role: UserRole.Viewer,
    });
    viewerToken = vPair.accessToken;

    const tPair = await tokenManager.generateTokenPair({
      id: "usr_t",
      organizationId: "ORG_TEST",
      role: UserRole.Tech,
    });
    techToken = tPair.accessToken;

    const lPair = await tokenManager.generateTokenPair({
      id: "usr_l",
      organizationId: "ORG_TEST",
      role: UserRole.LeadTech,
    });
    leadToken = lPair.accessToken;

    const aPair = await tokenManager.generateTokenPair({
      id: "usr_a",
      organizationId: "ORG_TEST",
      role: UserRole.Admin,
    });
    adminToken = aPair.accessToken;

    app = await createFastifyApp({
      tokenManager,
      enableRateLimiting: false,
      routesRegister: async (instance) => {
        await registerV1Routes(instance, {
          identityAccessFacade: {} as any,
          catalogFacade,
          boardViewFacade,
        });
      },
    });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it("Viewer attempting POST /api/v1/boardview/upload is rejected with 403 Forbidden", async () => {
    const boundary = "----WebKitFormBoundary7MA4YWxkTrZu0gW";
    const bdvContent = "[format]\nformat=bdv\n";
    const payload =
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="file"; filename="test.bdv"\r\n` +
      `Content-Type: text/plain\r\n\r\n` +
      `${bdvContent}\r\n` +
      `--${boundary}--\r\n`;

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/boardview/upload",
      headers: {
        "content-type": `multipart/form-data; boundary=${boundary}`,
        authorization: `Bearer ${viewerToken}`,
      },
      payload,
    });

    expect(res.statusCode).toBe(403);
    const body = JSON.parse(res.payload);
    expect(body.type).toBe("https://boardforge.io/errors/forbidden");
  });

  it("Tech attempting POST /api/v1/catalog/devices is rejected with 403 Forbidden", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/catalog/devices",
      headers: {
        authorization: `Bearer ${techToken}`,
      },
      payload: {
        id: "DEV_ATTEMPT",
        name: "Unauthorized Device",
        boardNumber: "820-00000",
        boardId: "BRD_00000",
      },
    });

    expect(res.statusCode).toBe(403);
  });

  it("LeadTech and Admin are authorized for write and upload routes (201 Created)", async () => {
    // LeadTech creating device
    const resLead = await app.inject({
      method: "POST",
      url: "/api/v1/catalog/devices",
      headers: {
        authorization: `Bearer ${leadToken}`,
      },
      payload: {
        id: "DEV_LEAD",
        name: "Lead Device",
        boardNumber: "820-11111",
        boardId: "BRD_11111",
      },
    });
    expect(resLead.statusCode).toBe(201);

    // Admin creating device
    const resAdmin = await app.inject({
      method: "POST",
      url: "/api/v1/catalog/devices",
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
      payload: {
        id: "DEV_ADMIN",
        name: "Admin Device",
        boardNumber: "820-22222",
        boardId: "BRD_22222",
      },
    });
    expect(resAdmin.statusCode).toBe(201);
  });
});
