import { Injectable } from "@nestjs/common";
import { eq, sql } from "drizzle-orm";
import { DbService } from "../db/db.service";
import { connections } from "../db/schema";

export type ConnectionRow = typeof connections.$inferSelect;
export type NewConnectionRow = typeof connections.$inferInsert;

/** What it means when the lookup below finds nothing, wherever it is asked. */
export const NO_CONNECTION = "This project has no database connection";

/** A project served through a connector has no connection string of its own. */
export const NO_DSN = "This project is served through a connector, not a connection string";

/** All Drizzle access to the table connections owns. */
@Injectable()
export class ConnectionsRepository {
  constructor(private readonly database: DbService) {}

  /**
   * Files a project's connection, replacing the one already there. The project
   * id is unique, so the conflict clause is what makes "one connection per
   * project" true even for two writes racing each other.
   */
  async save(connection: NewConnectionRow): Promise<ConnectionRow> {
    const [saved] = await this.database.db
      .insert(connections)
      .values(connection)
      .onConflictDoUpdate({
        target: connections.projectId,
        set: {
          // The kind is set on every write, so switching rungs is the same
          // statement as replacing a connection string — and the check
          // constraint refuses any row where the two disagree.
          kind: connection.kind,
          encryptedDsn: connection.encryptedDsn ?? null,
          // The row's own clock, so both timestamps come from the database.
          updatedAt: sql`now()`,
        },
      })
      .returning();
    if (!saved) throw new Error("Saving a connection returned no row");
    return saved;
  }

  async findByProjectId(projectId: string): Promise<ConnectionRow | undefined> {
    const [connection] = await this.database.db
      .select()
      .from(connections)
      .where(eq(connections.projectId, projectId))
      .limit(1);
    return connection;
  }
}
