import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { FastifyInstance } from "fastify";
import { createFastifyApp } from "../../../src/interfaces/http/app.js";
import { registerV1Routes } from "../../../src/interfaces/http/routes/v1/index.js";
import { TokenManager } from "../../../src/modules/identity-access/domain/services/TokenManager.js";
import { InMemoryUserRepository } from "../../../src/modules/identity-access/infrastructure/InMemoryUserRepository.js";
import { InMemoryOrganizationRepository } from "../../../src/modules/identity-access/infrastructure/InMemoryOrganizationRepository.js";
import { InMemorySessionRepository } from "../../../src/modules/identity-access/infrastructure/InMemorySessionRepository.js";
import { IdentityAccessFacade } from "../../../src/modules/identity-access/application/IdentityAccessFacade.js";

describe("Auth & IAM Controller (/api/v1/auth)", () => {
  let app: FastifyInstance;
  let userRepo: InMemoryUserRepository;
  let orgRepo: InMemoryOrganizationRepository;
  let sessionRepo: InMemorySessionRepository;
  let tokenManager: TokenManager;
  let identityFacade: IdentityAccessFacade;

  beforeEach(async () => {
    userRepo = new InMemoryUserRepository();
    orgRepo = new InMemoryOrganizationRepository();
    sessionRepo = new InMemorySessionRepository();
    tokenManager = new TokenManager({
      jwtSecret: "test-secret-key-at-least-32-characters!",
    });
    identityFacade = new IdentityAccessFacade(userRepo, orgRepo, sessionRepo, tokenManager);

    app = await createFastifyApp({
      tokenManager,
      identityAccessFacade: identityFacade,
      enableRateLimiting: false,
      routesRegister: async (instance) => {
        await registerV1Routes(instance, {
          identityAccessFacade: identityFacade,
        });
      },
    });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it("POST /api/v1/auth/register should register organization and admin user and set HttpOnly cookies", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: {
        slug: "apple-pro-lab",
        orgName: "Apple Pro Lab",
        email: "admin@applepro.com",
        password: "SuperSecret#2026",
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.payload);
    expect(body.user.email).toBe("admin@applepro.com");
    expect(body.user.role).toBe("Admin");
    expect(body.user.passwordHash).toBeUndefined();
    expect(body.organization.slug).toBe("apple-pro-lab");

    const cookies = res.headers["set-cookie"];
    expect(cookies).toBeDefined();
    const cookieStr = Array.isArray(cookies) ? cookies.join("; ") : (cookies as string);
    expect(cookieStr).toContain("bf_access_token=");
    expect(cookieStr).toContain("bf_refresh_token=");
    expect(cookieStr.toLowerCase()).toContain("httponly");
    expect(cookieStr.toLowerCase()).toContain("samesite=strict");
  });

  it("POST /api/v1/auth/login should authenticate valid credentials and issue tokens", async () => {
    // 1. Register first
    await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: {
        slug: "apple-lab-2",
        orgName: "Apple Lab 2",
        email: "tech@applelab.com",
        password: "ValidPassword123!",
      },
    });

    // 2. Login
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: {
        email: "tech@applelab.com",
        password: "ValidPassword123!",
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.user.email).toBe("tech@applelab.com");
    expect(body.tokens.accessToken).toBeDefined();

    const cookies = res.headers["set-cookie"];
    expect(cookies).toBeDefined();
  });

  it("POST /api/v1/auth/refresh should rotate refresh token and issue new token pair", async () => {
    // Register
    const regRes = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: {
        slug: "apple-lab-3",
        orgName: "Apple Lab 3",
        email: "lead@applelab.com",
        password: "ValidPassword123!",
      },
    });
    const regBody = JSON.parse(regRes.payload);
    const initialRefreshToken = regBody.tokens.refreshToken;

    // Refresh with cookie
    const refRes = await app.inject({
      method: "POST",
      url: "/api/v1/auth/refresh",
      cookies: {
        bf_refresh_token: initialRefreshToken,
      },
    });

    expect(refRes.statusCode).toBe(200);
    const refBody = JSON.parse(refRes.payload);
    expect(refBody.tokens.accessToken).toBeDefined();
    expect(refBody.tokens.refreshToken).not.toBe(initialRefreshToken);

    // Resubmitting old token should trigger replay attack detection -> 401
    const replayRes = await app.inject({
      method: "POST",
      url: "/api/v1/auth/refresh",
      cookies: {
        bf_refresh_token: initialRefreshToken,
      },
    });
    expect(replayRes.statusCode).toBe(401);
  });

  it("GET /api/v1/auth/me should return current authenticated user profile", async () => {
    const regRes = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: {
        slug: "apple-lab-4",
        orgName: "Apple Lab 4",
        email: "me@applelab.com",
        password: "ValidPassword123!",
      },
    });
    const regBody = JSON.parse(regRes.payload);
    const accessToken = regBody.tokens.accessToken;

    const meRes = await app.inject({
      method: "GET",
      url: "/api/v1/auth/me",
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
    });

    expect(meRes.statusCode).toBe(200);
    const meBody = JSON.parse(meRes.payload);
    expect(meBody.user.email).toBe("me@applelab.com");
    expect(meBody.organization.slug).toBe("apple-lab-4");
  });

  it("POST /api/v1/auth/logout should revoke session and clear cookies", async () => {
    const regRes = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: {
        slug: "apple-lab-5",
        orgName: "Apple Lab 5",
        email: "logout@applelab.com",
        password: "ValidPassword123!",
      },
    });
    const regBody = JSON.parse(regRes.payload);
    const refreshToken = regBody.tokens.refreshToken;

    const logoutRes = await app.inject({
      method: "POST",
      url: "/api/v1/auth/logout",
      cookies: {
        bf_refresh_token: refreshToken,
      },
    });

    expect(logoutRes.statusCode).toBe(200);
    const cookies = logoutRes.headers["set-cookie"];
    expect(cookies).toBeDefined();
  });
});
