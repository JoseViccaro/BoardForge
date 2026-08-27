import { FastifyRequest, FastifyReply } from "fastify";
import { IdentityAccessFacade } from "../../../modules/identity-access/application/IdentityAccessFacade.js";
import { RegisterRequestSchema, LoginRequestSchema, RefreshTokenRequestSchema } from "../dtos/auth.dto.js";
import { UnauthorizedError } from "../errors/HttpErrors.js";

export class AuthController {
  constructor(private readonly identityAccessFacade: IdentityAccessFacade) {}

  public register = async (req: FastifyRequest, reply: FastifyReply) => {
    const dto = RegisterRequestSchema.parse(req.body);
    const result = await this.identityAccessFacade.registerTenant({
      slug: dto.slug,
      orgName: dto.orgName,
      email: dto.email,
      password: dto.password,
      role: dto.role,
      plan: dto.plan,
    });

    this.setAuthCookies(reply, result.tokens.accessToken, result.tokens.refreshToken);
    return reply.status(201).send(result);
  };

  public login = async (req: FastifyRequest, reply: FastifyReply) => {
    const dto = LoginRequestSchema.parse(req.body);
    const result = await this.identityAccessFacade.login({
      email: dto.email,
      password: dto.password,
      userAgent: req.headers["user-agent"],
      ipAddress: req.ip,
    });

    this.setAuthCookies(reply, result.tokens.accessToken, result.tokens.refreshToken);
    return reply.status(200).send(result);
  };

  public refresh = async (req: FastifyRequest, reply: FastifyReply) => {
    const cookieToken = req.cookies?.bf_refresh_token;
    const bodyToken = (req.body as any)?.refreshToken;
    const refreshToken = cookieToken || bodyToken;

    if (!refreshToken) {
      throw new UnauthorizedError("Refresh token is required.");
    }

    const result = await this.identityAccessFacade.refreshTokens({
      refreshToken,
      userAgent: req.headers["user-agent"],
      ipAddress: req.ip,
    });

    this.setAuthCookies(reply, result.tokens.accessToken, result.tokens.refreshToken);
    return reply.status(200).send(result);
  };

  public logout = async (req: FastifyRequest, reply: FastifyReply) => {
    const cookieToken = req.cookies?.bf_refresh_token;
    const bodyToken = (req.body as any)?.refreshToken;
    const refreshToken = cookieToken || bodyToken;

    await this.identityAccessFacade.logout(refreshToken);

    reply.clearCookie("bf_access_token", { path: "/" });
    reply.clearCookie("bf_refresh_token", { path: "/" });

    return reply.status(200).send({ message: "Successfully logged out." });
  };

  public getMe = async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.tenantContext) {
      throw new UnauthorizedError("Authentication required.");
    }
    const result = await this.identityAccessFacade.getMe(req.tenantContext.userId);
    return reply.status(200).send(result);
  };

  private setAuthCookies(reply: FastifyReply, accessToken: string, refreshToken: string) {
    reply.setCookie("bf_access_token", accessToken, {
      path: "/",
      httpOnly: true,
      secure: true,
      sameSite: "strict",
      maxAge: 15 * 60, // 15 minutes
    });

    reply.setCookie("bf_refresh_token", refreshToken, {
      path: "/",
      httpOnly: true,
      secure: true,
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60, // 7 days
    });
  }
}
