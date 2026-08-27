import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { FastifyInstance } from "fastify";
import { createFastifyApp } from "../../../src/interfaces/http/app.js";

describe("Rate Limiting Plugin", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = await createFastifyApp({
      enableRateLimiting: true,
      authMaxRequests: 5,
      authTimeWindowSeconds: 60,
      standardMaxRequests: 120,
    });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it("should rate limit auth endpoints after 5 requests with HTTP 429 and Retry-After header", async () => {
    // Make 5 requests
    for (let i = 0; i < 5; i++) {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/auth/login",
        payload: {
          email: "test@example.com",
          password: "Password12345!",
        },
      });
      expect(res.statusCode).not.toBe(429);
    }

    // 6th request must be 429 Too Many Requests
    const limitedRes = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: {
        email: "test@example.com",
        password: "Password12345!",
      },
    });

    expect(limitedRes.statusCode).toBe(429);
    expect(limitedRes.headers["retry-after"]).toBeDefined();
    const body = JSON.parse(limitedRes.payload);
    expect(body.type).toBe("https://boardforge.io/errors/rate-limit");
  });
});
