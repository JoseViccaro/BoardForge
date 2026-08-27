import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { FastifyInstance } from "fastify";
import { createFastifyApp } from "../../../src/interfaces/http/app.js";

describe("Security Headers & CORS Plugins", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = await createFastifyApp({
      corsOrigins: ["https://app.boardforge.io", "http://localhost:3000"],
      enableRateLimiting: false,
    });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it("should configure OWASP ASVS L2 security headers via helmet", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/health",
    });

    expect(response.statusCode).toBe(200);
    const headers = response.headers;

    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["x-frame-options"]).toMatch(/DENY|SAMEORIGIN/i);
    expect(headers["strict-transport-security"]).toBeDefined();
    expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(headers["content-security-policy"]).toBeDefined();
  });

  it("should allow configured CORS origins and reject unauthorized origins", async () => {
    // 1. Allowed origin
    const resAllowed = await app.inject({
      method: "GET",
      url: "/health",
      headers: {
        origin: "https://app.boardforge.io",
      },
    });
    expect(resAllowed.headers["access-control-allow-origin"]).toBe("https://app.boardforge.io");
    expect(resAllowed.headers["access-control-allow-credentials"]).toBe("true");

    // 2. Disallowed origin
    const resDisallowed = await app.inject({
      method: "GET",
      url: "/health",
      headers: {
        origin: "https://evil-attacker.com",
      },
    });
    expect(resDisallowed.headers["access-control-allow-origin"]).toBeUndefined();
  });
});
