import {
  validateDefinition,
  type Definition,
  type DefinitionInput,
  type RecordWrite,
  type Resource,
} from "@repanel/contracts";
import { saasDefinition } from "@repanel/contracts/fixtures";
import type { Pool, QueryResult } from "pg";
import {
  ConflictError,
  NotFoundError,
  QueryTimeoutError,
  ValidationFailedError,
  WriteRefusedError,
} from "../errors.js";
import { QueryBuilder } from "../query/query-builder.js";
import type { ReadContext } from "../read/record-reader.js";
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

/** What the fake pool was asked, so a spec can read the statement it produced. */
interface Asked {
  text: string;
  values: unknown[];
}

function contextThat(
  answer: QueryResult | Error,
  asked: Asked[] = [],
): ReadContext & { asked: Asked[] } {
  const pool = {
    query(query: { text: string; values: unknown[] }): Promise<QueryResult> {
      asked.push({ text: query.text, values: query.values });
      return answer instanceof Error ? Promise.reject(answer) : Promise.resolve(answer);
    },
  } as unknown as Pool;

  return { resources: RESOURCES, pool: () => Promise.resolve(pool), asked };
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
});
