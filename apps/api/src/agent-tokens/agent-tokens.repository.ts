import { Injectable } from "@nestjs/common";
import { desc, eq, sql } from "drizzle-orm";
import { DbService } from "../db/db.service";
import { agentTokens } from "../db/schema";

export type AgentTokenRow = typeof agentTokens.$inferSelect;
export type NewAgentTokenRow = typeof agentTokens.$inferInsert;

/** All Drizzle access to the table agent tokens owns. */
@Injectable()
export class AgentTokensRepository {
  constructor(private readonly database: DbService) {}

  async create(token: NewAgentTokenRow): Promise<AgentTokenRow> {
    const [created] = await this.database.db.insert(agentTokens).values(token).returning();
    if (!created) throw new Error("Inserting an agent token returned no row");
    return created;
  }

  async listByProjectId(projectId: string): Promise<AgentTokenRow[]> {
    return this.database.db
      .select()
      .from(agentTokens)
      .where(eq(agentTokens.projectId, projectId))
      .orderBy(desc(agentTokens.createdAt));
  }

  /**
   * The token a digest names, marked as used in the same statement: one round
   * trip, and no window in which a token is accepted without being recorded.
   * The clock is the database's, like every other timestamp on the row.
   */
  async recordUse(tokenHash: string): Promise<AgentTokenRow | undefined> {
    const [used] = await this.database.db
      .update(agentTokens)
      .set({ lastUsedAt: sql`now()` })
      .where(eq(agentTokens.tokenHash, tokenHash))
      .returning();
    return used;
  }
}
