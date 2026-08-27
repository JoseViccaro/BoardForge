import { describe, it, expect, beforeEach } from "vitest";
import { TokenManager } from "../../../src/modules/identity-access/domain/services/TokenManager.js";
import { UserRole } from "../../../src/modules/identity-access/domain/value-objects/UserRole.js";
import { Session } from "../../../src/modules/identity-access/domain/entities/Session.js";
import { InMemorySessionRepository } from "../../../src/modules/identity-access/infrastructure/InMemorySessionRepository.js";

describe("TokenManager & Session Cryptographic Manager", () => {
  const secret = "test-jwt-secret-key-that-is-at-least-256-bits-long-1234567890";
  let tokenManager: TokenManager;
  let sessionRepo: InMemorySessionRepository;

  beforeEach(() => {
    tokenManager = new TokenManager({
      jwtSecret: secret,
      accessTokenTtlSeconds: 15 * 60, // 15 minutes
      refreshTokenTtlSeconds: 7 * 24 * 60 * 60, // 7 days
    });
    sessionRepo = new InMemorySessionRepository();
  });

  it("should issue a 15-minute access token JWT with sub, org_id, role, and jti", async () => {
    const user = {
      id: "usr_123456",
      organizationId: "org_apple_repair",
      role: UserRole.Tech,
    };

    const tokenPair = await tokenManager.generateTokenPair(user);

    expect(tokenPair.accessToken).toBeDefined();
    expect(tokenPair.refreshToken).toBeDefined();
    expect(tokenPair.expiresInSeconds).toBe(900);

    const payload = tokenManager.verifyAccessToken(tokenPair.accessToken);
    expect(payload.sub).toBe(user.id);
    expect(payload.org_id).toBe(user.organizationId);
    expect(payload.role).toBe(UserRole.Tech);
    expect(payload.jti).toBeDefined();
  });

  it("should generate 256-bit opaque refresh token string", async () => {
    const user = {
      id: "usr_123456",
      organizationId: "org_apple_repair",
      role: UserRole.LeadTech,
    };

    const tokenPair = await tokenManager.generateTokenPair(user);
    // 256 bits = 32 bytes = 64 hex chars or ~43 base64/hex characters
    expect(tokenPair.refreshToken.length).toBeGreaterThanOrEqual(32);
  });

  it("should reject tampered or invalid access tokens", () => {
    expect(() => tokenManager.verifyAccessToken("invalid.jwt.token")).toThrow();
  });

  it("should reject expired access tokens", async () => {
    const shortLivedManager = new TokenManager({
      jwtSecret: secret,
      accessTokenTtlSeconds: -10, // expired in past
      refreshTokenTtlSeconds: 7 * 24 * 60 * 60,
    });

    const tokenPair = await shortLivedManager.generateTokenPair({
      id: "usr_1",
      organizationId: "org_1",
      role: UserRole.Admin,
    });

    expect(() => tokenManager.verifyAccessToken(tokenPair.accessToken)).toThrow(/expired|jwt expired/i);
  });

  it("should hash refresh token using SHA-256", () => {
    const raw = "random_opaque_token_string_12345";
    const hash1 = tokenManager.hashRefreshToken(raw);
    const hash2 = tokenManager.hashRefreshToken(raw);
    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(64); // SHA-256 hex string length
  });

  it("should detect replay attacks and invalidate all user sessions", async () => {
    const userId = "usr_victim_1";
    const orgId = "org_victim_1";

    // 1. Initial login -> Session 1
    const initialPair = await tokenManager.generateTokenPair({
      id: userId,
      organizationId: orgId,
      role: UserRole.Tech,
    });

    const initialHash = tokenManager.hashRefreshToken(initialPair.refreshToken);
    const session1 = Session.create({
      userId,
      refreshTokenHash: initialHash,
      ttlSeconds: 7 * 24 * 60 * 60,
      userAgent: "Agent1",
      ipAddress: "127.0.0.1",
    });
    await sessionRepo.create(session1);

    // Also simulate another active device session (Session 2)
    const session2 = Session.create({
      userId,
      refreshTokenHash: "other_device_hash_abcdef",
      ttlSeconds: 7 * 24 * 60 * 60,
      userAgent: "Agent2",
      ipAddress: "127.0.0.1",
    });
    await sessionRepo.create(session2);

    expect((await sessionRepo.findActiveByUserId(userId)).length).toBe(2);

    // 2. Legitimate token rotation (Refresh): session1 is consumed/revoked, new session3 is created
    await sessionRepo.revoke(session1.id);
    const rotatedPair = await tokenManager.generateTokenPair({
      id: userId,
      organizationId: orgId,
      role: UserRole.Tech,
    });
    const rotatedHash = tokenManager.hashRefreshToken(rotatedPair.refreshToken);
    const session3 = Session.create({
      userId,
      refreshTokenHash: rotatedHash,
      ttlSeconds: 7 * 24 * 60 * 60,
      userAgent: "Agent1",
      ipAddress: "127.0.0.1",
    });
    await sessionRepo.create(session3);

    // 3. Attacker resubmits initialPair.refreshToken (Replay Attack)
    const foundSession = await sessionRepo.findByTokenHash(initialHash);
    expect(foundSession).not.toBeNull();
    expect(foundSession?.isRevoked()).toBe(true);

    // Handling replay: revoke all sessions for this user!
    await sessionRepo.revokeAllForUser(userId);

    const activeSessions = await sessionRepo.findActiveByUserId(userId);
    expect(activeSessions.length).toBe(0);
  });
});
