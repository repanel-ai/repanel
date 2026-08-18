import { Injectable } from "@nestjs/common";
import { eq, sql } from "drizzle-orm";
import { DbService } from "../db/db.service";
import { definitions } from "../db/schema";

export type DefinitionRow = typeof definitions.$inferSelect;
export type NewDefinitionRow = typeof definitions.$inferInsert;

/** All Drizzle access to the table definitions owns. */
@Injectable()
export class DefinitionsRepository {
  constructor(private readonly database: DbService) {}

  /**
   * Files a project's draft, replacing the one already there. The project id
   * is unique, so the conflict clause is what makes "one draft per project"
   * true even for two submissions racing each other.
   */
  async save(draft: NewDefinitionRow): Promise<DefinitionRow> {
    const [saved] = await this.database.db
      .insert(definitions)
      .values(draft)
      .onConflictDoUpdate({
        target: definitions.projectId,
        set: {
          payload: draft.payload,
          valid: draft.valid,
          // Spelled out rather than omitted: a draft that has just become
          // valid must clear the errors of the one it replaces.
          errors: draft.errors ?? null,
          // The row's own clock, so both timestamps come from the database.
          updatedAt: sql`now()`,
        },
      })
      .returning();
    if (!saved) throw new Error("Saving a definition returned no row");
    return saved;
  }

  async findByProjectId(projectId: string): Promise<DefinitionRow | undefined> {
    const [definition] = await this.database.db
      .select()
      .from(definitions)
      .where(eq(definitions.projectId, projectId))
      .limit(1);
    return definition;
  }
}
