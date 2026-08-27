import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { FastifyInstance } from "fastify";
import { createFastifyApp } from "../../../src/interfaces/http/app.js";
import { registerV1Routes } from "../../../src/interfaces/http/routes/v1/index.js";
import { TokenManager } from "../../../src/modules/identity-access/domain/services/TokenManager.js";
import { UserRole } from "../../../src/modules/identity-access/domain/value-objects/UserRole.js";
import { MeasurementsFacade } from "../../../src/application/measurements/MeasurementsFacade.js";
import { InMemoryMeasurementRepository } from "../../../src/infrastructure/persistence/in-memory/InMemoryMeasurementRepository.js";
import { createIPhone13LogicBoardFixture } from "../../../src/infrastructure/seeds/iPhone13_820_02106_Seed.js";

describe("Prototype Pollution & Malicious Payload Suite", () => {
  let app: FastifyInstance;
  let tokenManager: TokenManager;
  let measurementsFacade: MeasurementsFacade;
  let techToken: string;

  beforeEach(async () => {
    const measurementRepo = new InMemoryMeasurementRepository();
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

  it("should reject payloads with unrecognized/injected fields with HTTP 400 without polluting Object.prototype", async () => {
    const maliciousPayload = JSON.parse(`{
      "board_id": "BRD_820_02106",
      "pad_id": "INT_PAD_084",
      "board_state": "SPLIT_TOP",
      "reading_volts": 0.420,
      "__proto__": { "polluted": "yes" },
      "constructor": { "prototype": { "admin": true } }
    }`);

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/measurements/records",
      headers: {
        authorization: `Bearer ${techToken}`,
      },
      payload: maliciousPayload,
    });

    // Zod strict schema rejects unrecognized keys with 400 Bad Request
    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.payload);
    expect(body.type).toBe("https://boardforge.io/errors/validation");

    // Assert global Object prototype is NOT polluted
    expect((({} as any).polluted)).toBeUndefined();
    expect((({} as any).admin)).toBeUndefined();
  });
});
