import { IUserRepository } from "../domain/repositories/IUserRepository.js";
import { IOrganizationRepository } from "../domain/repositories/IOrganizationRepository.js";
import { ISessionRepository } from "../domain/repositories/ISessionRepository.js";
import { TokenManager, TokenPair } from "../domain/services/TokenManager.js";
import { PasswordHash } from "../domain/value-objects/PasswordHash.js";
import { UserRole } from "../domain/value-objects/UserRole.js";
import { User } from "../domain/entities/User.js";
import { Organization, TenantPlan } from "../domain/entities/Organization.js";
import { Session } from "../domain/entities/Session.js";
import {
  UnauthorizedError,
  ConflictError,
  EntityNotFoundError,
} from "../../..//interfaces/http/errors/HttpErrors.js";

export interface UserDto {
  id: string;
  organizationId: string;
  email: string;
  role: UserRole;
  isActive: boolean;
}

export interface OrganizationDto {
  id: string;
  slug: string;
  name: string;
  plan: TenantPlan;
}

export interface RegisterTenantCommand {
  slug: string;
  orgName: string;
  email: string;
  password: string;
  role?: UserRole;
  plan?: TenantPlan;
}

export interface LoginCommand {
  email: string;
  password: string;
  userAgent?: string;
  ipAddress?: string;
}

export interface RefreshTokenCommand {
  refreshToken: string;
  userAgent?: string;
  ipAddress?: string;
}

export class IdentityAccessFacade {
  constructor(
    private readonly userRepo: IUserRepository,
    private readonly orgRepo: IOrganizationRepository,
    private readonly sessionRepo: ISessionRepository,
    private readonly tokenManager: TokenManager
  ) {}

  public async registerTenant(command: RegisterTenantCommand): Promise<{
    user: UserDto;
    organization: OrganizationDto;
    tokens: TokenPair;
  }> {
    const existingOrg = await this.orgRepo.findBySlug(command.slug);
    if (existingOrg) {
      throw new ConflictError(`Organization slug '${command.slug}' is already registered.`);
    }

    const existingUser = await this.userRepo.findByEmail(command.email);
    if (existingUser) {
      throw new ConflictError(`User email '${command.email}' is already registered.`);
    }

    const org = Organization.create({
      slug: command.slug,
      name: command.orgName,
      plan: command.plan ?? TenantPlan.Community,
    });
    await this.orgRepo.create(org);

    const passwordHash = await PasswordHash.create(command.password);
    const user = User.create({
      organizationId: org.id,
      email: command.email,
      passwordHash,
      role: command.role ?? UserRole.Admin,
    });
    await this.userRepo.create(user);

    const tokens = await this.tokenManager.generateTokenPair({
      id: user.id,
      organizationId: org.id,
      role: user.role,
    });

    const tokenHash = this.tokenManager.hashRefreshToken(tokens.refreshToken);
    const session = Session.create({
      userId: user.id,
      refreshTokenHash: tokenHash,
      ttlSeconds: 7 * 24 * 60 * 60,
    });
    await this.sessionRepo.create(session);

    return {
      user: {
        id: user.id,
        organizationId: user.organizationId,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
      },
      organization: {
        id: org.id,
        slug: org.slug,
        name: org.name,
        plan: org.plan,
      },
      tokens,
    };
  }

  public async login(command: LoginCommand): Promise<{
    user: UserDto;
    organization: OrganizationDto;
    tokens: TokenPair;
  }> {
    const user = await this.userRepo.findByEmail(command.email);
    if (!user || !user.isActive) {
      throw new UnauthorizedError("Invalid email or password.");
    }

    const isPasswordValid = await user.passwordHash.verify(command.password);
    if (!isPasswordValid) {
      throw new UnauthorizedError("Invalid email or password.");
    }

    const org = await this.orgRepo.findById(user.organizationId);
    if (!org) {
      throw new EntityNotFoundError(`Organization for user ${user.id} not found.`);
    }

    const tokens = await this.tokenManager.generateTokenPair({
      id: user.id,
      organizationId: user.organizationId,
      role: user.role,
    });

    const tokenHash = this.tokenManager.hashRefreshToken(tokens.refreshToken);
    const session = Session.create({
      userId: user.id,
      refreshTokenHash: tokenHash,
      ttlSeconds: 7 * 24 * 60 * 60,
      userAgent: command.userAgent,
      ipAddress: command.ipAddress,
    });
    await this.sessionRepo.create(session);

    return {
      user: {
        id: user.id,
        organizationId: user.organizationId,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
      },
      organization: {
        id: org.id,
        slug: org.slug,
        name: org.name,
        plan: org.plan,
      },
      tokens,
    };
  }

  public async refreshTokens(command: RefreshTokenCommand): Promise<{ tokens: TokenPair }> {
    const tokenHash = this.tokenManager.hashRefreshToken(command.refreshToken);
    const session = await this.sessionRepo.findByTokenHash(tokenHash);

    if (!session) {
      throw new UnauthorizedError("Invalid refresh token.");
    }

    if (session.isRevoked()) {
      // Replay attack detected: revoke all sessions for this user
      await this.sessionRepo.revokeAllForUser(session.userId);
      throw new UnauthorizedError("Token replay detected. All sessions have been revoked.");
    }

    if (session.isExpired()) {
      throw new UnauthorizedError("Refresh token has expired.");
    }

    const user = await this.userRepo.findById(session.userId);
    if (!user || !user.isActive) {
      throw new UnauthorizedError("User is no longer active.");
    }

    // Revoke old session
    await this.sessionRepo.revoke(session.id);

    // Issue new tokens
    const tokens = await this.tokenManager.generateTokenPair({
      id: user.id,
      organizationId: user.organizationId,
      role: user.role,
    });

    const newHash = this.tokenManager.hashRefreshToken(tokens.refreshToken);
    const newSession = Session.create({
      userId: user.id,
      refreshTokenHash: newHash,
      ttlSeconds: 7 * 24 * 60 * 60,
      userAgent: command.userAgent,
      ipAddress: command.ipAddress,
    });
    await this.sessionRepo.create(newSession);

    return { tokens };
  }

  public async logout(refreshToken?: string): Promise<void> {
    if (refreshToken) {
      const tokenHash = this.tokenManager.hashRefreshToken(refreshToken);
      const session = await this.sessionRepo.findByTokenHash(tokenHash);
      if (session) {
        await this.sessionRepo.revoke(session.id);
      }
    }
  }

  public async getMe(userId: string): Promise<{ user: UserDto; organization: OrganizationDto }> {
    const user = await this.userRepo.findById(userId);
    if (!user) {
      throw new EntityNotFoundError(`User '${userId}' not found.`);
    }

    const org = await this.orgRepo.findById(user.organizationId);
    if (!org) {
      throw new EntityNotFoundError(`Organization '${user.organizationId}' not found.`);
    }

    return {
      user: {
        id: user.id,
        organizationId: user.organizationId,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
      },
      organization: {
        id: org.id,
        slug: org.slug,
        name: org.name,
        plan: org.plan,
      },
    };
  }
}
