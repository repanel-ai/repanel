import {
  validateDefinition,
  type DefinitionInput,
  type Field,
  type ProjectDto,
  type Resource,
} from "@repanel/contracts";
import { saasDefinition } from "@repanel/contracts/fixtures";
import { QueryBuilder, RecordReader, RecordWriter } from "@repanel/engine";
import { prismaDefinition } from "@repanel/engine/fixtures";
import { Client } from "pg";
import type { ConfigService } from "../config/config.service";
import { ConnectionProbeService } from "../connections/connection-probe.service";
import type { ConnectionRow, ConnectionsRepository } from "../connections/connections.repository";
import { CustomerPoolService } from "../connections/customer-pool.service";
import { CryptoService } from "../crypto/crypto.service";
import type { DefinitionsService } from "../definitions/definitions.service";
import {
  ConflictError,
  InvalidQueryError,
  NotFoundError,
  QueryTimeoutError,
  ValidationFailedError,
  WriteRefusedError,
} from "../errors/domain-errors";
import { RecordsService } from "../records/records.service";
import type { ProjectsService } from "../projects/projects.service";
import { RuntimeService } from "./runtime.service";

/**
 * The query engine against a real Postgres. Runs only when
 * `TEST_CUSTOMER_DATABASE_URL` names a database to run it against, because
 * everything here is about what the driver and the server actually do —
 * identifier folding, the types values come back as, the statement timeout —
 * and none of that can be asserted against a stub.
 *
 * The database it is given is not left alone: the suite creates a schema of its
 * own, fills it, and drops it. Scoping the customer connection's `search_path`
 * to that schema is what keeps `users` here from meaning anyone's real `users`.
 *
 * This is the only place in `src/` that reads `process.env` directly. It is a
 * spec rather than a feature, and the variable configures the suite rather than
 * the API.
 */
const CUSTOMER_DATABASE_URL = process.env.TEST_CUSTOMER_DATABASE_URL;
const describeAgainstPostgres = CUSTOMER_DATABASE_URL ? describe : describe.skip;

// The pool gives a statement five seconds, so the timeout case cannot fit in
// jest's default of five. The table-building hooks run against a real, possibly
// remote database and share the same budget.
jest.setTimeout(30_000);

const SCHEMA = "repanel_runtime_spec";

const PROJECT: ProjectDto = {
  id: "8c9a3f70-cf4a-48e5-9b85-b3b869c11a11",
  name: "Crewbase",
  key: "crewbase-a3k9x2",
  createdAt: "2026-08-18T12:00:00.000Z",
};
const OWNER = "0f1e2d3c-4b5a-4988-9776-6655443322aa";

const ACME = "11111111-1111-4111-8111-111111111111";
const BETA = "22222222-2222-4222-8222-222222222222";
const ADA = "aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa";
const BOB = "bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb";
const CY = "cccccccc-3333-4333-8333-cccccccccccc";

const SETUP = `
create schema ${SCHEMA};

create table ${SCHEMA}.organizations (
  id uuid primary key,
  name text not null,
  plan text not null,
  billing_email text,
  settings jsonb,
  created_at timestamptz not null
);

-- Written the way an application that invites its users writes it: the columns
-- a form does not fill have defaults, and the password arrives when the person
-- does. A column with neither is a column an admin cannot create around.
create table ${SCHEMA}.users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  name text,
  status text not null default 'invited',
  password_hash text,
  organization_id uuid references ${SCHEMA}.organizations(id),
  is_active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  avatar_url text,
  trial_ends_on date,
  login_count integer not null default 0,
  preferences jsonb
);

create table ${SCHEMA}.orders (
  id uuid primary key,
  reference text not null,
  user_id uuid references ${SCHEMA}.users(id),
  status text not null,
  total_cents bigint not null,
  metadata jsonb,
  placed_at timestamptz not null
);

-- Prisma writes tables and columns like this, and Postgres folds an unquoted
-- identifier to lower case, so nothing here is readable unless it is quoted.
create table ${SCHEMA}."Team" (
  id text primary key,
  "displayName" text not null,
  "seatCount" integer not null
);

create table ${SCHEMA}."User" (
  id text primary key,
  email text not null,
  "avatarUrl" text,
  "teamId" text references ${SCHEMA}."Team"(id),
  "signedUpOn" date,
  "createdAt" timestamp not null
);

create view ${SCHEMA}.slow_records as select pg_sleep(10)::text || 'x' as id;

insert into ${SCHEMA}.organizations (id, name, plan, billing_email, settings, created_at) values
  ('${ACME}', 'Acme', 'pro', 'billing@acme.test', '{"seats":40}', '2026-01-05T09:00:00Z'),
  ('${BETA}', 'Beta', 'free', 'billing@beta.test', '{"seats":3}', '2026-02-05T09:00:00Z');

insert into ${SCHEMA}.users (id, email, name, status, password_hash, organization_id, is_active, notes, created_at, avatar_url, trial_ends_on, login_count, preferences) values
  ('${ADA}', 'ada@acme.test', 'Ada', 'active', 'scrypt$do-not-leak', '${ACME}', true, 'founding user', '2026-03-01T09:00:00Z', 'https://cdn.acme.test/ada.png', '2026-09-30', 1284, '{"theme":"dark"}'),
  ('${BOB}', 'bob@acme.test', 'Bob', 'suspended', 'scrypt$do-not-leak', '${ACME}', false, null, '2026-02-01T09:00:00Z', null, null, 12, null),
  ('${CY}', 'cy@beta.test', 'Cy', 'invited', 'scrypt$do-not-leak', null, true, '50% trial', '2026-01-01T09:00:00Z', null, null, 0, null);

insert into ${SCHEMA}.orders (id, reference, user_id, status, total_cents, metadata, placed_at) values
  ('dddddddd-1111-4111-8111-dddddddddddd', 'REF-1', '${ADA}', 'paid', 1050, '{"channel":"web"}', '2026-03-02T09:00:00Z'),
  ('dddddddd-2222-4222-8222-dddddddddddd', 'REF-2', '${ADA}', 'pending', 2000, null, '2026-03-03T09:00:00Z'),
  ('dddddddd-3333-4333-8333-dddddddddddd', 'REF-3', '${BOB}', 'refunded', 300, null, '2026-03-04T09:00:00Z');

insert into ${SCHEMA}."Team" (id, "displayName", "seatCount") values ('team-1', 'Platform', 12);

insert into ${SCHEMA}."User" (id, email, "avatarUrl", "teamId", "signedUpOn", "createdAt") values
  ('user-1', 'ada@acme.test', 'https://cdn.acme.test/ada.png', 'team-1', '2026-01-01', '2026-08-19 10:00:00');
`;

/** One resource out of a fixture, as validation makes it: defaults applied. */
function resourceIn(input: DefinitionInput, key: string): Resource {
  const result = validateDefinition(input);
  if (!result.valid) throw new Error(`the fixture is not valid: ${JSON.stringify(result.errors)}`);
  const resource = result.definition.resources.find((candidate) => candidate.key === key);
  if (!resource) throw new Error(`the fixture has no resource \`${key}\``);
  return resource;
}

function fieldOf(resource: Resource, key: string): Field {
  const field = resource.fields.find((candidate) => candidate.key === key);
  if (!field) throw new Error(`\`${resource.key}\` has no field \`${key}\``);
  return field;
}

/** The same database, seen only through the schema this spec owns. */
function scopedTo(dsn: string, schema: string): string {
  const separator = dsn.includes("?") ? "&" : "?";
  return `${dsn}${separator}options=${encodeURIComponent(`-c search_path=${schema}`)}`;
}

/** Stands in for the connections table: one project, one database. */
class OneConnection {
  constructor(private readonly encryptedDsn: string) {}

  findByProjectId(projectId: string): Promise<ConnectionRow | undefined> {
    return Promise.resolve({
      id: "connection",
      projectId,
      kind: "postgres",
      encryptedDsn: this.encryptedDsn,
      createdAt: new Date(0),
      updatedAt: new Date(0),
    });
  }
}

const slowDefinition: DefinitionInput = {
  schemaVersion: "0.1",
  app: { name: "Slow" },
  navigation: [{ label: "Slow", resources: ["slow_records"] }],
  resources: [
    {
      key: "slow_records",
      label: { singular: "Slow record", plural: "Slow records" },
      source: { table: "slow_records" },
      primaryKey: "id",
      fields: [{ key: "id", label: "ID", type: "text" }],
      views: {
        table: { columns: ["id"], defaultSort: { field: "id", direction: "asc" } },
        detail: { sections: [{ title: "Slow", fields: ["id"] }] },
      },
    },
  ],
};

describeAgainstPostgres("the query engine against Postgres", () => {
  const dsn = CUSTOMER_DATABASE_URL ?? "";
  const page = { page: 1, pageSize: 25 };

  let admin: Client;
  let pools: CustomerPoolService;
  let runtime: RuntimeService;
  let records: RecordsService;
  let draft: unknown = saasDefinition;

  beforeAll(async () => {
    admin = new Client({ connectionString: dsn });
    await admin.connect();
    await admin.query(`drop schema if exists ${SCHEMA} cascade`);
    await admin.query(SETUP);

    // A throwaway key: nothing here is encrypted for anyone to read later.
    const crypto = new CryptoService({
      appEncryptionKey: Buffer.alloc(32, 7).toString("base64"),
    } as unknown as ConfigService);

    const connections = new OneConnection(crypto.encrypt(scopedTo(dsn, SCHEMA)));
    pools = new CustomerPoolService(connections as unknown as ConnectionsRepository, crypto);

    const queries = new QueryBuilder();
    runtime = new RuntimeService(
      { requireOwnedByKey: () => Promise.resolve(PROJECT) } as unknown as ProjectsService,
      {
        getPublished: () =>
          Promise.resolve({ payload: draft, version: 1, publishedAt: "2026-08-19T09:00:00.000Z" }),
      } as unknown as DefinitionsService,
      pools,
      new RecordReader(queries),
    );
    records = new RecordsService(runtime, new RecordWriter(queries));
  });

  afterAll(async () => {
    await pools?.onModuleDestroy();
    await admin?.query(`drop schema if exists ${SCHEMA} cascade`);
    await admin?.end();
  });

  beforeEach(() => {
    draft = saasDefinition;
  });

  describe("a list", () => {
    it("reads the columns the view names, and counts the rows there are", async () => {
      const result = await runtime.listRecords(OWNER, PROJECT.key, "users", page);

      expect(result.total).toBe(3);
      expect(typeof result.total).toBe("number");
      expect(result.records.map((record) => record.values.email)).toEqual([
        "ada@acme.test",
        "bob@acme.test",
        "cy@beta.test",
      ]);
    });

    it("puts no sensitive value on the wire, under any name", async () => {
      const result = await runtime.listRecords(OWNER, PROJECT.key, "users", page);

      expect(JSON.stringify(result)).not.toContain("do-not-leak");
      expect(JSON.stringify(result)).not.toContain("password_hash");
    });

    it("leaves a hidden field out of the page", async () => {
      const result = await runtime.listRecords(OWNER, PROJECT.key, "organizations", page);

      expect(Object.keys(result.records[0]?.values ?? {})).not.toContain("settings");
    });

    it("reads a relation as the record it points at", async () => {
      const result = await runtime.listRecords(OWNER, PROJECT.key, "users", page);

      expect(result.records[0]?.values.organization_id).toEqual({ id: ACME, label: "Acme" });
      // Cy belongs to no organization, and a label for nothing is nothing.
      expect(result.records[2]?.values.organization_id).toEqual({ id: null, label: null });
    });

    it("searches every field the view says the box covers", async () => {
      const result = await runtime.listRecords(OWNER, PROJECT.key, "users", { ...page, search: "acme.test" });

      expect(result.total).toBe(2);
    });

    it("takes a wildcard in the search box literally", async () => {
      const wildcard = await runtime.listRecords(OWNER, PROJECT.key, "users", { ...page, search: "%" });
      const literal = await runtime.listRecords(OWNER, PROJECT.key, "users", { ...page, search: "50%" });

      // Unescaped, `%` is every record. Escaped, it is the one record with a
      // per-cent sign written in it.
      expect(wildcard.total).toBe(1);
      expect(wildcard.records[0]?.values.email).toBe("cy@beta.test");
      expect(literal.total).toBe(1);
    });

    it.each([
      ["an enum", { status: "active" }, 1],
      ["a boolean", { is_active: "false" }, 1],
      ["a relation", { organization_id: ACME }, 2],
      ["a date range", { created_at: { from: "2026-02-01T00:00:00Z" } }, 2],
      ["both ends of a date range", { created_at: { from: "2026-01-15T00:00:00Z", to: "2026-02-15T00:00:00Z" } }, 1],
    ])("filters by %s", async (_case, filter, total) => {
      const result = await runtime.listRecords(OWNER, PROJECT.key, "users", { ...page, filter });

      expect(result.total).toBe(total);
    });

    it("answers a filter value the column cannot hold as a bad request", async () => {
      await expect(
        runtime.listRecords(OWNER, PROJECT.key, "users", { ...page, filter: { organization_id: "not-a-uuid" } }),
      ).rejects.toBeInstanceOf(InvalidQueryError);
    });

    it("sorts and pages without showing a record twice or losing one", async () => {
      const query = { pageSize: 1, sort: "email", direction: "asc" as const };
      const pages = await Promise.all([
        runtime.listRecords(OWNER, PROJECT.key, "users", { ...query, page: 1 }),
        runtime.listRecords(OWNER, PROJECT.key, "users", { ...query, page: 2 }),
        runtime.listRecords(OWNER, PROJECT.key, "users", { ...query, page: 3 }),
      ]);

      expect(pages.map((result) => result.records[0]?.values.email)).toEqual([
        "ada@acme.test",
        "bob@acme.test",
        "cy@beta.test",
      ]);
      expect(pages.every((result) => result.total === 3)).toBe(true);
    });

    it("reads a bigint back as a number when it is one", async () => {
      const result = await runtime.listRecords(OWNER, PROJECT.key, "orders", page);

      expect(result.records.map((record) => record.values.total_cents)).toEqual([300, 2000, 1050]);
    });
  });

  describe("a record", () => {
    it("shows the hidden fields a list leaves out, and none of the secrets", async () => {
      const record = await runtime.getRecord(OWNER, PROJECT.key, "organizations", ACME);

      expect(record.id).toBe(ACME);
      expect(record.values.settings).toEqual({ seats: 40 });

      const user = await runtime.getRecord(OWNER, PROJECT.key, "users", ADA);
      expect(JSON.stringify(user)).not.toContain("do-not-leak");
      expect(user.values.notes).toBe("founding user");
    });

    it("says a record is missing when the id names none", async () => {
      await expect(
        runtime.getRecord(OWNER, PROJECT.key, "users", "99999999-9999-4999-8999-999999999999"),
      ).rejects.toBeInstanceOf(NotFoundError);
    });

    it("says the same for an id the column's type cannot read at all", async () => {
      await expect(runtime.getRecord(OWNER, PROJECT.key, "users", "not-a-uuid")).rejects.toBeInstanceOf(
        NotFoundError,
      );
    });
  });

  describe("a related page", () => {
    it("reads a hasMany out of the target, narrowed to the record it hangs off", async () => {
      const result = await runtime.listRelated(OWNER, PROJECT.key, "users", ADA, "orders", page);

      expect(result.total).toBe(2);
      expect(result.records.map((record) => record.values.reference)).toEqual(["REF-2", "REF-1"]);
    });

    it("reads a belongsTo as the one record it points at", async () => {
      const result = await runtime.listRelated(OWNER, PROJECT.key, "users", ADA, "organization", page);

      expect(result.total).toBe(1);
      expect(result.records[0]?.values.name).toBe("Acme");
    });

    it("answers an empty page for a record that points at nothing", async () => {
      const result = await runtime.listRelated(OWNER, PROJECT.key, "users", CY, "organization", page);

      expect(result).toEqual({ records: [], total: 0, page: 1, pageSize: 25 });
    });

    it("says a record is missing rather than answering a page for one that is not there", async () => {
      await expect(
        runtime.listRelated(OWNER, PROJECT.key, "users", "99999999-9999-4999-8999-999999999999", "orders", page),
      ).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  /**
   * What a picker asks for: the records on the other side of a relation, by the
   * name they are chosen by. It is the narrowest read here — two columns, a
   * bounded count — and it meets the same walls every other one does.
   */
  describe("the records a relation may point at", () => {
    it("offers each record's key and the name it is chosen by", async () => {
      const options = await runtime.listOptions(OWNER, PROJECT.key, "organizations", {});

      expect(options).toEqual([
        { id: ACME, label: "Acme" },
        { id: BETA, label: "Beta" },
      ]);
    });

    it("narrows to what was typed, without regard to case", async () => {
      const options = await runtime.listOptions(OWNER, PROJECT.key, "organizations", { q: "ACM" });

      expect(options).toEqual([{ id: ACME, label: "Acme" }]);
    });

    it("takes a wildcard in the box literally", async () => {
      const options = await runtime.listOptions(OWNER, PROJECT.key, "users", { q: "%" });

      expect(options).toEqual([]);
    });

    it("puts nothing on the wire but the key and the label", async () => {
      const options = await runtime.listOptions(OWNER, PROJECT.key, "users", { q: "ada" });

      expect(options).toEqual([{ id: ADA, label: "ada@acme.test" }]);
      expect(JSON.stringify(options)).not.toContain("do-not-leak");
    });

    it("reads a mixed-case table and column", async () => {
      draft = prismaDefinition;

      const options = await runtime.listOptions(OWNER, PROJECT.key, "Team", { q: "plat" });

      expect(options).toEqual([{ id: "team-1", label: "Platform" }]);
    });

    it("is taken back after the five seconds the pool allows it", async () => {
      draft = slowDefinition;

      await expect(
        runtime.listOptions(OWNER, PROJECT.key, "slow_records", {}),
      ).rejects.toBeInstanceOf(QueryTimeoutError);
    });
  });

  describe("a Prisma-shaped schema", () => {
    beforeEach(() => {
      draft = prismaDefinition;
    });

    it("reads a PascalCase table and a camelCase column", async () => {
      const result = await runtime.listRecords(OWNER, PROJECT.key, "User", page);

      expect(result.total).toBe(1);
      expect(result.records[0]?.values.avatarUrl).toBe("https://cdn.acme.test/ada.png");
      expect(result.records[0]?.values.teamId).toEqual({ id: "team-1", label: "Platform" });
    });

    it("reads a zone-less timestamp back as the clock that was stored", async () => {
      const record = await runtime.getRecord(OWNER, PROJECT.key, "User", "user-1");

      // Not shifted by wherever this process thinks it is.
      expect(record.values.createdAt).toBe("2026-08-19T10:00:00.000");
      expect(record.values.signedUpOn).toBe("2026-01-01");
    });

    it("travels a hasMany between mixed-case tables", async () => {
      const result = await runtime.listRelated(OWNER, PROJECT.key, "Team", "team-1", "members", page);

      expect(result.total).toBe(1);
      expect(result.records[0]?.values.email).toBe("ada@acme.test");
    });
  });

  describe("a query that will not finish", () => {
    beforeEach(() => {
      draft = slowDefinition;
    });

    it("is taken back after the five seconds the pool allows it", async () => {
      const started = Date.now();

      await expect(runtime.listRecords(OWNER, PROJECT.key, "slow_records", page)).rejects.toBeInstanceOf(
        QueryTimeoutError,
      );

      // The statement asked for ten seconds and did not get them.
      expect(Date.now() - started).toBeLessThan(9_000);
    });
  });

  /**
   * The one statement this engine writes that is not a read. It is proved here
   * for the reason every read is: quoting, row counts and what the server does
   * with a value it cannot read are the server's answers, not a stub's
   * (DECISIONS #022). Each case seeds and drops its own row, so nothing above
   * depends on the order these run in.
   */
  describe("an action's write", () => {
    const SUBJECT = "eeeeeeee-4444-4444-8444-eeeeeeeeeeee";
    const PRISMA_SUBJECT = "user-write";
    const builder = new QueryBuilder();
    const USERS = resourceIn(saasDefinition, "users");
    const PRISMA_USER = resourceIn(prismaDefinition, "User");

    beforeEach(async () => {
      await admin.query(
        `insert into ${SCHEMA}.users (id, email, name, status, password_hash, organization_id, is_active, notes, created_at, avatar_url, trial_ends_on, login_count, preferences)
         values ($1, 'wren@acme.test', 'Wren', 'active', 'scrypt$do-not-leak', '${ACME}', true, null, '2026-04-01T09:00:00Z', null, null, 4, null)`,
        [SUBJECT],
      );
      await admin.query(
        `insert into ${SCHEMA}."User" (id, email, "avatarUrl", "teamId", "signedUpOn", "createdAt")
         values ($1, 'wren@acme.test', null, 'team-1', '2026-02-02', '2026-08-19 10:00:00')`,
        [PRISMA_SUBJECT],
      );
    });

    afterEach(async () => {
      await admin.query(`delete from ${SCHEMA}.users where id = $1`, [SUBJECT]);
      await admin.query(`delete from ${SCHEMA}."User" where id = $1`, [PRISMA_SUBJECT]);
    });

    async function run(query: { text: string; values: unknown[] }): Promise<number | null> {
      const pool = await pools.poolFor(PROJECT.id);
      const result = await pool.query({ text: query.text, values: query.values });
      return result.rowCount;
    }

    it("sets the one column it named, on the one row it named", async () => {
      const affected = await run(builder.setField(USERS, fieldOf(USERS, "status"), "suspended", SUBJECT));

      expect(affected).toBe(1);
      const record = await runtime.getRecord(OWNER, PROJECT.key, "users", SUBJECT);
      expect(record.values.status).toBe("suspended");
      // Everything else on the row is where it was.
      expect(record.values.email).toBe("wren@acme.test");
      expect(record.values.login_count).toBe(4);
      // And so is everything else on the table.
      expect((await runtime.getRecord(OWNER, PROJECT.key, "users", ADA)).values.status).toBe("active");
    });

    it("writes a boolean literal as a boolean the column accepts", async () => {
      const affected = await run(builder.setField(USERS, fieldOf(USERS, "is_active"), false, SUBJECT));

      expect(affected).toBe(1);
      expect((await runtime.getRecord(OWNER, PROJECT.key, "users", SUBJECT)).values.is_active).toBe(false);
    });

    it("affects nothing when the id names no row", async () => {
      const affected = await run(
        builder.setField(USERS, fieldOf(USERS, "status"), "suspended", "99999999-9999-4999-8999-999999999999"),
      );

      expect(affected).toBe(0);
    });

    /** Postgres folds an unquoted identifier, so a Prisma-shaped write only lands quoted. */
    it("writes through a mixed-case table and column", async () => {
      draft = prismaDefinition;

      const affected = await run(
        builder.setField(PRISMA_USER, fieldOf(PRISMA_USER, "avatarUrl"), "https://cdn.acme.test/new.png", PRISMA_SUBJECT),
      );

      expect(affected).toBe(1);
      const record = await runtime.getRecord(OWNER, PROJECT.key, "User", PRISMA_SUBJECT);
      expect(record.values.avatarUrl).toBe("https://cdn.acme.test/new.png");
    });
  });

  /**
   * The write path against the real thing. Everything here is about what
   * Postgres actually does with the statement a form produces — that a
   * data-modifying CTE hands its row to the select above it, that a column with
   * a default fills itself, that an integrity failure comes back as a category
   * and not as the driver's words — and none of it can be asserted against a
   * stub.
   */
  describe("a form's write", () => {
    const PRISMA_SUBJECT = "user-form";

    beforeEach(async () => {
      await admin.query(
        `insert into ${SCHEMA}."User" (id, email, "avatarUrl", "teamId", "signedUpOn", "createdAt")
         values ($1, 'form@acme.test', null, 'team-1', '2026-02-02', '2026-08-19 10:00:00')`,
        [PRISMA_SUBJECT],
      );
    });

    /** Rolls the tables back to what the suite seeded, between cases. */
    afterEach(async () => {
      await admin.query(`delete from ${SCHEMA}."User" where id = $1`, [PRISMA_SUBJECT]);
      await admin.query(`delete from ${SCHEMA}.users where id not in ($1, $2, $3)`, [ADA, BOB, CY]);
      await admin.query(
        `update ${SCHEMA}.users set email = 'ada@acme.test', name = 'Ada', notes = 'founding user',` +
          ` login_count = 1284, organization_id = $2 where id = $1`,
        [ADA, ACME],
      );
    });

    it("creates the record and answers with it, read back through the same statement", async () => {
      const record = await records.createRecord(OWNER, PROJECT.key, "users", {
        values: { email: "new@acme.test", name: "Nia", organization_id: ACME },
      });

      expect(record.id).toEqual(expect.any(String));
      expect(record.values.email).toBe("new@acme.test");
      // The label came off the join, exactly as a detail read would have made it.
      expect(record.values.organization_id).toEqual({ id: ACME, label: "Acme" });
      // The columns a form does not fill were filled by the database.
      expect(record.values.status).toBe("invited");
      expect(record.values.login_count).toBe(0);
      expect(record.values.created_at).toEqual(expect.any(String));
    });

    it("is the same record the read path answers with a moment later", async () => {
      const written = await records.createRecord(OWNER, PROJECT.key, "users", {
        values: { email: "twice@acme.test", name: "Twice" },
      });

      const read = await runtime.getRecord(OWNER, PROJECT.key, "users", written.id);

      expect(read).toEqual(written);
    });

    it("puts no sensitive value on the wire, in either direction", async () => {
      const record = await records.createRecord(OWNER, PROJECT.key, "users", {
        values: { email: "quiet@acme.test", name: "Quiet" },
      });

      expect(JSON.stringify(record)).not.toContain("password_hash");
      await admin.query(`update ${SCHEMA}.users set password_hash = $2 where id = $1`, [
        record.id,
        "scrypt$do-not-leak",
      ]);

      const updated = await records.updateRecord(OWNER, PROJECT.key, "users", record.id, {
        values: { name: "Still quiet" },
      });

      expect(JSON.stringify(updated)).not.toContain("do-not-leak");
    });

    it("changes the fields it names and leaves the rest of the row alone", async () => {
      const record = await records.updateRecord(OWNER, PROJECT.key, "users", ADA, {
        values: { notes: "edited" },
      });

      expect(record.values.notes).toBe("edited");
      expect(record.values.email).toBe("ada@acme.test");
      expect(record.values.login_count).toBe(1284);
      // And nobody else moved.
      const bob = await runtime.getRecord(OWNER, PROJECT.key, "users", BOB);
      expect(bob.values.notes).toBeNull();
    });

    it("clears a field that is asked to hold nothing", async () => {
      const record = await records.updateRecord(OWNER, PROJECT.key, "users", ADA, {
        values: { notes: null, organization_id: null },
      });

      expect(record.values.notes).toBeNull();
      expect(record.values.organization_id).toEqual({ id: null, label: null });
    });

    it("writes the types the definition declares as the column's own", async () => {
      const record = await records.updateRecord(OWNER, PROJECT.key, "users", ADA, {
        values: { trial_ends_on: "2027-01-31", login_count: 5, avatar_url: "https://cdn.acme.test/x.png" },
      });

      expect(record.values.trial_ends_on).toBe("2027-01-31");
      expect(record.values.login_count).toBe(5);
    });

    /**
     * There is no optimistic concurrency in v1: the second save wins, and the
     * first operator is not told. It is written down here because it is a real
     * property of the product rather than an accident of this suite.
     */
    it("lets the last write win", async () => {
      await records.updateRecord(OWNER, PROJECT.key, "users", ADA, { values: { name: "First" } });
      const second = await records.updateRecord(OWNER, PROJECT.key, "users", ADA, {
        values: { name: "Second" },
      });

      expect(second.values.name).toBe("Second");
    });

    it("writes through a mixed-case table and column", async () => {
      draft = prismaDefinition;

      const record = await records.updateRecord(OWNER, PROJECT.key, "User", PRISMA_SUBJECT, {
        values: { avatarUrl: "https://cdn.acme.test/new.png" },
      });

      expect(record.values.avatarUrl).toBe("https://cdn.acme.test/new.png");
    });

    it("says a record that is not there is not there, and writes nothing", async () => {
      await expect(
        records.updateRecord(OWNER, PROJECT.key, "users", "99999999-9999-4999-8999-999999999999", {
          values: { name: "Ghost" },
        }),
      ).rejects.toBeInstanceOf(NotFoundError);
    });

    it("refuses a resource that offers no create, before it reaches the database", async () => {
      await expect(
        records.createRecord(OWNER, PROJECT.key, "orders", { values: { reference: "REF-9" } }),
      ).rejects.toBeInstanceOf(WriteRefusedError);
    });

    describe("what the database itself refuses", () => {
      it("answers a unique violation as a conflict", async () => {
        await expect(
          records.createRecord(OWNER, PROJECT.key, "users", {
            values: { email: "ada@acme.test", name: "Impostor" },
          }),
        ).rejects.toBeInstanceOf(ConflictError);
      });

      it("points a not-null violation at the column the database named", async () => {
        const refusal = await refusalFrom(
          records.updateRecord(OWNER, PROJECT.key, "users", ADA, { values: { login_count: null } }),
        );

        expect(refusal).toBeInstanceOf(ValidationFailedError);
        expect((refusal as ValidationFailedError).details[0]?.path).toBe("values.login_count");
      });

      it("points a foreign key violation at the relation that was written", async () => {
        const refusal = await refusalFrom(
          records.updateRecord(OWNER, PROJECT.key, "users", ADA, {
            values: { organization_id: "99999999-9999-4999-8999-999999999999" },
          }),
        );

        expect(refusal).toBeInstanceOf(ValidationFailedError);
        expect((refusal as ValidationFailedError).details[0]?.path).toBe("values.organization_id");
      });

      it("never repeats the driver's words", async () => {
        const refusal = await refusalFrom(
          records.createRecord(OWNER, PROJECT.key, "users", {
            values: { email: "ada@acme.test", name: "Impostor" },
          }),
        );

        expect(refusal.message).not.toMatch(/duplicate key|constraint|users_email/i);
      });
    });

    async function refusalFrom(call: Promise<unknown>): Promise<Error> {
      try {
        await call;
      } catch (error) {
        return error as Error;
      }
      throw new Error("expected the write to be refused");
    }
  });

  describe("the connection probe", () => {
    it("says a working database is working", async () => {
      const probe = new ConnectionProbeService();

      expect(await probe.check(dsn)).toEqual({ ok: true });
    });
  });
});
