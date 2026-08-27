import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { FastifyInstance } from "fastify";
import { createFastifyApp } from "../../../src/interfaces/http/app.js";
import { registerV1Routes } from "../../../src/interfaces/http/routes/v1/index.js";
import { TokenManager } from "../../../src/modules/identity-access/domain/services/TokenManager.js";
import { UserRole } from "../../../src/modules/identity-access/domain/value-objects/UserRole.js";
import { MeasurementsFacade } from "../../../src/application/measurements/MeasurementsFacade.js";
import { InMemoryMeasurementRepository } from "../../../src/infrastructure/persistence/in-memory/InMemoryMeasurementRepository.js";
import { createIPhone13LogicBoardFixture } from "../../../src/infrastructure/seeds/iPhone13_820_02106_Seed.js";
import { DiagnosticBoardState } from "../../../src/domain/measurements/value-objects/DiagnosticBoardState.js";

describe("Diode Mode Measurements Controller (/api/v1/measurements)", () => {
  let app: FastifyInstance;
  let tokenManager: TokenManager;
  let measurementRepo: InMemoryMeasurementRepository;
  let measurementsFacade: MeasurementsFacade;
  let techToken: string;
  let leadToken: string;
  let viewerToken: string;

  beforeEach(async () => {
    measurementRepo = new InMemoryMeasurementRepository();
    const fixture = createIPhone13LogicBoardFixture();
    await measurementRepo.save(fixture.measurementProfile);

    measurementsFacade = new MeasurementsFacade(measurementRepo);

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
          measurementsFacade,
        });
      },
    });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it("GET /api/v1/measurements/references should return golden reference diode values", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/measurements/references?board_id=BRD_820_02106&pad_id=INT_PAD_084&state=SPLIT_TOP",
      headers: {
        authorization: `Bearer ${techToken}`,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.references.length).toBeGreaterThan(0);
    expect(body.references[0].nominal).toBe(0.425);
  });

  it("POST /api/v1/measurements/records should evaluate reading and return evaluation outcome", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/measurements/records",
      headers: {
        authorization: `Bearer ${techToken}`,
      },
      payload: {
        board_id: "BRD_820_02106",
        pad_id: "INT_PAD_084",
        board_state: DiagnosticBoardState.SPLIT_TOP,
        reading_volts: 0.420,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.isPass).toBe(true);
    expect(body.outcome).toBe("PASS");
    expect(body.measuredVolts).toBe(0.420);
  });

  it("POST /api/v1/measurements/references should allow LeadTech to create reference reading", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/measurements/references",
      headers: {
        authorization: `Bearer ${leadToken}`,
      },
      payload: {
        board_id: "BRD_820_02106",
        pad_id: "INT_PAD_999",
        net_name: "PP_TEST_RAIL",
        board_state: DiagnosticBoardState.SPLIT_TOP,
        nominal: 0.500,
        min: 0.450,
        max: 0.550,
        tolerance_pct: 10.0,
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.payload);
    expect(body.padId).toBe("INT_PAD_999");
  });

  it("POST /api/v1/measurements/records should reject Viewer role with 403 Forbidden", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/measurements/records",
      headers: {
        authorization: `Bearer ${viewerToken}`,
      },
      payload: {
        board_id: "BRD_820_02106",
        pad_id: "INT_PAD_084",
        board_state: DiagnosticBoardState.SPLIT_TOP,
        reading_volts: 0.420,
      },
    });

    expect(res.statusCode).toBe(403);
    const body = JSON.parse(res.payload);
    expect(body.type).toBe("https://boardforge.io/errors/forbidden");
  });
});
