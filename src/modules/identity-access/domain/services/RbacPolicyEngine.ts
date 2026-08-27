import { UserRole } from "../value-objects/UserRole.js";

const ROLE_HIERARCHY: Record<UserRole, number> = {
  [UserRole.Admin]: 4,
  [UserRole.LeadTech]: 3,
  [UserRole.Tech]: 2,
  [UserRole.Viewer]: 1,
};

const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  [UserRole.Admin]: [
    "org:manage",
    "user:manage",
    "catalog:write",
    "catalog:read",
    "boardview:upload",
    "boardview:read",
    "schematics:upload",
    "schematics:read",
    "measurements:manage_references",
    "measurements:record",
    "measurements:read",
    "pmu:simulate",
    "pmu:read",
  ],
  [UserRole.LeadTech]: [
    "catalog:write",
    "catalog:read",
    "boardview:upload",
    "boardview:read",
    "schematics:upload",
    "schematics:read",
    "measurements:manage_references",
    "measurements:record",
    "measurements:read",
    "pmu:simulate",
    "pmu:read",
  ],
  [UserRole.Tech]: [
    "catalog:read",
    "boardview:read",
    "schematics:read",
    "measurements:record",
    "measurements:read",
    "pmu:simulate",
    "pmu:read",
  ],
  [UserRole.Viewer]: [
    "catalog:read",
    "boardview:read",
    "schematics:read",
    "measurements:read",
    "pmu:read",
  ],
};

export class RbacPolicyEngine {
  public static hasMinimumRole(userRole: UserRole, requiredRole: UserRole): boolean {
    const userRank = ROLE_HIERARCHY[userRole] ?? 0;
    const requiredRank = ROLE_HIERARCHY[requiredRole] ?? 0;
    return userRank >= requiredRank;
  }

  public static getPermissionsForRole(role: UserRole): Set<string> {
    const perms = ROLE_PERMISSIONS[role] ?? [];
    return new Set(perms);
  }

  public static isAuthorized(
    userRole: UserRole,
    allowedRolesOrPermissions: UserRole | UserRole[] | string | string[]
  ): boolean {
    const items = Array.isArray(allowedRolesOrPermissions)
      ? allowedRolesOrPermissions
      : [allowedRolesOrPermissions];

    // If items contain roles
    const roles = items.filter((item): item is UserRole =>
      Object.values(UserRole).includes(item as UserRole)
    );
    if (roles.length > 0) {
      return roles.includes(userRole);
    }

    // If items are permission strings
    const userPermissions = this.getPermissionsForRole(userRole);
    return items.every((permission) => userPermissions.has(permission));
  }
}
