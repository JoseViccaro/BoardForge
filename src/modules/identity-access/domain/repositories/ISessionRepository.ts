import { Session } from "../entities/Session.js";

export interface ISessionRepository {
  create(session: Session): Promise<void>;
  findById(id: string): Promise<Session | null>;
  findByTokenHash(tokenHash: string): Promise<Session | null>;
  revoke(sessionId: string): Promise<void>;
  revokeAllForUser(userId: string): Promise<void>;
  findActiveByUserId(userId: string): Promise<Session[]>;
}
