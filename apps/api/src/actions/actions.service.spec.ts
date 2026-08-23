import { validateDefinition, type DefinitionInput, type ProjectDto } from "@repanel/contracts";
import { saasDefinition } from "@repanel/contracts/fixtures";
import type { Pool, QueryResult } from "pg";
import type { CustomerPoolService } from "../connections/customer-pool.service";
import type { DefinitionDraft } from "../definitions/definitions.mapper";
import type { DefinitionsService } from "../definitions/definitions.service";
import {
  ActionFailedError,
  InvalidQueryError,
  NotFoundError,
  QueryTimeoutError,
} from "../errors/domain-errors";
import type { ProjectsService } from "../projects/projects.service";
import { QueryBuilderService } from "../runtime/query/query-builder.service";
import { RuntimeService } from "../runtime/runtime.service";
import { ActionsService } from "./actions.service";
import type { HttpCallService } from "./http-call.service";

const PROJECT: ProjectDto = {
  id: "8c9a3f70-cf4a-48e5-9b85-b3b869c11a11",
  name: "Crewbase",
  key: "crewbase-a3k9x2",
  createdAt: "2026-08-18T12:00:00.000Z",
};
const OWNER = "0f1e2d3c-4b5a-4988-9776-6655443322aa";
const SECRET = "0DkY6qKcqz3ThQ1lQ1yQmSTQ0Fq0MHQ9Q8oXwq3M2mA";

/** A statement the service sent, and what came back for it. */
interface Statement {
  text: string;
  values: unknown[];
}

/** Stands in for the customer's database: answers whatever a test scripted. */
class FakePool {
  readonly statements: Statement[] = [];
  respond: (text: string) => QueryResult | Error = () => updated(1);

  poolFor(projectId: string): Promise<Pool> {
    if (projectId !== PROJECT.id) {
      return Promise.reject(new NotFoundError("This project has no database connection"));
    }
    return Promise.resolve(this as unknown as Pool);
  }

  query(statement: Statement): Promise<QueryResult> {
    this.statements.push(statement);
    const answer = this.respond(statement.text);
    return answer instanceof Error ? Promise.reject(answer) : Promise.resolve(answer);
  }

  texts(): string[] {
    return this.statements.map((statement) => statement.text);
  }
}

function updated(rowCount: number): QueryResult {
  return { rows: [], fields: [], rowCount, command: "UPDATE" } as unknown as QueryResult;
}

/**
 * One `users` record as the record query selects it: every field in the
 * definition's order, sensitive ones dropped, with a label column following the
 * relation. Only the values a case is about are filled.
 */
function userRow(overrides: Record<number, unknown> = {}): QueryResult {
  const columns = Array.from({ length: 13 }, (_, index) => `c${index}`);
  const values: unknown[] = ["u_1", null, null, null, "o_1", "Northwind Labs", null, null, null, null, null, null, null];
  for (const [index, value] of Object.entries(overrides)) values[Number(index)] = value;

  return {
    rows: [Object.fromEntries(columns.map((name, index) => [name, values[index]]))],
    fields: columns.map((name) => ({ name, dataTypeID: 25 })),
    rowCount: 1,
    command: "SELECT",
  } as unknown as QueryResult;
}

function failure(code: string): Error {
  return Object.assign(new Error("driver said something we do not repeat"), { code });
}

function draftOf(payload: unknown): DefinitionDraft {
  return { payload, valid: true, errors: null, updatedAt: "2026-08-19T09:00:00.000Z" };
}

describe("ActionsService", () => {
  let pool: FakePool;
  let projects: { requireOwnedByKey: jest.Mock; actionSecret: jest.Mock };
  let definitions: { getDraft: jest.Mock };
  let http: { send: jest.Mock };
  let actions: ActionsService;

  beforeEach(() => {
    pool = new FakePool();
    projects = {
      requireOwnedByKey: jest.fn().mockResolvedValue(PROJECT),
      actionSecret: jest.fn().mockResolvedValue(SECRET),
    };
    definitions = { getDraft: jest.fn().mockResolvedValue(draftOf(saasDefinition)) };
    http = { send: jest.fn().mockResolvedValue(undefined) };

    const queries = new QueryBuilderService();
    const runtime = new RuntimeService(
      projects as unknown as ProjectsService,
      definitions as unknown as DefinitionsService,
      pool as unknown as CustomerPoolService,
      queries,
    );
    actions = new ActionsService(
      runtime,
      projects as unknown as ProjectsService,
      queries,
      pool as unknown as CustomerPoolService,
      http as unknown as HttpCallService,
    );
  });

  /** The error a call was refused with; fails the test if it was not refused. */
  async function refusalFrom(call: Promise<unknown>): Promise<Error> {
    try {
      await call;
    } catch (error) {
      return error as Error;
    }
    throw new Error("expected the call to be refused");
  }

  describe("dbUpdate", () => {
    it("sets the field the definition names to the literal it names", async () => {
      const result = await actions.run(OWNER, PROJECT.key, "users", "u_1", "suspend");

      expect(result).toEqual({ ok: true, label: "Suspend" });
      expect(pool.texts()).toEqual([`update "users" set "status" = $1 where "id" = $2`]);
      expect(pool.statements[0]?.values).toEqual(["suspended", "u_1"]);
    });

    it("writes a boolean literal as a boolean", async () => {
      await actions.run(OWNER, PROJECT.key, "users", "u_1", "deactivate");

      expect(pool.statements[0]?.values).toEqual([false, "u_1"]);
    });

    it("quotes the identifiers, so a mixed-case table survives", async () => {
      await actions.run(OWNER, PROJECT.key, "organizations", "o_1", "upgrade_to_pro");

      expect(pool.texts()[0]).toBe(`update "organizations" set "plan" = $1 where "id" = $2`);
      expect(pool.statements[0]?.values).toEqual(["pro", "o_1"]);
    });

    /**
     * An admin that reports success for a record it did not touch is worse than
     * one that fails, because the operator stops looking.
     */
    it("says a record is missing when nothing was updated", async () => {
      pool.respond = () => updated(0);

      const refusal = await refusalFrom(actions.run(OWNER, PROJECT.key, "users", "u_9", "suspend"));

      expect(refusal).toBeInstanceOf(NotFoundError);
      expect(refusal.message).toBe("Record not found");
    });

    it.each([
      ["is not the column's syntax", "22P02"],
      ["is too large for the column", "22003"],
    ])("says the same for an id that %s", async (_case, code) => {
      pool.respond = () => failure(code);

      const refusal = await refusalFrom(
        actions.run(OWNER, PROJECT.key, "users", "not-a-uuid", "suspend"),
      );

      expect(refusal).toBeInstanceOf(NotFoundError);
    });

    it("reports a database that ran out of time as one", async () => {
      pool.respond = () => failure("57014");

      const refusal = await refusalFrom(actions.run(OWNER, PROJECT.key, "users", "u_1", "suspend"));

      expect(refusal).toBeInstanceOf(QueryTimeoutError);
      expect(refusal.message).not.toContain("driver said");
    });

    it("calls nothing out while it writes", async () => {
      await actions.run(OWNER, PROJECT.key, "users", "u_1", "suspend");

      expect(http.send).not.toHaveBeenCalled();
      expect(projects.actionSecret).not.toHaveBeenCalled();
    });

    /**
     * The literal a `dbUpdate` writes is one of the enum's own values, and that
     * is established before the definition is ever stored — `checkDbUpdate` in
     * `@repanel/contracts` refuses anything else. So the runtime binds the
     * definition's literal without checking it, and this is the check it is
     * relying on, exercised where the reliance is.
     */
    it("relies on validation for the value, and validation refuses another", () => {
      const draft = structuredClone(saasDefinition) as DefinitionInput;
      const users = draft.resources[1];
      const suspend = users?.actions?.[0];
      if (!suspend || suspend.kind !== "dbUpdate") throw new Error("the fixture moved");
      suspend.value = "banned";

      const result = validateDefinition(draft);

      expect(result.valid).toBe(false);
      if (result.valid) return;
      const error = result.errors.find((candidate) => candidate.path === "resources[1].actions[0].value");
      expect(error?.message).toBe("`banned` is not one of the values of enum field `status`.");
      expect(error?.expected).toBe("one of: invited, active, suspended");
    });
  });

  describe("httpCall", () => {
    beforeEach(() => {
      pool.respond = () => userRow();
    });

    it("calls the address the definition named, filled from the record it read", async () => {
      const result = await actions.run(OWNER, PROJECT.key, "users", "u_1", "resend_invite");

      expect(result).toEqual({ ok: true, label: "Resend invite" });
      expect(http.send).toHaveBeenCalledWith({
        method: "POST",
        url: "https://api.acme.test/repanel/users/u_1/resend-invite",
        secret: SECRET,
      });
    });

    /**
     * The browser contributes which record and which action, and nothing else.
     * The values that fill the URL are read here, from the customer's database,
     * at the moment the action runs.
     */
    it("reads the record itself rather than trusting anything sent to it", async () => {
      await actions.run(OWNER, PROJECT.key, "users", "u_1", "resend_invite");

      expect(pool.texts()[0]).toContain('from "users" as "t"');
      expect(pool.texts()[0]).toContain('where "t"."id" = $1');
      expect(pool.statements[0]?.values).toEqual(["u_1"]);
      // Never selected, so never available to interpolate.
      expect(pool.texts()[0]).not.toContain("password_hash");
    });

    it("signs with the project's own secret", async () => {
      await actions.run(OWNER, PROJECT.key, "users", "u_1", "resend_invite");

      expect(projects.actionSecret).toHaveBeenCalledWith(PROJECT.id);
    });

    it("writes nothing to the database", async () => {
      await actions.run(OWNER, PROJECT.key, "users", "u_1", "resend_invite");

      expect(pool.texts().some((text) => text.startsWith("update"))).toBe(false);
    });

    it("does not call out for a record that is not there", async () => {
      pool.respond = () =>
        ({ rows: [], fields: [], rowCount: 0, command: "SELECT" }) as unknown as QueryResult;

      const refusal = await refusalFrom(
        actions.run(OWNER, PROJECT.key, "users", "u_9", "resend_invite"),
      );

      expect(refusal).toBeInstanceOf(NotFoundError);
      expect(http.send).not.toHaveBeenCalled();
    });

    it("does not call out for a record that cannot fill the address", async () => {
      // `orders.refund` addresses the order by its reference, and this one has none.
      pool.respond = () =>
        ({
          rows: [{ c0: "o_1001", c1: null, c2: null, c3: null, c4: null, c5: null, c6: null, c7: null }],
          fields: Array.from({ length: 8 }, (_, index) => ({ name: `c${index}`, dataTypeID: 25 })),
          rowCount: 1,
          command: "SELECT",
        }) as unknown as QueryResult;

      const refusal = await refusalFrom(
        actions.run(OWNER, PROJECT.key, "orders", "o_1001", "refund"),
      );

      expect(refusal).toBeInstanceOf(InvalidQueryError);
      expect(refusal.message).toBe("Action `Refund` needs a value for `reference`, and this order has none.");
      expect(http.send).not.toHaveBeenCalled();
    });

    it("passes a failure from the application on as it is", async () => {
      const refused = new ActionFailedError("action_rejected", "The application answered 422.");
      http.send.mockRejectedValue(refused);

      const refusal = await refusalFrom(
        actions.run(OWNER, PROJECT.key, "users", "u_1", "resend_invite"),
      );

      expect(refusal).toBe(refused);
    });
  });

  describe("what it will not run", () => {
    it("has no action a resource does not declare, and says which it has", async () => {
      const refusal = await refusalFrom(actions.run(OWNER, PROJECT.key, "users", "u_1", "delete"));

      expect(refusal).toBeInstanceOf(NotFoundError);
      expect(refusal.message).toBe(
        "Resource `users` has no action `delete`. Actions: suspend, deactivate, resend_invite.",
      );
      expect(pool.statements).toEqual([]);
    });

    it("has no resource this admin does not declare", async () => {
      const refusal = await refusalFrom(actions.run(OWNER, PROJECT.key, "invoices", "i_1", "void"));

      expect(refusal).toBeInstanceOf(NotFoundError);
      expect(refusal.message).toContain("has no resource `invoices`");
    });

    it("asks whether this owner has the project before anything else", async () => {
      projects.requireOwnedByKey.mockRejectedValue(new NotFoundError("Project not found"));

      const refusal = await refusalFrom(actions.run(OWNER, PROJECT.key, "users", "u_1", "suspend"));

      expect(refusal).toBeInstanceOf(NotFoundError);
      expect(refusal.message).toBe("Project not found");
      expect(pool.statements).toEqual([]);
      expect(http.send).not.toHaveBeenCalled();
    });

    it("runs nothing against a project whose definition does not validate", async () => {
      definitions.getDraft.mockResolvedValue(draftOf({ schemaVersion: "0.1" }));

      const refusal = await refusalFrom(actions.run(OWNER, PROJECT.key, "users", "u_1", "suspend"));

      expect(refusal).toBeInstanceOf(NotFoundError);
      expect(pool.statements).toEqual([]);
    });
  });
});
