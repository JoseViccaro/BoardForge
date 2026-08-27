import { IUserRepository } from "../domain/repositories/IUserRepository.js";
import { User } from "../domain/entities/User.js";

export class InMemoryUserRepository implements IUserRepository {
  private readonly users = new Map<string, User>();

  public async create(user: User): Promise<void> {
    this.users.set(user.id, user);
  }

  public async findById(id: string): Promise<User | null> {
    return this.users.get(id) ?? null;
  }

  public async findByEmail(email: string): Promise<User | null> {
    const normalized = email.toLowerCase().trim();
    for (const user of this.users.values()) {
      if (user.email.toLowerCase().trim() === normalized) {
        return user;
      }
    }
    return null;
  }

  public async findByEmailAndOrg(email: string, organizationId: string): Promise<User | null> {
    const normalized = email.toLowerCase().trim();
    for (const user of this.users.values()) {
      if (
        user.email.toLowerCase().trim() === normalized &&
        user.organizationId === organizationId
      ) {
        return user;
      }
    }
    return null;
  }

  public async update(user: User): Promise<void> {
    this.users.set(user.id, user);
  }

  public clear(): void {
    this.users.clear();
  }
}
