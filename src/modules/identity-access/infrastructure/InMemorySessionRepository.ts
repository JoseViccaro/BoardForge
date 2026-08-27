import { ISessionRepository } from "../domain/repositories/ISessionRepository.js";
import { Session } from "../domain/entities/Session.js";

export class InMemorySessionRepository implements ISessionRepository {
  private readonly sessions = new Map<string, Session>();

  public async create(session: Session): Promise<void> {
    this.sessions.set(session.id, session);
  }

  public async findById(id: string): Promise<Session | null> {
    return this.sessions.get(id) ?? null;
  }

  public async findByTokenHash(tokenHash: string): Promise<Session | null> {
    for (const session of this.sessions.values()) {
      if (session.refreshTokenHash === tokenHash) {
        return session;
      }
    }
    return null;
  }

  public async revoke(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.revoke();
    }
  }

  public async revokeAllForUser(userId: string): Promise<void> {
    for (const session of this.sessions.values()) {
      if (session.userId === userId) {
        session.revoke();
      }
    }
  }

  public async findActiveByUserId(userId: string): Promise<Session[]> {
    const active: Session[] = [];
    for (const session of this.sessions.values()) {
      if (session.userId === userId && session.isValid()) {
        active.push(session);
      }
    }
    return active;
  }

  public clear(): void {
    this.sessions.clear();
  }
}
