import { Injectable } from "@nestjs/common";
import { desc, eq } from "drizzle-orm";
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

  async listByOwner(ownerId: string): Promise<ProjectRow[]> {
    return this.database.db
      .select()
      .from(projects)
      .where(eq(projects.userId, ownerId))
      .orderBy(desc(projects.createdAt));
  }
}
