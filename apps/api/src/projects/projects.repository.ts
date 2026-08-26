import { Injectable } from "@nestjs/common";
import type { ProjectRole } from "@repanel/contracts";
import { and, asc, desc, eq, isNull } from "drizzle-orm";
import { DbService } from "../db/db.service";
import { projectMembers, projects } from "../db/schema";
import { isUniqueViolation } from "../db/unique-violation";
import { ConflictError } from "../errors/domain-errors";

export type ProjectRow = typeof projects.$inferSelect;
export type NewProjectRow = typeof projects.$inferInsert;
export type ProjectMemberRow = typeof projectMembers.$inferSelect;
export type NewProjectMemberRow = typeof projectMembers.$inferInsert;

/** A project, and what the person who asked for it may do there. */
export interface MembershipRow {
  project: ProjectRow;
  role: ProjectRole;
}

/** All Drizzle access to the tables the projects feature owns. */
@Injectable()
export class ProjectsRepository {
  constructor(private readonly database: DbService) {}

  /**
   * Files a project and the membership that makes its creator its owner, in one
   * transaction. Both or neither: a project whose owner row never landed is a
   * project nobody can reach, and the console has no way to say so.
   *
   * Refuses with `ConflictError` when the key is taken. `key` is the only
   * unique column either statement can collide on — the membership is a fresh
   * project id and one user — so a refusal here can mean nothing else.
   */
  async create(project: NewProjectRow): Promise<ProjectRow> {
    try {
      return await this.database.db.transaction(async (tx) => {
        const [created] = await tx.insert(projects).values(project).returning();
        if (!created) throw new Error("Inserting a project returned no row");

        await tx
          .insert(projectMembers)
          .values({ projectId: created.id, userId: created.userId, role: "owner" });

        return created;
      });
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

  /**
   * The project this person may reach, and the role they reach it with. One
   * round trip, and nothing to answer with when either half is missing: a
   * project that does not exist and a project they are not on are the same
   * `undefined` here, because they are the same answer to the caller.
   */
  async findMembership(projectId: string, userId: string): Promise<MembershipRow | undefined> {
    const [found] = await this.database.db
      .select({ project: projects, role: projectMembers.role })
      .from(projectMembers)
      .innerJoin(projects, eq(projects.id, projectMembers.projectId))
      .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, userId)))
      .limit(1);
    return found;
  }

  /** The same answer, for the key the runtime routes by. */
  async findMembershipByKey(key: string, userId: string): Promise<MembershipRow | undefined> {
    const [found] = await this.database.db
      .select({ project: projects, role: projectMembers.role })
      .from(projectMembers)
      .innerJoin(projects, eq(projects.id, projectMembers.projectId))
      .where(and(eq(projects.key, key), eq(projectMembers.userId, userId)))
      .limit(1);
    return found;
  }

  /** Everything this person may reach, newest project first. */
  async listMembershipsByUser(userId: string): Promise<MembershipRow[]> {
    return this.database.db
      .select({ project: projects, role: projectMembers.role })
      .from(projectMembers)
      .innerJoin(projects, eq(projects.id, projectMembers.projectId))
      .where(eq(projectMembers.userId, userId))
      .orderBy(desc(projects.createdAt));
  }

  /** Everyone on a project, in the order they arrived — which puts the owner first. */
  async listMembers(projectId: string): Promise<ProjectMemberRow[]> {
    return this.database.db
      .select()
      .from(projectMembers)
      .where(eq(projectMembers.projectId, projectId))
      .orderBy(asc(projectMembers.createdAt));
  }

  /**
   * Puts somebody on a project. The unique constraint is the last word on who
   * is already there: two concurrent adds both clear the service's check, and
   * the one Postgres refuses must read as a conflict rather than a failure.
   */
  async addMember(member: NewProjectMemberRow): Promise<ProjectMemberRow> {
    try {
      const [added] = await this.database.db.insert(projectMembers).values(member).returning();
      if (!added) throw new Error("Inserting a project member returned no row");
      return added;
    } catch (error) {
      if (isUniqueViolation(error)) throw new ConflictError("They are already on this project");
      throw error;
    }
  }

  /** Takes somebody off a project. Deleting the row is the whole of revoking. */
  async removeMember(projectId: string, userId: string): Promise<void> {
    await this.database.db
      .delete(projectMembers)
      .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, userId)));
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
}
