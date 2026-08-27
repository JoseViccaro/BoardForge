import { UserRole } from "./UserRole.js";
import { RbacPolicyEngine } from "../services/RbacPolicyEngine.js";

export class TenantContext {
  constructor(
    public readonly organizationId: string,
    public readonly userId: string,
    public readonly role: UserRole,
    public readonly permissions: ReadonlySet<string>
  ) {}

  public static create(params: {
    organizationId: string;
    userId: string;
    role: UserRole;
    permissions?: ReadonlySet<string>;
  }): TenantContext {
    const permissions = params.permissions ?? RbacPolicyEngine.getPermissionsForRole(params.role);
    return new TenantContext(params.organizationId, params.userId, params.role, permissions);
  }

  public isAuthorized(allowedRoles: UserRole[] | UserRole): boolean {
    const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
    return roles.includes(this.role);
  }

  public hasPermission(permission: string): boolean {
    return this.permissions.has(permission);
  }
}
