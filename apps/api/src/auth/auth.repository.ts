import { Injectable } from "@nestjs/common";
import { eq } from "drizzle-orm";
import { DbService } from "../db/db.service";
import { sessions, users } from "../db/schema";
import { isUniqueViolation } from "../db/unique-violation";
import { ConflictError } from "../errors/domain-errors";

export type UserRow = typeof users.$inferSelect;
export type NewUserRow = typeof users.$inferInsert;
export type SessionRow = typeof sessions.$inferSelect;
export type NewSessionRow = typeof sessions.$inferInsert;

/** A session together with the user it belongs to, fetched as one round trip. */
export interface SessionWithUser {
  session: SessionRow;
  user: UserRow;
}

/** All Drizzle access to the tables auth owns. */
@Injectable()
export class AuthRepository {
  constructor(private readonly database: DbService) {}

  async findUserByEmail(email: string): Promise<UserRow | undefined> {
    const [user] = await this.database.db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    return user;
  }

  /**
   * The email column is the last word on who is already registered: two
   * concurrent signups both clear the service's check, and the one Postgres
   * refuses must still read as a conflict rather than a failure.
   */
  async createUser(user: NewUserRow): Promise<UserRow> {
    try {
      const [created] = await this.database.db.insert(users).values(user).returning();
      if (!created) throw new Error("Inserting a user returned no row");
      return created;
    } catch (error) {
      if (isUniqueViolation(error)) throw new ConflictError("Email already registered");
      throw error;
    }
  }

  async createSession(session: NewSessionRow): Promise<void> {
    await this.database.db.insert(sessions).values(session);
  }

  async findSessionByTokenHash(tokenHash: string): Promise<SessionWithUser | undefined> {
    const [found] = await this.database.db
      .select({ session: sessions, user: users })
      .from(sessions)
      .innerJoin(users, eq(users.id, sessions.userId))
      .where(eq(sessions.tokenHash, tokenHash))
      .limit(1);
    return found;
  }

  async deleteSessionByTokenHash(tokenHash: string): Promise<void> {
    await this.database.db.delete(sessions).where(eq(sessions.tokenHash, tokenHash));
  }
}
