import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { FastifyInstance } from "fastify";
import { createFastifyApp } from "../../../src/interfaces/http/app.js";
import { registerV1Routes } from "../../../src/interfaces/http/routes/v1/index.js";
import { TokenManager } from "../../../src/modules/identity-access/domain/services/TokenManager.js";
import { UserRole } from "../../../src/modules/identity-access/domain/value-objects/UserRole.js";
import { CatalogFacade } from "../../../src/application/catalog/CatalogFacade.js";
import { InMemoryCompositeBoardRepository } from "../../../src/infrastructure/persistence/in-memory/InMemoryCompositeBoardRepository.js";
import { createIPhone13LogicBoardFixture } from "../../../src/infrastructure/seeds/iPhone13_820_02106_Seed.js";

describe("Hardware Catalog Controller (/api/v1/catalog)", () => {
  let app: FastifyInstance;
  let tokenManager: TokenManager;
  let boardRepo: InMemoryCompositeBoardRepository;
  let catalogFacade: CatalogFacade;
  let techToken: string;
  let leadToken: string;

  beforeEach(async () => {
    boardRepo = new InMemoryCompositeBoardRepository();
    const fixture = createIPhone13LogicBoardFixture();
    await boardRepo.save(fixture.compositeBoard);

    catalogFacade = new CatalogFacade(boardRepo);
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
          catalogFacade,
        });
      },
    });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it("GET /api/v1/catalog/devices should list devices", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/catalog/devices",
      headers: {
        authorization: `Bearer ${techToken}`,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(Array.isArray(body.items)).toBe(true);
    expect(body.items.length).toBeGreaterThan(0);
    expect(body.items[0].name).toBe("iPhone 13");
  });

  it("GET /api/v1/catalog/devices/:id should return single device", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/catalog/devices/DEV_IPHONE13",
      headers: {
        authorization: `Bearer ${techToken}`,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.id).toBe("DEV_IPHONE13");
    expect(body.name).toBe("iPhone 13");
  });

  it("POST /api/v1/catalog/devices should allow LeadTech to create custom device", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/catalog/devices",
      headers: {
        authorization: `Bearer ${leadToken}`,
      },
      payload: {
        id: "DEV_IPHONE14",
        name: "iPhone 14 Pro",
        boardNumber: "820-02888",
        boardId: "BRD_820_02888",
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.payload);
    expect(body.id).toBe("DEV_IPHONE14");
    expect(body.name).toBe("iPhone 14 Pro");
  });

  it("POST /api/v1/catalog/devices should reject Tech role with 403 Forbidden", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/catalog/devices",
      headers: {
        authorization: `Bearer ${techToken}`,
      },
      payload: {
        id: "DEV_CUSTOM",
        name: "Custom Device",
        boardNumber: "820-99999",
        boardId: "BRD_99999",
      },
    });

    expect(res.statusCode).toBe(403);
    const body = JSON.parse(res.payload);
    expect(body.type).toBe("https://boardforge.io/errors/forbidden");
  });

  it("GET /api/v1/catalog/boards/:id should return composite board aggregate details", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/catalog/boards/BRD_820_02106",
      headers: {
        authorization: `Bearer ${techToken}`,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.id).toBe("BRD_820_02106");
    expect(body.boardNumber).toBe("820-02106");
    expect(body.subBoards.length).toBe(3);
  });
});
