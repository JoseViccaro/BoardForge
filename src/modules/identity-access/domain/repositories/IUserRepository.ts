import { User } from "../entities/User.js";

export interface IUserRepository {
  create(user: User): Promise<void>;
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  findByEmailAndOrg(email: string, organizationId: string): Promise<User | null>;
  update(user: User): Promise<void>;
}
