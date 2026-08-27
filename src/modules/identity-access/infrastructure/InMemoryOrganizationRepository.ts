import { IOrganizationRepository } from "../domain/repositories/IOrganizationRepository.js";
import { Organization } from "../domain/entities/Organization.js";

export class InMemoryOrganizationRepository implements IOrganizationRepository {
  private readonly orgs = new Map<string, Organization>();

  public async create(org: Organization): Promise<void> {
    this.orgs.set(org.id, org);
  }

  public async findById(id: string): Promise<Organization | null> {
    return this.orgs.get(id) ?? null;
  }

  public async findBySlug(slug: string): Promise<Organization | null> {
    for (const org of this.orgs.values()) {
      if (org.slug === slug) {
        return org;
      }
    }
    return null;
  }

  public async update(org: Organization): Promise<void> {
    this.orgs.set(org.id, org);
  }

  public clear(): void {
    this.orgs.clear();
  }
}
