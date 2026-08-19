import { validateDefinition, type ProjectDto } from "@repanel/contracts";
import { saasDefinition } from "@repanel/contracts/fixtures";
import type { Pool, QueryResult } from "pg";
import type { CustomerPoolService } from "../connections/customer-pool.service";
import type { DefinitionDraft } from "../definitions/definitions.mapper";
import type { DefinitionsService } from "../definitions/definitions.service";
import { InvalidQueryError, NotFoundError, QueryTimeoutError } from "../errors/domain-errors";
import type { ProjectsService } from "../projects/projects.service";
import { QueryBuilderService } from "./query/query-builder.service";
import { RuntimeService } from "./runtime.service";

const PROJECT: ProjectDto = {
  id: "8c9a3f70-cf4a-48e5-9b85-b3b869c11a11",
  name: "SkyScout",
  key: "skyscout-a3k9x2",
  createdAt: "2026-08-18T12:00:00.000Z",
};
const OWNER = "0f1e2d3c-4b5a-4988-9776-6655443322aa";

/** A statement the service sent, and what came back for it. */
interface Statement {
  text: string;
  values: unknown[];
}

/** Stands in for the customer's database: answers whatever a test scripted. */
class FakePool {
  readonly statements: Statement[] = [];
  respond: (text: string) => QueryResult | Error = () => rows([], []);

  poolFor(): Promise<Pool> {
    return Promise.resolve(this as unknown as Pool);
  }

  query(statement: Statement): Promise<QueryResult> {
    this.statements.push(statement);
    const answer = this.respond(statement.text);
    return answer instanceof Error ? Promise.reject(answer) : Promise.resolve(answer);
  }

  /** The statements sent, in order, with whitespace kept as written. */
  texts(): string[] {
    return this.statements.map((statement) => statement.text);
  }
}

function rows(names: string[], values: unknown[][]): QueryResult {
  return {
    rows: values.map((row) => Object.fromEntries(names.map((name, index) => [name, row[index]]))),
    fields: names.map((name) => ({ name, dataTypeID: 25 })),
    rowCount: values.length,
    command: "SELECT",
  } as unknown as QueryResult;
}

function count(total: number): QueryResult {
  return rows(["total"], [[String(total)]]);
}

function failure(code: string): Error {
  return Object.assign(new Error("driver said something we do not repeat"), { code });
}

function draftOf(payload: unknown, valid = true): DefinitionDraft {
  return { payload, valid, errors: null, updatedAt: "2026-08-19T09:00:00.000Z" };
}

describe("RuntimeService", () => {
  let pool: FakePool;
  let projects: { requireOwnedByKey: jest.Mock };
  let definitions: { getDraft: jest.Mock };
  let runtime: RuntimeService;

  beforeEach(() => {
    pool = new FakePool();
    projects = { requireOwnedByKey: jest.fn().mockResolvedValue(PROJECT) };
    definitions = { getDraft: jest.fn().mockResolvedValue(draftOf(saasDefinition)) };
    runtime = new RuntimeService(
      projects as unknown as ProjectsService,
      definitions as unknown as DefinitionsService,
      pool as unknown as CustomerPoolService,
      new QueryBuilderService(),
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

  describe("definitionFor", () => {
    it("answers with the definition as validation makes it, defaults and all", async () => {
      const definition = await runtime.definitionFor(OWNER, PROJECT.key);

      expect(definition.resources[0]?.readOnly).toBe(true);
      expect(definition.resources[0]?.actions).toHaveLength(1);
    });

    it("asks whether this owner has the project before reading anything", async () => {
      await runtime.definitionFor(OWNER, PROJECT.key);

      expect(projects.requireOwnedByKey).toHaveBeenCalledWith(PROJECT.key, OWNER);
    });

    it("does not answer for a project this owner does not have", async () => {
      projects.requireOwnedByKey.mockRejectedValue(new NotFoundError("Project not found"));

      const refusal = await refusalFrom(runtime.definitionFor(OWNER, PROJECT.key));

      expect(refusal).toBeInstanceOf(NotFoundError);
      expect(definitions.getDraft).not.toHaveBeenCalled();
    });

    it("says there is nothing to render when nothing has been submitted", async () => {
      definitions.getDraft.mockResolvedValue(null);

      const refusal = await refusalFrom(runtime.definitionFor(OWNER, PROJECT.key));

      expect(refusal).toBeInstanceOf(NotFoundError);
      expect(refusal.message).toBe("This project has no valid definition yet");
    });

    it("says the same when what was submitted does not validate", async () => {
      definitions.getDraft.mockResolvedValue(draftOf({ schemaVersion: "0.1" }, false));

      const refusal = await refusalFrom(runtime.definitionFor(OWNER, PROJECT.key));

      expect(refusal).toBeInstanceOf(NotFoundError);
    });
  });

  describe("listRecords", () => {
    beforeEach(() => {
      pool.respond = (text) =>
        text.includes("count(*)")
          ? count(42)
          : rows(["c0", "c1", "c2", "c3", "c4", "c5", "c6"], [
              ["ada@acme.test", "Ada", "active", "org-1", "Acme", null, "user-1"],
            ]);
    });

    it("answers with a page, and a total that is a number", async () => {
      const page = await runtime.listRecords(OWNER, PROJECT.key, "users", { page: 2, pageSize: 10 });

      expect(page.total).toBe(42);
      expect(page.page).toBe(2);
      expect(page.pageSize).toBe(10);
      expect(page.records).toEqual([
        {
          id: "user-1",
          values: {
            email: "ada@acme.test",
            name: "Ada",
            status: "active",
            organization_id: { id: "org-1", label: "Acme" },
            created_at: null,
            id: "user-1",
          },
        },
      ]);
    });

    it("asks for the rows and the count, and nothing else", async () => {
      await runtime.listRecords(OWNER, PROJECT.key, "users", { page: 1, pageSize: 25 });

      expect(pool.texts()).toHaveLength(2);
      expect(pool.texts().filter((text) => text.includes("count(*)"))).toHaveLength(1);
    });

    it("says which resources there are when asked for one there is not", async () => {
      const refusal = await refusalFrom(
        runtime.listRecords(OWNER, PROJECT.key, "invoices", { page: 1, pageSize: 25 }),
      );

      expect(refusal).toBeInstanceOf(NotFoundError);
      expect(refusal.message).toBe(
        "This admin has no resource `invoices`. Resources: organizations, users, orders.",
      );
    });

    it("answers a statement that ran out of time as a timeout, in our own words", async () => {
      pool.respond = () => failure("57014");

      const refusal = await refusalFrom(runtime.listRecords(OWNER, PROJECT.key, "users", { page: 1, pageSize: 25 }));

      expect(refusal).toBeInstanceOf(QueryTimeoutError);
      expect(refusal.message).toBe("The database took too long to answer this query.");
      expect(refusal.message).not.toContain("driver said");
    });

    it("answers a filter value the column cannot read as a bad request", async () => {
      pool.respond = () => failure("22P02");

      const refusal = await refusalFrom(
        runtime.listRecords(OWNER, PROJECT.key, "users", {
          page: 1,
          pageSize: 25,
          filter: { organization_id: "not-a-uuid" },
        }),
      );

      expect(refusal).toBeInstanceOf(InvalidQueryError);
      expect(refusal.message).not.toContain("driver said");
    });
  });

  describe("getRecord", () => {
    it("answers with the one record it found", async () => {
      pool.respond = () =>
        rows(["c0", "c1", "c2", "c3", "c4", "c5"], [["org-1", "Acme", "pro", "billing@acme.test", {}, null]]);

      const record = await runtime.getRecord(OWNER, PROJECT.key, "organizations", "org-1");

      expect(record.id).toBe("org-1");
      expect(record.values.settings).toEqual({});
    });

    it("says a record is missing when nothing came back", async () => {
      pool.respond = () => rows([], []);

      const refusal = await refusalFrom(runtime.getRecord(OWNER, PROJECT.key, "users", "user-9"));

      expect(refusal).toBeInstanceOf(NotFoundError);
      expect(refusal.message).toBe("Record not found");
    });

    it("says the same for an id the primary key's type cannot read", async () => {
      pool.respond = () => failure("22P02");

      const refusal = await refusalFrom(runtime.getRecord(OWNER, PROJECT.key, "users", "not-a-uuid"));

      // Not a bad request: the id named no record, which is what a 404 says.
      expect(refusal).toBeInstanceOf(NotFoundError);
    });
  });

  describe("listRelated", () => {
    it("reads a hasMany page out of the target, narrowed by the record it hangs off", async () => {
      pool.respond = (text) => {
        if (text.includes('as "c0" from "users"')) return rows(["c0"], [["user-1"]]);
        if (text.includes("count(*)")) return count(2);
        return rows(["c0", "c1", "c2", "c3", "c4", "c5", "c6"], []);
      };

      const page = await runtime.listRelated(OWNER, PROJECT.key, "users", "user-1", "orders", {
        page: 1,
        pageSize: 25,
      });

      expect(page.total).toBe(2);
      // The parent is read first, then the target's own list is narrowed.
      expect(pool.texts()[0]).toContain('from "users" as "t" where "t"."id" = $1');
      expect(pool.texts()[1]).toContain('from "orders" as "t"');
      expect(pool.texts()[1]).toContain('where "t"."user_id" = $1');
      expect(pool.statements[1]?.values[0]).toBe("user-1");
    });

    it("reads a belongsTo page by following the key the record holds", async () => {
      pool.respond = (text) => {
        if (text.includes('"t"."organization_id" as "c0"')) return rows(["c0"], [["org-7"]]);
        if (text.includes("count(*)")) return count(1);
        return rows(["c0", "c1", "c2", "c3", "c4"], [["Acme", "pro", "billing@acme.test", null, "org-7"]]);
      };

      const page = await runtime.listRelated(OWNER, PROJECT.key, "users", "user-1", "organization", {
        page: 1,
        pageSize: 25,
      });

      expect(page.total).toBe(1);
      expect(pool.texts()[1]).toContain('from "organizations" as "t"');
      expect(pool.texts()[1]).toContain('where "t"."id" = $1');
      expect(pool.statements[1]?.values[0]).toBe("org-7");
    });

    it("answers an empty page for a record that points at nothing", async () => {
      pool.respond = () => rows(["c0"], [[null]]);

      const page = await runtime.listRelated(OWNER, PROJECT.key, "users", "user-1", "organization", {
        page: 1,
        pageSize: 25,
      });

      expect(page).toEqual({ records: [], total: 0, page: 1, pageSize: 25 });
      // Nothing to point at is not a reason to go and ask.
      expect(pool.texts()).toHaveLength(1);
    });

    it("says a record is missing rather than answering an empty page for it", async () => {
      pool.respond = () => rows([], []);

      const refusal = await refusalFrom(
        runtime.listRelated(OWNER, PROJECT.key, "users", "user-9", "orders", { page: 1, pageSize: 25 }),
      );

      expect(refusal).toBeInstanceOf(NotFoundError);
    });

    it("says which relationships there are when asked for one there is not", async () => {
      const refusal = await refusalFrom(
        runtime.listRelated(OWNER, PROJECT.key, "users", "user-1", "invoices", { page: 1, pageSize: 25 }),
      );

      expect(refusal).toBeInstanceOf(NotFoundError);
      expect(refusal.message).toBe(
        "Resource `users` has no relationship `invoices`. Relationships: organization, orders.",
      );
    });

    it("allowlists a related page against the target rather than the record's own resource", async () => {
      pool.respond = () => rows(["c0"], [["user-1"]]);

      const refusal = await refusalFrom(
        runtime.listRelated(OWNER, PROJECT.key, "users", "user-1", "orders", {
          page: 1,
          pageSize: 25,
          // A field of `users`, which is not what this page is made of.
          sort: "notes",
        }),
      );

      expect(refusal).toBeInstanceOf(InvalidQueryError);
      expect(refusal.message).toContain("Cannot sort resource `orders` by `notes`");
    });
  });
});
