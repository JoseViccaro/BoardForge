import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { TokenManager } from "../../../modules/identity-access/domain/services/TokenManager.js";
import { TenantContext } from "../../../modules/identity-access/domain/value-objects/TenantContext.js";
import { UnauthorizedError } from "../errors/HttpErrors.js";

declare module "fastify" {
  interface FastifyRequest {
    tenantContext?: TenantContext;
  }
  interface FastifyInstance {
    authenticate: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

export interface AuthPluginOptions {
  tokenManager: TokenManager;
}

export function registerAuth(fastify: FastifyInstance, opts: AuthPluginOptions): void {
  fastify.decorateRequest("tenantContext", undefined);

  fastify.decorate(
    "authenticate",
    async (req: FastifyRequest, reply: FastifyReply) => {
      // 1. Check cookies first: bf_access_token
      let token: string | undefined = req.cookies?.bf_access_token;

      // 2. Fallback to Authorization: Bearer <token>
      if (!token && req.headers.authorization) {
        const parts = req.headers.authorization.split(" ");
        if (parts.length === 2 && parts[0] === "Bearer") {
          token = parts[1];
        }
      }

      if (!token) {
        throw new UnauthorizedError("Authentication token is missing.");
      }

      try {
        const payload = opts.tokenManager.verifyAccessToken(token);
        req.tenantContext = TenantContext.create({
          organizationId: payload.org_id,
          userId: payload.sub,
          role: payload.role,
        });
      } catch (err: any) {
        throw new UnauthorizedError(err.message || "Invalid or expired access token.");
      }
    }
  );
}
