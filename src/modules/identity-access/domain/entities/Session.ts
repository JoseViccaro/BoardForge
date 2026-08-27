import { randomUUID } from "node:crypto";

export interface SessionProps {
  id?: string;
  userId: string;
  refreshTokenHash: string;
  expiresAt: Date;
  revokedAt?: Date | null;
  userAgent?: string;
  ipAddress?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export class Session {
  public readonly id: string;
  public readonly userId: string;
  public refreshTokenHash: string;
  public readonly expiresAt: Date;
  public revokedAt: Date | null;
  public readonly userAgent: string;
  public readonly ipAddress: string;
  public readonly createdAt: Date;
  public updatedAt: Date;

  constructor(props: SessionProps) {
    this.id = props.id ?? randomUUID();
    this.userId = props.userId;
    this.refreshTokenHash = props.refreshTokenHash;
    this.expiresAt = props.expiresAt;
    this.revokedAt = props.revokedAt ?? null;
    this.userAgent = props.userAgent ?? "unknown";
    this.ipAddress = props.ipAddress ?? "unknown";
    this.createdAt = props.createdAt ?? new Date();
    this.updatedAt = props.updatedAt ?? new Date();
  }

  public static create(params: {
    userId: string;
    refreshTokenHash: string;
    ttlSeconds: number;
    userAgent?: string;
    ipAddress?: string;
  }): Session {
    const expiresAt = new Date(Date.now() + params.ttlSeconds * 1000);
    return new Session({
      userId: params.userId,
      refreshTokenHash: params.refreshTokenHash,
      expiresAt,
      userAgent: params.userAgent,
      ipAddress: params.ipAddress,
    });
  }

  public isRevoked(): boolean {
    return this.revokedAt !== null;
  }

  public isExpired(): boolean {
    return this.expiresAt.getTime() < Date.now();
  }

  public isValid(): boolean {
    return !this.isRevoked() && !this.isExpired();
  }

  public revoke(): void {
    this.revokedAt = new Date();
    this.updatedAt = new Date();
  }
}
