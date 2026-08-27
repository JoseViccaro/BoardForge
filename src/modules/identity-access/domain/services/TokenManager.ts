import jwt from "jsonwebtoken";
import { randomBytes, createHash, randomUUID } from "node:crypto";
import { UserRole } from "../value-objects/UserRole.js";

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresInSeconds: number;
}

export interface AccessTokenPayload {
  sub: string;
  org_id: string;
  role: UserRole;
  jti?: string;
  iat?: number;
  exp?: number;
}

export interface TokenManagerConfig {
  jwtSecret: string;
  accessTokenTtlSeconds?: number;
  refreshTokenTtlSeconds?: number;
}

export class TokenManager {
  private readonly jwtSecret: string;
  private readonly accessTokenTtlSeconds: number;
  private readonly refreshTokenTtlSeconds: number;

  constructor(config: TokenManagerConfig) {
    this.jwtSecret = config.jwtSecret;
    this.accessTokenTtlSeconds = config.accessTokenTtlSeconds ?? 15 * 60; // 15 minutes
    this.refreshTokenTtlSeconds = config.refreshTokenTtlSeconds ?? 7 * 24 * 60 * 60; // 7 days
  }

  public async generateTokenPair(user: {
    id: string;
    organizationId: string;
    role: UserRole;
  }): Promise<TokenPair> {
    const jti = randomUUID();
    const payload: AccessTokenPayload = {
      sub: user.id,
      org_id: user.organizationId,
      role: user.role,
      jti,
    };

    const accessToken = jwt.sign(payload, this.jwtSecret, {
      expiresIn: this.accessTokenTtlSeconds,
    });

    // 256-bit (32 bytes) opaque refresh token hex encoded
    const refreshToken = randomBytes(32).toString("hex");

    return {
      accessToken,
      refreshToken,
      expiresInSeconds: this.accessTokenTtlSeconds,
    };
  }

  public verifyAccessToken(token: string): AccessTokenPayload {
    const decoded = jwt.verify(this.jwtSecret ? token : "", this.jwtSecret) as AccessTokenPayload;
    return decoded;
  }

  public hashRefreshToken(refreshToken: string): string {
    return createHash("sha256").update(refreshToken).digest("hex");
  }
}
