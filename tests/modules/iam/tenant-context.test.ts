import { describe, it, expect } from "vitest";
import { UserRole } from "../../../src/modules/identity-access/domain/value-objects/UserRole.js";
import { TenantContext } from "../../../src/modules/identity-access/domain/value-objects/TenantContext.js";
import { RbacPolicyEngine } from "../../../src/modules/identity-access/domain/services/RbacPolicyEngine.js";
import { User } from "../../../src/modules/identity-access/domain/entities/User.js";
import { Organization, TenantPlan } from "../../../src/modules/identity-access/domain/entities/Organization.js";
import { PasswordHash } from "../../../src/modules/identity-access/domain/value-objects/PasswordHash.js";

describe("TenantContext & RBAC Policy Engine", () => {
  it("should validate role hierarchy (Admin > LeadTech > Tech > Viewer)", () => {
    // Admin
    expect(RbacPolicyEngine.hasMinimumRole(UserRole.Admin, UserRole.Admin)).toBe(true);
    expect(RbacPolicyEngine.hasMinimumRole(UserRole.Admin, UserRole.LeadTech)).toBe(true);
    expect(RbacPolicyEngine.hasMinimumRole(UserRole.Admin, UserRole.Tech)).toBe(true);
    expect(RbacPolicyEngine.hasMinimumRole(UserRole.Admin, UserRole.Viewer)).toBe(true);

    // LeadTech
    expect(RbacPolicyEngine.hasMinimumRole(UserRole.LeadTech, UserRole.Admin)).toBe(false);
    expect(RbacPolicyEngine.hasMinimumRole(UserRole.LeadTech, UserRole.LeadTech)).toBe(true);
    expect(RbacPolicyEngine.hasMinimumRole(UserRole.LeadTech, UserRole.Tech)).toBe(true);
    expect(RbacPolicyEngine.hasMinimumRole(UserRole.LeadTech, UserRole.Viewer)).toBe(true);

    // Tech
    expect(RbacPolicyEngine.hasMinimumRole(UserRole.Tech, UserRole.Admin)).toBe(false);
    expect(RbacPolicyEngine.hasMinimumRole(UserRole.Tech, UserRole.LeadTech)).toBe(false);
    expect(RbacPolicyEngine.hasMinimumRole(UserRole.Tech, UserRole.Tech)).toBe(true);
    expect(RbacPolicyEngine.hasMinimumRole(UserRole.Tech, UserRole.Viewer)).toBe(true);

    // Viewer
    expect(RbacPolicyEngine.hasMinimumRole(UserRole.Viewer, UserRole.Admin)).toBe(false);
    expect(RbacPolicyEngine.hasMinimumRole(UserRole.Viewer, UserRole.LeadTech)).toBe(false);
    expect(RbacPolicyEngine.hasMinimumRole(UserRole.Viewer, UserRole.Tech)).toBe(false);
    expect(RbacPolicyEngine.hasMinimumRole(UserRole.Viewer, UserRole.Viewer)).toBe(true);
  });

  it("should resolve permissions for each role accurately", () => {
    const adminPerms = RbacPolicyEngine.getPermissionsForRole(UserRole.Admin);
    const leadPerms = RbacPolicyEngine.getPermissionsForRole(UserRole.LeadTech);
    const techPerms = RbacPolicyEngine.getPermissionsForRole(UserRole.Tech);
    const viewerPerms = RbacPolicyEngine.getPermissionsForRole(UserRole.Viewer);

    expect(adminPerms.has("org:manage")).toBe(true);
    expect(leadPerms.has("org:manage")).toBe(false);

    expect(leadPerms.has("boardview:upload")).toBe(true);
    expect(leadPerms.has("catalog:write")).toBe(true);
    expect(leadPerms.has("measurements:manage_references")).toBe(true);

    expect(techPerms.has("boardview:upload")).toBe(false);
    expect(techPerms.has("measurements:record")).toBe(true);
    expect(techPerms.has("pmu:simulate")).toBe(true);

    expect(viewerPerms.has("measurements:record")).toBe(false);
    expect(viewerPerms.has("boardview:read")).toBe(true);
    expect(viewerPerms.has("catalog:read")).toBe(true);
  });

  it("should create TenantContext from user role and evaluate isAuthorized", () => {
    const context = TenantContext.create({
      organizationId: "org_123",
      userId: "usr_456",
      role: UserRole.Tech,
    });

    expect(context.organizationId).toBe("org_123");
    expect(context.userId).toBe("usr_456");
    expect(context.role).toBe(UserRole.Tech);
    expect(context.isAuthorized([UserRole.Tech, UserRole.Admin])).toBe(true);
    expect(context.isAuthorized([UserRole.LeadTech, UserRole.Admin])).toBe(false);
    expect(context.hasPermission("measurements:record")).toBe(true);
    expect(context.hasPermission("boardview:upload")).toBe(false);
  });

  it("should instantiate User and Organization aggregates properly", async () => {
    const org = Organization.create({
      slug: "apple-repair-hub",
      name: "Apple Repair Hub",
      plan: TenantPlan.ProShop,
      storageQuotaBytes: 50n * 1024n * 1024n * 1024n, // 50GB
    });

    expect(org.id).toBeDefined();
    expect(org.slug).toBe("apple-repair-hub");
    expect(org.plan).toBe(TenantPlan.ProShop);

    const hash = await PasswordHash.create("ValidPassword123!");
    const user = User.create({
      organizationId: org.id,
      email: "lead@applerepair.com",
      passwordHash: hash,
      role: UserRole.LeadTech,
    });

    expect(user.id).toBeDefined();
    expect(user.email).toBe("lead@applerepair.com");
    expect(user.role).toBe(UserRole.LeadTech);
    expect(user.isActive).toBe(true);
  });
});
