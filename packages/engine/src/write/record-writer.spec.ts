import {
  validateDefinition,
  type Definition,
  type DefinitionInput,
  type RecordWrite,
  type Resource,
} from "@repanel/contracts";
import { saasDefinition } from "@repanel/contracts/fixtures";
import type { Pool, PoolClient, QueryResult } from "pg";
import {
  ConflictError,
  NotFoundError,
  QueryTimeoutError,
  ValidationFailedError,
  WriteRefusedError,
} from "../errors.js";
import type { AuditEvent, WriteContext } from "../audit/audit-event.js";
import { QueryBuilder } from "../query/query-builder.js";
import { RecordWriter } from "./record-writer.js";

function definitionFrom(input: DefinitionInput): Definition {
  const result = validateDefinition(structuredClone(input));
  if (!result.valid) {
    throw new Error(`the fixture is not valid:\n${JSON.stringify(result.errors, null, 2)}`);
  }
  return result.definition;
}

const SAAS = definitionFrom(saasDefinition);
const RESOURCES: ReadonlyMap<string, Resource> = new Map(
  SAAS.resources.map((resource) => [resource.key, resource]),
);

/** The same admin over a `users` table whose keys are chosen, not generated. */
const KEYED = definitionFrom({
  ...saasDefinition,
  resources: saasDefinition.resources.map((resource) =>
    resource.key === "users"
      ? {
          ...resource,
          primaryKeyGeneration: "client" as const,
          fields: resource.fields.map((field) =>
            field.key === "id" ? { ...field, editable: true, required: true } : field,
          ),
        }
      : resource,
  ),
});
const KEYED_RESOURCES: ReadonlyMap<string, Resource> = new Map(
  KEYED.resources.map((resource) => [resource.key, resource]),
);

/**
 * The select list `users` answers a write with, by position — `c0`, `c1`, … in
 * the order the resource declares its non-sensitive fields, with the relation's
 * label following the key it belongs to.
 */
const USERS_ALIASES = [
  "id",
  "email",
  "name",
  "status",
  "organization_id",
  "organization_label",
  "is_active",
  "notes",
  "created_at",
  "avatar_url",
  "trial_ends_on",
  "login_count",
  "preferences",
] as const;

function usersRow(values: Partial<Record<(typeof USERS_ALIASES)[number], unknown>>): QueryResult {
  const row: Record<string, unknown> = {};
  USERS_ALIASES.forEach((key, index) => {
    row[`c${index}`] = values[key] ?? null;
  });

  return { rows: [row], fields: [], rowCount: 1, command: "SELECT", oid: 0 } as unknown as QueryResult;
}

const NO_ROWS = { rows: [], fields: [], rowCount: 0, command: "SELECT", oid: 0 } as unknown as QueryResult;

/**
 * The same row, carrying what the columns a write named held before it. They
 * answer under `b0`, `b1`, … in the order the resource declares the fields the
 * write set — the alias space the before-read is built in.
 */
function replacing(result: QueryResult, ...before: unknown[]): QueryResult {
  const [row] = result.rows as Array<Record<string, unknown>>;
  before.forEach((value, index) => {
    if (row) row[`b${index}`] = value;
  });
  return result;
}

/** What the fake pool was asked, so a spec can read the statement it produced. */
interface Asked {
  text: string;
  values: unknown[];
}

function contextThat(
  answer: QueryResult | Error,
  asked: Asked[] = [],
  resources: ReadonlyMap<string, Resource> = RESOURCES,
  file: (event: AuditEvent) => Promise<void> = () => Promise.resolve(),
): WriteContext & { asked: Asked[]; events: AuditEvent[] } {
  // The writer runs its statement inside a transaction of its own
  // (`pool/bounded-statement.ts`), so what it asks the pool for is a client.
  // `begin`, `commit` and `rollback` travel as bare strings and are not what
  // this spec reads: the statement carrying values is.
  const client = {
    query(query: string | { text: string; values: unknown[] }): Promise<QueryResult> {
      if (typeof query === "string") return Promise.resolve(NO_ROWS);

      asked.push({ text: query.text, values: query.values });
      return answer instanceof Error ? Promise.reject(answer) : Promise.resolve(answer);
    },
    release: () => undefined,
  };

  const pool = { connect: () => Promise.resolve(client) } as unknown as Pool;

  const events: AuditEvent[] = [];

  return {
    resources,
    pool: () => Promise.resolve(pool),
    asked,
    events,
    audit: (event) => {
      events.push(event);
      return file(event);
    },
  };
}

function write(values: RecordWrite["values"]): RecordWrite {
  return { values };
}

/** A driver failure carries a code, and sometimes the column it was about. */
function pgError(code: string, column?: string): Error {
  return Object.assign(new Error("driver said something"), { code, column });
}

async function refusalFrom(run: () => Promise<unknown>): Promise<Error> {
  try {
    await run();
  } catch (error) {
    return error as Error;
  }
  throw new Error("expected the writer to refuse");
}

describe("RecordWriter", () => {
  let writer: RecordWriter;

  beforeEach(() => {
    writer = new RecordWriter(new QueryBuilder());
  });

  describe("what the definition offers", () => {
    it("refuses to create a record of a resource that offers no create", async () => {
      const refusal = await refusalFrom(() =>
        writer.createRecord(contextThat(NO_ROWS), "orders", write({ reference: "AC-2" })),
      );

      expect(refusal).toBeInstanceOf(WriteRefusedError);
      expect(refusal.message).toBe(
        "Resource `orders` does not accept new records. It offers: update.",
      );
    });

    it("refuses to write a read-only resource, and says it is read-only", async () => {
      const refusal = await refusalFrom(() =>
        writer.updateRecord(contextThat(NO_ROWS), "organizations", "org_1", write({ name: "X" })),
      );

      expect(refusal).toBeInstanceOf(WriteRefusedError);
      expect(refusal.message).toContain("It is read-only.");
    });

    it("answers a resource this admin does not have the way every route does", async () => {
      const refusal = await refusalFrom(() =>
        writer.createRecord(contextThat(NO_ROWS), "invoices", write({ name: "X" })),
      );

      expect(refusal).toBeInstanceOf(NotFoundError);
    });

    it("reaches no database at all when the definition refuses", async () => {
      const context = contextThat(NO_ROWS);
      await refusalFrom(() => writer.createRecord(context, "orders", write({ reference: "AC" })));

      expect(context.asked).toHaveLength(0);
    });
  });

  describe("what the values have to be", () => {
    it("refuses a value the field cannot hold, at the field's own path", async () => {
      const refusal = (await refusalFrom(() =>
        writer.updateRecord(contextThat(NO_ROWS), "users", "u1", write({ email: 7 })),
      )) as ValidationFailedError;

      expect(refusal).toBeInstanceOf(ValidationFailedError);
      expect(refusal.details).toEqual([expect.objectContaining({ path: "values.email" })]);
    });

    it("refuses a create that leaves out a required field", async () => {
      const refusal = (await refusalFrom(() =>
        writer.createRecord(contextThat(NO_ROWS), "users", write({ name: "Ada" })),
      )) as ValidationFailedError;

      expect(refusal.details.map((detail) => detail.path)).toEqual(["values.email"]);
    });

    it("refuses a create that carries a key the database issues, before any statement runs", async () => {
      const context = contextThat(usersRow({ id: "u1" }));

      const refusal = (await refusalFrom(() =>
        writer.createRecord(context, "users", write({ id: "u_ada", email: "a@b.test", name: "Ada" })),
      )) as ValidationFailedError;

      expect(refusal).toBeInstanceOf(ValidationFailedError);
      expect(refusal.details.map((detail) => detail.path)).toEqual(["values.id"]);
      expect(refusal.details[0]?.hint).toMatch(/"primaryKeyGeneration": "client"/);
      expect(context.asked).toHaveLength(0);
    });

    it("writes the key on a create where the resource says the client issues it", async () => {
      const context = contextThat(usersRow({ id: "u_ada" }), [], KEYED_RESOURCES);

      const record = await writer.createRecord(
        context,
        "users",
        write({ id: "u_ada", email: "a@b.test", name: "Ada" }),
      );

      expect(context.asked[0]?.text).toContain('insert into "users" ("id", "email", "name")');
      expect(context.asked[0]?.values).toEqual(["u_ada", "a@b.test", "Ada"]);
      expect(record.id).toBe("u_ada");
    });

    it("refuses an update that carries a key, even where the client issues keys", async () => {
      const context = contextThat(usersRow({ id: "u1" }), [], KEYED_RESOURCES);

      const refusal = (await refusalFrom(() =>
        writer.updateRecord(context, "users", "u1", write({ id: "u_new" })),
      )) as ValidationFailedError;

      expect(refusal.details[0]?.path).toBe("values.id");
      expect(context.asked).toHaveLength(0);
    });

    it("refuses a field the definition never opened", async () => {
      const refusal = (await refusalFrom(() =>
        writer.updateRecord(contextThat(NO_ROWS), "users", "u1", write({ password_hash: "x" })),
      )) as ValidationFailedError;

      expect(refusal.details[0]?.path).toBe("values.password_hash");
      expect(refusal.details[0]?.hint).not.toMatch(/unset|"sensitive": false/i);
    });

    it("writes nothing when any value is refused", async () => {
      const context = contextThat(NO_ROWS);
      await refusalFrom(() =>
        writer.updateRecord(context, "users", "u1", write({ name: "Ada", email: 7 })),
      );

      expect(context.asked).toHaveLength(0);
    });
  });

  describe("the statement it produces", () => {
    /**
     * A JSON object arrives in whatever order it was written in, and a
     * statement whose text follows the caller's key order is a statement
     * nothing can be asserted against.
     */
    it("writes the columns in the resource's own order, never the caller's", async () => {
      const forwards = contextThat(usersRow({ id: "u1" }));
      const backwards = contextThat(usersRow({ id: "u1" }));

      await writer.createRecord(forwards, "users", write({ email: "a@b.test", name: "Ada" }));
      await writer.createRecord(backwards, "users", write({ name: "Ada", email: "a@b.test" }));

      expect(backwards.asked[0]?.text).toBe(forwards.asked[0]?.text);
      expect(backwards.asked[0]?.text).toContain('insert into "users" ("email", "name")');
      expect(backwards.asked[0]?.values).toEqual(["a@b.test", "Ada"]);
    });

    it("sets only the fields an update named", async () => {
      const context = contextThat(usersRow({ id: "u1" }));

      await writer.updateRecord(context, "users", "u1", write({ notes: "hello" }));

      expect(context.asked[0]?.text).toContain('update "users" set "notes" = $1 where "id" = $2');
      expect(context.asked[0]?.values).toEqual(["hello", "u1"]);
    });

    it("binds a null rather than writing one into the statement", async () => {
      const context = contextThat(usersRow({ id: "u1" }));

      await writer.updateRecord(context, "users", "u1", write({ notes: null }));

      expect(context.asked[0]?.text).toContain('"notes" = $1');
      expect(context.asked[0]?.values).toEqual([null, "u1"]);
    });
  });

  describe("what comes back", () => {
    it("answers a create with the record it wrote, read through the same mapper", async () => {
      const context = contextThat(
        usersRow({
          id: "u1",
          email: "ada@example.test",
          name: "Ada",
          organization_id: "org_1",
          organization_label: "Acme",
          login_count: "12",
        }),
      );

      const record = await writer.createRecord(
        context,
        "users",
        write({ email: "ada@example.test", name: "Ada" }),
      );

      expect(record.id).toBe("u1");
      expect(record.values.email).toBe("ada@example.test");
      expect(record.values.organization_id).toEqual({ id: "org_1", label: "Acme" });
      // `number` comes back a number when it survives the round trip, exactly
      // as it does on a read.
      expect(record.values.login_count).toBe(12);
    });

    it("never carries a sensitive value back out of a write", async () => {
      const context = contextThat(usersRow({ id: "u1", name: "Ada" }));

      const record = await writer.updateRecord(context, "users", "u1", write({ name: "Ada" }));

      expect(record.values).not.toHaveProperty("password_hash");
    });

    it("carries a hidden value back, because a write answers like a detail read", async () => {
      const context = contextThat(usersRow({ id: "u1", preferences: { theme: "dark" } }));

      const record = await writer.updateRecord(context, "users", "u1", write({ name: "Ada" }));

      expect(record.values.preferences).toEqual({ theme: "dark" });
    });

    it("says an update that matched nothing is a record that is not there", async () => {
      const refusal = await refusalFrom(() =>
        writer.updateRecord(contextThat(NO_ROWS), "users", "gone", write({ name: "Ada" })),
      );

      expect(refusal).toBeInstanceOf(NotFoundError);
      expect(refusal.message).toBe("Record not found");
    });
  });

  describe("what the database refuses", () => {
    it("answers a unique violation as a conflict, in nobody's words but ours", async () => {
      const refusal = await refusalFrom(() =>
        writer.createRecord(
          contextThat(pgError("23505")),
          "users",
          write({ email: "taken@example.test", name: "Ada" }),
        ),
      );

      expect(refusal).toBeInstanceOf(ConflictError);
      expect(refusal.message).toBe("Another record already holds one of these values.");
      expect(refusal.message).not.toContain("driver said something");
    });

    it("points a not-null violation at the column the database named", async () => {
      const refusal = (await refusalFrom(() =>
        writer.updateRecord(
          contextThat(pgError("23502", "name")),
          "users",
          "u1",
          write({ name: "Ada", notes: "hello" }),
        ),
      )) as ValidationFailedError;

      expect(refusal.details).toEqual([
        expect.objectContaining({ path: "values.name", message: "This field cannot be empty." }),
      ]);
    });

    it("points a foreign key violation at the relation, when only one was written", async () => {
      const refusal = (await refusalFrom(() =>
        writer.updateRecord(
          contextThat(pgError("23503")),
          "users",
          "u1",
          write({ organization_id: "org_missing" }),
        ),
      )) as ValidationFailedError;

      expect(refusal.details[0]?.path).toBe("values.organization_id");
      expect(refusal.details[0]?.message).toBe("This points at a record that does not exist.");
    });

    it("tells the write as a whole when it cannot know which field was meant", async () => {
      const refusal = (await refusalFrom(() =>
        writer.updateRecord(
          contextThat(pgError("23514")),
          "users",
          "u1",
          write({ name: "Ada", notes: "hello" }),
        ),
      )) as ValidationFailedError;

      expect(refusal.details[0]?.path).toBe("values");
    });

    it("answers a value the column cannot hold without quoting the driver", async () => {
      const refusal = (await refusalFrom(() =>
        writer.updateRecord(contextThat(pgError("22P02")), "users", "u1", write({ name: "Ada" })),
      )) as ValidationFailedError;

      expect(refusal).toBeInstanceOf(ValidationFailedError);
      expect(refusal.details[0]?.path).toBe("values");
      expect(JSON.stringify(refusal.details)).not.toContain("driver said something");
    });

    it("answers a statement timeout the way every other statement does", async () => {
      const refusal = await refusalFrom(() =>
        writer.updateRecord(contextThat(pgError("57014")), "users", "u1", write({ name: "Ada" })),
      );

      expect(refusal).toBeInstanceOf(QueryTimeoutError);
    });

    it("does not pretend to understand a failure it has no category for", async () => {
      const unknown = pgError("08006");
      const refusal = await refusalFrom(() =>
        writer.updateRecord(contextThat(unknown), "users", "u1", write({ name: "Ada" })),
      );

      expect(refusal).toBe(unknown);
    });
  });
  /**
   * Every write leaves an account of itself, and the account is built out of
   * what the statement actually did — which is what makes "a failed write
   * cannot produce an event claiming success" a property of the code rather
   * than a promise (DECISIONS #061).
   */
  describe("what it records", () => {
    it("records a create with the values it wrote, and nothing before them", async () => {
      const context = contextThat(usersRow({ id: "u1", email: "ada@b.test", name: "Ada" }));

      await writer.createRecord(context, "users", write({ email: "ada@b.test", name: "Ada" }));

      expect(context.events).toEqual([
        {
          kind: "create",
          resourceKey: "users",
          recordId: "u1",
          actionKey: null,
          outcome: "ok",
          reason: null,
          before: null,
          after: { email: "ada@b.test", name: "Ada" },
        },
      ]);
    });

    it("records what an update replaced, beside what it put there", async () => {
      const context = contextThat(replacing(usersRow({ id: "u1", notes: "after" }), "before"));

      await writer.updateRecord(context, "users", "u1", write({ notes: "after" }));

      expect(context.events[0]).toMatchObject({
        kind: "update",
        recordId: "u1",
        outcome: "ok",
        before: { notes: "before" },
        after: { notes: "after" },
      });
    });

    /**
     * A read before the write would be a second round trip with a gap in it,
     * and the gap is exactly where somebody else's write lands. One statement's
     * parts all run against one snapshot, so what the CTE reads is what the
     * update replaced (DECISIONS #056).
     */
    it("reads what it replaced in the same statement, not in one before it", async () => {
      const context = contextThat(replacing(usersRow({ id: "u1" }), "before"));

      await writer.updateRecord(context, "users", "u1", write({ notes: "after" }));

      expect(context.asked).toHaveLength(1);
      expect(context.asked[0]?.text).toContain('"b" as (select "t"."notes" as "b0"');
      // Both halves are pointed at the same row by the same placeholder.
      expect(context.asked[0]?.values).toEqual(["after", "u1"]);
    });

    /**
     * The one rule this feature may not bend (DECISIONS #014, #027). It holds
     * because the before-read is built from the columns the write named, and a
     * sensitive column can be neither written nor selected — two walls, and the
     * event is downstream of both.
     */
    it("never names a sensitive column, in the statement or in the event", async () => {
      const context = contextThat(replacing(usersRow({ id: "u1", name: "Ada" }), "Ada senior"));

      await writer.updateRecord(context, "users", "u1", write({ name: "Ada" }));

      expect(context.asked[0]?.text).not.toContain("password_hash");
      expect(Object.keys(context.events[0]?.before ?? {})).toEqual(["name"]);
      expect(Object.keys(context.events[0]?.after ?? {})).toEqual(["name"]);
    });

    it("records the refusal a value was met with, and no values with it", async () => {
      const context = contextThat(NO_ROWS);

      await refusalFrom(() =>
        writer.updateRecord(context, "users", "u1", write({ password_hash: "x" })),
      );

      expect(context.events).toEqual([
        {
          kind: "update",
          resourceKey: "users",
          recordId: "u1",
          actionKey: null,
          outcome: "refused",
          reason: "validation_failed",
          before: null,
          after: null,
        },
      ]);
    });

    it("records a database that refused the write as a refusal, in its own category", async () => {
      const context = contextThat(pgError("23505"));

      await refusalFrom(() =>
        writer.createRecord(context, "users", write({ email: "taken@b.test", name: "Ada" })),
      );

      expect(context.events[0]).toMatchObject({ outcome: "refused", reason: "conflict" });
    });

    it("records a database that ran out of time as a failure, not a refusal", async () => {
      const context = contextThat(pgError("57014"));

      await refusalFrom(() => writer.updateRecord(context, "users", "u1", write({ name: "Ada" })));

      expect(context.events[0]).toMatchObject({ outcome: "failed", reason: "query_timeout" });
    });

    it("files no event claiming success for a write that failed", async () => {
      const context = contextThat(pgError("23505"));

      await refusalFrom(() =>
        writer.createRecord(context, "users", write({ email: "taken@b.test", name: "Ada" })),
      );

      expect(context.events.some((event) => event.outcome === "ok")).toBe(false);
    });

    /**
     * The two live in different databases, so there is no transaction holding
     * them together. What stands in for one is this: the caller is not told the
     * write succeeded until the account of it has been filed.
     */
    it("does not answer a successful write until the event is filed", async () => {
      const unfiled = new Error("the log is down");
      const context = contextThat(usersRow({ id: "u1" }), [], RESOURCES, () =>
        Promise.reject(unfiled),
      );

      const refusal = await refusalFrom(() =>
        writer.createRecord(context, "users", write({ email: "a@b.test", name: "Ada" })),
      );

      expect(refusal).toBe(unfiled);
    });

    /**
     * The other way round, nothing reached the customer's database — so nothing
     * is unaccounted for, and the answer the caller is owed is about their
     * write rather than about our log.
     */
    it("still answers with the write's own failure when the event cannot be filed", async () => {
      const context = contextThat(pgError("23505"), [], RESOURCES, () =>
        Promise.reject(new Error("the log is down")),
      );

      const refusal = await refusalFrom(() =>
        writer.createRecord(context, "users", write({ email: "taken@b.test", name: "Ada" })),
      );

      expect(refusal).toBeInstanceOf(ConflictError);
    });
  });
});
