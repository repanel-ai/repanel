import { Injectable } from "@nestjs/common";
import { desc, eq } from "drizzle-orm";
import { DbService } from "../db/db.service";
import { definitionVersions } from "../db/schema";
import { isUniqueViolation } from "../db/unique-violation";
import { ConflictError } from "../errors/domain-errors";

export type DefinitionVersionRow = typeof definitionVersions.$inferSelect;

/**
 * All Drizzle access to a project's published versions.
 *
 * It inserts and it reads, and that is deliberately the whole surface. There is
 * no method here that changes a row or removes one, because a published version
 * is what somebody is looking at: the way to change what an admin serves is to
 * publish another version, which leaves the one before it exactly as it was.
 */
@Injectable()
export class DefinitionVersionsRepository {
  constructor(private readonly database: DbService) {}

  /**
   * Publishes a payload as the project's next version.
   *
   * The number is read and then used, so two publishes racing each other can
   * reach for the same one; `(project_id, version)` is unique, which turns that
   * race into a refusal rather than two rows claiming to be the same version.
   */
  async insertNext(projectId: string, payload: unknown): Promise<DefinitionVersionRow> {
    const latest = await this.findLatest(projectId);

    try {
      const [published] = await this.database.db
        .insert(definitionVersions)
        .values({ projectId, payload, version: (latest?.version ?? 0) + 1 })
        .returning();
      if (!published) throw new Error("Publishing a definition returned no row");
      return published;
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictError("This definition was published by something else; try again");
      }
      throw error;
    }
  }

  /** The version the admin serves: the highest one this project has. */
  async findLatest(projectId: string): Promise<DefinitionVersionRow | undefined> {
    const [published] = await this.database.db
      .select()
      .from(definitionVersions)
      .where(eq(definitionVersions.projectId, projectId))
      .orderBy(desc(definitionVersions.version))
      .limit(1);
    return published;
  }
}
