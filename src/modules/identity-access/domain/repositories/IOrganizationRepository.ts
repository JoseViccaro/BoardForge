import { Organization } from "../entities/Organization.js";

export interface IOrganizationRepository {
  create(org: Organization): Promise<void>;
  findById(id: string): Promise<Organization | null>;
  findBySlug(slug: string): Promise<Organization | null>;
  update(org: Organization): Promise<void>;
}
