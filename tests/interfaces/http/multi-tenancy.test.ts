import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { FastifyInstance } from "fastify";
import { createFastifyApp } from "../../../src/interfaces/http/app.js";
import { registerV1Routes } from "../../../src/interfaces/http/routes/v1/index.js";
import { TokenManager } from "../../../src/modules/identity-access/domain/services/TokenManager.js";
import { UserRole } from "../../../src/modules/identity-access/domain/value-objects/UserRole.js";
import { CatalogFacade } from "../../../src/application/catalog/CatalogFacade.js";
import { InMemoryCompositeBoardRepository } from "../../../src/infrastructure/persistence/in-memory/InMemoryCompositeBoardRepository.js";

describe("Tenant Isolation & IDOR Verification Suite", () => {
  let app: FastifyInstance;
  let tokenManager: TokenManager;
  let catalogFacade: CatalogFacade;
  let tokenOrgA: string;
  let tokenOrgB: string;

  beforeEach(async () => {
    const boardRepo = new InMemoryCompositeBoardRepository();
    catalogFacade = new CatalogFacade(boardRepo);

    // Create device in ORG_A
    await catalogFacade.createDevice(
      {
        id: "DEV_SECRET_A",
        name: "Secret Prototype A",
        boardNumber: "820-09991",
        boardId: "BRD_SECRET_A",
      },
      "ORG_A"
    );

    // Create device in ORG_B
    await catalogFacade.createDevice(
      {
        id: "DEV_SECRET_B",
        name: "Secret Prototype B",
        boardNumber: "820-09992",
        boardId: "BRD_SECRET_B",
      },
      "ORG_B"
    );

    tokenManager = new TokenManager({
      jwtSecret: "test-secret-key-at-least-32-characters!",
    });

    const userA = await tokenManager.generateTokenPair({
      id: "usr_a",
      organizationId: "ORG_A",
      role: UserRole.Tech,
    });
    tokenOrgA = userA.accessToken;

    const userB = await tokenManager.generateTokenPair({
      id: "usr_b",
      organizationId: "ORG_B",
      role: UserRole.Tech,
    });
    tokenOrgB = userB.accessToken;

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

  it("User in ORG_A should be able to view ORG_A resources", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/catalog/devices/DEV_SECRET_A",
      headers: {
        authorization: `Bearer ${tokenOrgA}`,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.id).toBe("DEV_SECRET_A");
  });

  it("User in ORG_A attempting to access resource owned by ORG_B receives 404 (anti-IDOR)", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/catalog/devices/DEV_SECRET_B",
      headers: {
        authorization: `Bearer ${tokenOrgA}`,
      },
    });

    expect(res.statusCode).toBe(404);
    const body = JSON.parse(res.payload);
    expect(body.type).toBe("https://boardforge.io/errors/not-found");
  });

  it("List query scoped to tenant only returns current tenant items and global items", async () => {
    const resA = await app.inject({
      method: "GET",
      url: "/api/v1/catalog/devices",
      headers: {
        authorization: `Bearer ${tokenOrgA}`,
      },
    });

    expect(resA.statusCode).toBe(200);
    const bodyA = JSON.parse(resA.payload);
    const idsA = bodyA.items.map((i: any) => i.id);
    expect(idsA).toContain("DEV_SECRET_A");
    expect(idsA).not.toContain("DEV_SECRET_B");
  });
});
