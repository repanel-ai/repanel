import { Injectable } from "@nestjs/common";
import { and, desc, eq, isNull } from "drizzle-orm";
import { DbService } from "../db/db.service";
import { projects } from "../db/schema";
import { isUniqueViolation } from "../db/unique-violation";
import { ConflictError } from "../errors/domain-errors";

export type ProjectRow = typeof projects.$inferSelect;
export type NewProjectRow = typeof projects.$inferInsert;

/** All Drizzle access to the table projects owns. */
@Injectable()
export class ProjectsRepository {
  constructor(private readonly database: DbService) {}

  /**
   * Refuses with `ConflictError` when the key is taken. `key` is the table's
   * only unique column, so a refusal here can mean nothing else.
   */
  async create(project: NewProjectRow): Promise<ProjectRow> {
    try {
      const [created] = await this.database.db.insert(projects).values(project).returning();
      if (!created) throw new Error("Inserting a project returned no row");
      return created;
    } catch (error) {
      if (isUniqueViolation(error)) throw new ConflictError("Project key is already taken");
      throw error;
    }
  }

  async findById(id: string): Promise<ProjectRow | undefined> {
    const [project] = await this.database.db
      .select()
      .from(projects)
      .where(eq(projects.id, id))
      .limit(1);
    return project;
  }

  async findByKey(key: string): Promise<ProjectRow | undefined> {
    const [project] = await this.database.db
      .select()
      .from(projects)
      .where(eq(projects.key, key))
      .limit(1);
    return project;
  }

  /**
   * Files a signing secret for a project that has none, and answers with the
   * one that is now there: the caller's if it landed, the one already stored if
   * another request got there first.
   *
   * The `is null` in the predicate is what makes that true under concurrency.
   * Two first uses can race — an action running while the owner reads the
   * secret out of the console is the ordinary case — and a plain update would
   * let the second overwrite the first, leaving a customer application holding
   * a key nothing signs with any more.
   */
  async claimActionSecret(projectId: string, encrypted: string): Promise<string | undefined> {
    const [claimed] = await this.database.db
      .update(projects)
      .set({ actionSecret: encrypted })
      .where(and(eq(projects.id, projectId), isNull(projects.actionSecret)))
      .returning();
    if (claimed?.actionSecret) return claimed.actionSecret;

    return (await this.findById(projectId))?.actionSecret ?? undefined;
  }

  async listByOwner(ownerId: string): Promise<ProjectRow[]> {
    return this.database.db
      .select()
      .from(projects)
      .where(eq(projects.userId, ownerId))
      .orderBy(desc(projects.createdAt));
  }
}
