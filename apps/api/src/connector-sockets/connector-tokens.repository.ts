import { Injectable } from "@nestjs/common";
import { eq, sql } from "drizzle-orm";
import { DbService } from "../db/db.service";
import { connectorTokens } from "../db/schema";

export type ConnectorTokenRow = typeof connectorTokens.$inferSelect;

/** All Drizzle access to the table connector tokens own. */
@Injectable()
export class ConnectorTokensRepository {
  constructor(private readonly database: DbService) {}

  /**
   * Files a project's token, replacing the one already there. The project id is
   * unique, so minting again is what revokes the token that was minted before —
   * one project, one connector, one credential.
   */
  async save(projectId: string, tokenHash: string): Promise<ConnectorTokenRow> {
    const [saved] = await this.database.db
      .insert(connectorTokens)
      .values({ projectId, tokenHash })
      .onConflictDoUpdate({
        target: connectorTokens.projectId,
        // A new token has never been seen, whatever the old one had done.
        set: { tokenHash, lastSeenAt: null },
      })
      .returning();
    if (!saved) throw new Error("Saving a connector token returned no row");
    return saved;
  }

  async findByProjectId(projectId: string): Promise<ConnectorTokenRow | undefined> {
    const [token] = await this.database.db
      .select()
      .from(connectorTokens)
      .where(eq(connectorTokens.projectId, projectId))
      .limit(1);
    return token;
  }

  async findByHash(tokenHash: string): Promise<ConnectorTokenRow | undefined> {
    const [token] = await this.database.db
      .select()
      .from(connectorTokens)
      .where(eq(connectorTokens.tokenHash, tokenHash))
      .limit(1);
    return token;
  }

  /** Deletes a project's token, which is what turns a connector away for good. */
  async deleteByProjectId(projectId: string): Promise<void> {
    await this.database.db.delete(connectorTokens).where(eq(connectorTokens.projectId, projectId));
  }

  /** The clock is the database's, like every other timestamp on the row. */
  async recordSeen(projectId: string): Promise<void> {
    await this.database.db
      .update(connectorTokens)
      .set({ lastSeenAt: sql`now()` })
      .where(eq(connectorTokens.projectId, projectId));
  }
}
