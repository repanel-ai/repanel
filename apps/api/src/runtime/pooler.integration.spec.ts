import { validateDefinition, type Definition, type DefinitionInput } from "@repanel/contracts";
import {
  ActionRunner,
  CustomerPool,
  HttpCall,
  QueryBuilder,
  RecordReader,
  RecordWriter,
  indexResources,
  type ActionContext,
  type AuditEvent,
} from "@repanel/engine";
import { Client } from "pg";
import { QueryTimeoutError } from "../errors/domain-errors";

/**
 * The engine against a real Postgres reached through a real transaction-mode
 * pooler. Runs only when `TEST_POOLED_CUSTOMER_DATABASE_URL` names one —
 * `docker-compose.yml` and CI both bring up pgbouncer for it.
 *
 * The segment's databases are Neon and Supabase, and both are reached through a
 * pooler by default. What changes there is not performance: a connection is a
 * different server session from one transaction to the next, so anything the
 * engine sets on a session is either refused at connect time or handed on to
 * whoever the pooler lends that session to next. This suite exists because a
 * timeout is a safety property, and a safety property that only holds on a
 * direct connection does not hold (DECISIONS #063).
 *
 * Every object it creates is named `pooled_*` and dropped by name, so the
 * database it is pointed at keeps everything that is not this suite's.
 *
 * This and `runtime.integration.spec.ts` are the only places in `src/` that
 * read `process.env` directly. They are specs rather than features, and the
 * variable configures the suite rather than the API.
 */
const POOLED_DATABASE_URL = process.env.TEST_POOLED_CUSTOMER_DATABASE_URL;
const describeThroughAPooler = POOLED_DATABASE_URL ? describe : describe.skip;

// Three of these cases are a statement being taken back after five seconds, and
// a pooler that lends one server session at a time runs them one after another.
jest.setTimeout(90_000);

const PROJECT = "8c9a3f70-cf4a-48e5-9b85-b3b869c11a11";

const ADA = "aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa";
const SLOW_RECORD = "cccccccc-3333-4333-8333-cccccccccccc";

/**
 * `pooled_molasses` is a table nothing can be written to quickly: its trigger
 * sleeps for twice the limit, so every write path that reaches it has to be
 * taken back by the limit rather than by the test giving up.
 */
const SETUP = `
create table pooled_users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  name text,
  status text not null default 'invited'
);

create table pooled_molasses (
  id uuid primary key,
  name text,
  status text not null default 'active'
);

create function pooled_stall() returns trigger language plpgsql as $$
begin
  perform pg_sleep(10);
  return new;
end;
$$;

create trigger stall before update on pooled_molasses
  for each row execute function pooled_stall();

create view pooled_slow as select pg_sleep(10)::text as id;

insert into pooled_users (id, email, name, status) values
  ('${ADA}', 'ada@acme.test', 'Ada', 'active');

insert into pooled_molasses (id, name, status) values
  ('${SLOW_RECORD}', 'Molasses', 'active');
`;

/** Named one at a time, so nothing this suite did not create can be dropped. */
const TEARDOWN = `
drop view if exists pooled_slow;
drop table if exists pooled_molasses;
drop table if exists pooled_users;
drop function if exists pooled_stall();
`;

const STATUSES = ["invited", "active", "suspended"];

const pooledDefinition: DefinitionInput = {
  schemaVersion: "0.1",
  app: { name: "Pooled" },
  navigation: [{ label: "Pooled", resources: ["pooled_users", "pooled_molasses", "pooled_slow"] }],
  resources: [
    {
      key: "pooled_users",
      label: { singular: "User", plural: "Users" },
      source: { table: "pooled_users" },
      primaryKey: "id",
      labelField: "email",
      writes: { create: true, update: true },
      fields: [
        { key: "id", label: "ID", type: "text" },
        { key: "email", label: "Email", type: "email", editable: true, required: true },
        { key: "name", label: "Name", type: "text", editable: true },
        { key: "status", label: "Status", type: "enum", values: STATUSES },
      ],
      views: {
        table: {
          columns: ["email", "name", "status"],
          defaultSort: { field: "email", direction: "asc" },
          search: ["email"],
        },
        detail: { sections: [{ title: "Account", fields: ["email", "name", "status"] }] },
      },
    },
    {
      key: "pooled_molasses",
      label: { singular: "Molasses", plural: "Molasses" },
      source: { table: "pooled_molasses" },
      primaryKey: "id",
      labelField: "name",
      writes: { update: true },
      fields: [
        { key: "id", label: "ID", type: "text" },
        { key: "name", label: "Name", type: "text", editable: true },
        { key: "status", label: "Status", type: "enum", values: STATUSES },
      ],
      views: {
        table: {
          columns: ["name", "status"],
          defaultSort: { field: "name", direction: "asc" },
        },
        detail: { sections: [{ title: "Record", fields: ["name", "status"] }] },
      },
      actions: [
        {
          key: "suspend",
          kind: "dbUpdate",
          label: "Suspend",
          confirm: "Suspend this record?",
          field: "status",
          value: "suspended",
        },
      ],
    },
    {
      key: "pooled_slow",
      label: { singular: "Slow record", plural: "Slow records" },
      source: { table: "pooled_slow" },
      primaryKey: "id",
      fields: [{ key: "id", label: "ID", type: "text" }],
      views: {
        table: { columns: ["id"], defaultSort: { field: "id", direction: "asc" } },
        detail: { sections: [{ title: "Slow", fields: ["id"] }] },
      },
    },
  ],
};

function validated(input: DefinitionInput): Definition {
  const result = validateDefinition(input);
  if (!result.valid) throw new Error(`the fixture is not valid: ${JSON.stringify(result.errors)}`);
  return result.definition;
}

/** The error a call was refused with; fails the test if it was not refused. */
async function refusalFrom(call: Promise<unknown>): Promise<Error> {
  try {
    await call;
  } catch (error) {
    return error as Error;
  }
  throw new Error("expected the statement to be taken back");
}

describeThroughAPooler("the engine through a transaction-mode pooler", () => {
  const dsn = POOLED_DATABASE_URL ?? "";
  const page = { page: 1, pageSize: 25 };

  let admin: Client;
  let pools: CustomerPool;
  let reader: RecordReader;
  let writer: RecordWriter;
  let runner: ActionRunner;
  let context: ActionContext;
  /** Every event a write path filed, in the order it filed them. */
  const filed: AuditEvent[] = [];

  beforeAll(async () => {
    // The fixtures are laid down through the pooler too: if it cannot be
    // reached at all, this suite says so before it asserts anything.
    admin = new Client({ connectionString: dsn });
    await admin.connect();
    await admin.query(TEARDOWN);
    await admin.query(SETUP);

    const queries = new QueryBuilder();
    reader = new RecordReader(queries);
    writer = new RecordWriter(queries);
    runner = new ActionRunner(reader, queries, new HttpCall());

    pools = new CustomerPool({ resolveDsn: () => Promise.resolve(dsn) });
    context = {
      resources: indexResources(validated(pooledDefinition)),
      pool: () => pools.poolFor(PROJECT),
      audit: (event) => {
        filed.push(event);
        return Promise.resolve();
      },
      // No action here is an `httpCall`, so nothing reads this.
      secret: () => Promise.resolve("unread"),
    };
  });

  afterAll(async () => {
    await pools?.close();
    await admin?.query(TEARDOWN);
    await admin?.end();
  });

  beforeEach(() => {
    filed.length = 0;
  });

  describe("reading", () => {
    it("reads a page at all, which a session parameter would have made impossible", async () => {
      const result = await reader.listRecords(context, "pooled_users", page);

      expect(result.total).toBe(1);
      expect(result.records[0]?.values.email).toBe("ada@acme.test");
    });

    it("reads one record", async () => {
      const record = await reader.getRecord(context, "pooled_users", ADA);

      expect(record.id).toBe(ADA);
      expect(record.values.name).toBe("Ada");
    });
  });

  describe("writing", () => {
    afterEach(async () => {
      await admin.query(`delete from pooled_users where id <> $1`, [ADA]);
      await admin.query(`update pooled_users set name = 'Ada' where id = $1`, [ADA]);
    });

    it("creates a record and answers with it, read back through the same statement", async () => {
      const record = await writer.createRecord(context, "pooled_users", {
        values: { email: "new@acme.test", name: "Nia" },
      });

      expect(record.id).toEqual(expect.any(String));
      expect(record.values.email).toBe("new@acme.test");
      // The column the form did not fill was filled by the database.
      expect(record.values.status).toBe("invited");
    });

    it("updates a record, out of the update's own snapshot", async () => {
      const record = await writer.updateRecord(context, "pooled_users", ADA, {
        values: { name: "Ada II" },
      });

      expect(record.values.name).toBe("Ada II");
      expect(filed).toEqual([
        expect.objectContaining({ outcome: "ok", before: { name: "Ada" }, after: { name: "Ada II" } }),
      ]);
    });
  });

  describe("an action", () => {
    afterEach(async () => {
      await admin.query(`alter table pooled_molasses disable trigger stall`);
      await admin.query(`update pooled_molasses set status = 'active' where id = $1`, [SLOW_RECORD]);
      await admin.query(`alter table pooled_molasses enable trigger stall`);
    });

    it("sets the one column it named, on the one record it named", async () => {
      await admin.query(`alter table pooled_molasses disable trigger stall`);

      const result = await runner.run(context, "pooled_molasses", SLOW_RECORD, "suspend");

      expect(result).toEqual({ ok: true, label: "Suspend" });
      expect(filed).toEqual([
        expect.objectContaining({
          kind: "action",
          actionKey: "suspend",
          outcome: "ok",
          before: { status: "active" },
          after: { status: "suspended" },
        }),
      ]);
    });
  });

  /**
   * The whole point of the suite. Each of these would run to completion on a
   * connection the engine had asked nothing of — the statement asks for ten
   * seconds, and the limit is five.
   */
  describe("the limit", () => {
    it("takes a read back at the limit", async () => {
      const started = Date.now();

      const refusal = await refusalFrom(reader.listRecords(context, "pooled_slow", page));

      expect(refusal).toBeInstanceOf(QueryTimeoutError);
      expect(Date.now() - started).toBeLessThan(9_000);
    });

    it("takes a write back at the limit, and the record it was about is untouched", async () => {
      const refusal = await refusalFrom(
        writer.updateRecord(context, "pooled_molasses", SLOW_RECORD, { values: { name: "Renamed" } }),
      );

      expect(refusal).toBeInstanceOf(QueryTimeoutError);
      expect(filed).toEqual([
        expect.objectContaining({ outcome: "failed", reason: "query_timeout", after: null }),
      ]);

      const { rows } = await admin.query(`select name from pooled_molasses where id = $1`, [
        SLOW_RECORD,
      ]);
      expect(rows[0]?.name).toBe("Molasses");
    });

    it("takes an action back at the limit", async () => {
      const refusal = await refusalFrom(runner.run(context, "pooled_molasses", SLOW_RECORD, "suspend"));

      expect(refusal).toBeInstanceOf(QueryTimeoutError);
      expect(filed).toEqual([
        expect.objectContaining({ kind: "action", outcome: "failed", reason: "query_timeout" }),
      ]);
    });

    /**
     * What the doctrine is for. The pooler lends one server session at a time
     * here, so the session this asks is the session the statement before it ran
     * on — and it is asked directly, outside anything the engine wraps, which is
     * exactly the position the next tenant of that session is in.
     */
    it("leaves nothing of itself on the session it ran on", async () => {
      await reader.getRecord(context, "pooled_users", ADA);

      const pool = await pools.poolFor(PROJECT);
      const { rows } = await pool.query("show statement_timeout");

      expect(rows[0]?.statement_timeout).toBe("0");
    });
  });
});
