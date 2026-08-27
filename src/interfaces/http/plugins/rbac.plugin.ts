import { FastifyRequest, FastifyReply } from "fastify";
import { UserRole } from "../../../modules/identity-access/domain/value-objects/UserRole.js";
import { ForbiddenError, UnauthorizedError } from "../errors/HttpErrors.js";
import { RbacPolicyEngine } from "../../../modules/identity-access/domain/services/RbacPolicyEngine.js";

export function requireRole(allowedRoles: UserRole | UserRole[]) {
  const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];

  return async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.tenantContext) {
      throw new UnauthorizedError("Authentication required.");
    }

    if (!roles.includes(req.tenantContext.role)) {
      throw new ForbiddenError(
        `User role '${req.tenantContext.role}' is not authorized to access this resource.`
      );
    }
  };
}

export function requireMinimumRole(minimumRole: UserRole) {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.tenantContext) {
      throw new UnauthorizedError("Authentication required.");
    }

    if (!RbacPolicyEngine.hasMinimumRole(req.tenantContext.role, minimumRole)) {
      throw new ForbiddenError(
        `User role '${req.tenantContext.role}' does not have minimum role '${minimumRole}'.`
      );
    }
  };
}

export function requirePermission(permission: string) {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.tenantContext) {
      throw new UnauthorizedError("Authentication required.");
    }

    if (!req.tenantContext.hasPermission(permission)) {
      throw new ForbiddenError(
        `User does not possess the required permission: '${permission}'.`
      );
    }
  };
}
