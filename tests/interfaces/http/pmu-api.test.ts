import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { FastifyInstance } from "fastify";
import { createFastifyApp } from "../../../src/interfaces/http/app.js";
import { registerV1Routes } from "../../../src/interfaces/http/routes/v1/index.js";
import { TokenManager } from "../../../src/modules/identity-access/domain/services/TokenManager.js";
import { UserRole } from "../../../src/modules/identity-access/domain/value-objects/UserRole.js";
import { PmuSimulationFacade } from "../../../src/application/schematics/PmuSimulationFacade.js";
import { createIPhone13LogicBoardFixture } from "../../../src/infrastructure/seeds/iPhone13_820_02106_Seed.js";

describe("PMU Power Sequence Controller (/api/v1/pmu)", () => {
  let app: FastifyInstance;
  let tokenManager: TokenManager;
  let pmuFacade: PmuSimulationFacade;
  let techToken: string;
  let viewerToken: string;

  beforeEach(async () => {
    const fixture = createIPhone13LogicBoardFixture();
    pmuFacade = new PmuSimulationFacade();
    pmuFacade.registerPowerTree("BRD_820_02106", fixture.powerTree);

    tokenManager = new TokenManager({
      jwtSecret: "test-secret-key-at-least-32-characters!",
    });

    const techPair = await tokenManager.generateTokenPair({
      id: "usr_tech",
      organizationId: "org_1",
      role: UserRole.Tech,
    });
    techToken = techPair.accessToken;

    const viewerPair = await tokenManager.generateTokenPair({
      id: "usr_viewer",
      organizationId: "org_1",
      role: UserRole.Viewer,
    });
    viewerToken = viewerPair.accessToken;

    app = await createFastifyApp({
      tokenManager,
      enableRateLimiting: false,
      routesRegister: async (instance) => {
        await registerV1Routes(instance, {
          identityAccessFacade: {} as any,
          pmuFacade,
        });
      },
    });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it("GET /api/v1/pmu/sequence?board_id=BRD_820_02106&trigger=VBUS should simulate power sequence", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/pmu/sequence?board_id=BRD_820_02106&trigger=VBUS",
      headers: {
        authorization: `Bearer ${techToken}`,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.boardId).toBe("BRD_820_02106");
    expect(body.trigger).toBe("VBUS");
    expect(body.stages.length).toBeGreaterThan(0);
  });

  it("GET /api/v1/pmu/sequence should reject unauthenticated requests with 401", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/pmu/sequence?board_id=BRD_820_02106&trigger=VBUS",
    });

    expect(res.statusCode).toBe(401);
  });
});
