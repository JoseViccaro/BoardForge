import { randomUUID } from "node:crypto";

export enum TenantPlan {
  Community = "Community",
  ProShop = "ProShop",
  Enterprise = "Enterprise",
}

export interface OrganizationProps {
  id?: string;
  slug: string;
  name: string;
  plan?: TenantPlan;
  storageQuotaBytes?: bigint;
  createdAt?: Date;
  updatedAt?: Date;
}

export class Organization {
  public readonly id: string;
  public slug: string;
  public name: string;
  public plan: TenantPlan;
  public storageQuotaBytes: bigint;
  public readonly createdAt: Date;
  public updatedAt: Date;

  constructor(props: OrganizationProps) {
    this.id = props.id ?? randomUUID();
    this.slug = props.slug;
    this.name = props.name;
    this.plan = props.plan ?? TenantPlan.Community;
    this.storageQuotaBytes = props.storageQuotaBytes ?? 10n * 1024n * 1024n * 1024n; // 10 GB default
    this.createdAt = props.createdAt ?? new Date();
    this.updatedAt = props.updatedAt ?? new Date();
  }

  public static create(params: {
    slug: string;
    name: string;
    plan?: TenantPlan;
    storageQuotaBytes?: bigint;
  }): Organization {
    return new Organization({
      slug: params.slug,
      name: params.name,
      plan: params.plan,
      storageQuotaBytes: params.storageQuotaBytes,
    });
  }
}
