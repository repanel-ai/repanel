import type { UserDto } from "@repanel/contracts";
import { saasDefinition } from "@repanel/contracts/fixtures";
import { ActionRunner, HttpCall, QueryBuilder, RecordReader } from "@repanel/engine";
import type { Pool, QueryResult } from "pg";
import { ActionsService } from "../actions/actions.service";
import type { CustomerPoolService } from "../connections/customer-pool.service";
import type { DefinitionsService } from "../definitions/definitions.service";
import { NotFoundError } from "../errors/domain-errors";
import { PeopleService } from "../projects/people.service";
import type { ProjectsRepository } from "../projects/projects.repository";
import { ProjectsService } from "../projects/projects.service";
import {
  InMemoryAccounts,
  InMemoryProjectsRepository,
} from "../projects/projects.test-helpers";
import { RuntimeService } from "../runtime/runtime.service";
import { ActivityRepository, type NewAuditEventRow } from "./activity.repository";
import { ActivityService } from "./activity.service";

/**
 * Whose name is on a write, when the person who made it is not the owner.
 *
 * This is the end of task 028 met by task 029: the audit log was built to say
 * who did something, and until operators existed the answer was always the same
 * person. It runs the whole path — membership, the definition, the statement,
 * the event — because the question is exactly whether the identity survives it.
 */

const ADA = "user-ada";

/** What the query builder hands the driver, as much of it as this spec reads. */
interface Statement {
  text: string;
  values: unknown[];
}

/** Answers a `dbUpdate` the way Postgres does: the column on both sides. */
class OneUpdate {
  readonly statements: Statement[] = [];

  poolFor(): Promise<Pool> {
    return Promise.resolve(this as unknown as Pool);
  }

  query(statement: Statement): Promise<QueryResult> {
    this.statements.push(statement);
    return Promise.resolve({
      rows: [{ c0: "suspended", b0: "active" }],
      fields: [],
      rowCount: 1,
      command: "SELECT",
    } as unknown as QueryResult);
  }
}

/** The audit table, in memory, exactly as far as this spec reads it. */
class InMemoryActivityRepository implements Pick<ActivityRepository, "insert"> {
  readonly rows: NewAuditEventRow[] = [];

  insert(event: NewAuditEventRow): Promise<never> {
    this.rows.push(event);
    return Promise.resolve(event as never);
  }
}

describe("an operator's action, in the log", () => {
  let repository: InMemoryProjectsRepository;
  let accounts: InMemoryAccounts;
  let audit: InMemoryActivityRepository;
  let people: PeopleService;
  let projects: ProjectsService;
  let actions: ActionsService;
  let operator: UserDto;
  let projectKey: string;
  let projectId: string;

  beforeEach(async () => {
    repository = new InMemoryProjectsRepository();
    accounts = new InMemoryAccounts();
    audit = new InMemoryActivityRepository();

    projects = new ProjectsService(repository as unknown as ProjectsRepository, {} as never);
    people = new PeopleService(
      projects,
      repository as unknown as ProjectsRepository,
      accounts as unknown as never,
    );

    accounts.accounts.push({ id: ADA, email: "ada@example.com", name: "Ada" });
    const project = await projects.create(ADA, { name: "Crewbase" });
    projectKey = project.key;
    projectId = project.id;

    const added = await people.addOperator(ADA, projectId, {
      email: "ravi@example.com",
      name: "Ravi",
    });
    operator = { id: added.person.userId, email: added.person.email, name: added.person.name };

    const queries = new QueryBuilder();
    const reader = new RecordReader(queries);
    const runtime = new RuntimeService(
      projects,
      {
        getPublished: () =>
          Promise.resolve({
            payload: saasDefinition,
            version: 1,
            publishedAt: "2026-08-26T09:00:00.000Z",
          }),
      } as unknown as DefinitionsService,
      new OneUpdate() as unknown as CustomerPoolService,
      reader,
    );
    actions = new ActionsService(
      runtime,
      projects,
      new ActivityService(projects, audit as unknown as ActivityRepository),
      new ActionRunner(reader, queries, new HttpCall()),
    );
  });

  it("records the operator who ran it, not the owner who let them in", async () => {
    const result = await actions.run(operator, projectKey, "users", "u_1", "suspend");

    expect(result).toEqual({ ok: true, label: "Suspend" });
    expect(audit.rows).toHaveLength(1);
    expect(audit.rows[0]).toMatchObject({
      projectId,
      actorUserId: operator.id,
      actorEmail: "ravi@example.com",
      resourceKey: "users",
      recordPk: "u_1",
      kind: "action",
      actionKey: "suspend",
      outcome: "ok",
    });
    expect(audit.rows[0]?.actorUserId).not.toBe(ADA);
  });

  it("keeps the address they were called by at the time, not the owner's", async () => {
    await actions.run(operator, projectKey, "users", "u_1", "suspend");

    expect(audit.rows[0]?.actorEmail).not.toBe("ada@example.com");
  });

  it("has nothing to record once they have been revoked", async () => {
    await people.revoke(ADA, projectId, operator.id);

    const running = actions.run(operator, projectKey, "users", "u_1", "suspend");

    await expect(running).rejects.toBeInstanceOf(NotFoundError);
    expect(audit.rows).toEqual([]);
  });
});
