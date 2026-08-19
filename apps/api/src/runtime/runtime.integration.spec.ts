import type { DefinitionInput, ProjectDto } from "@repanel/contracts";
import { saasDefinition } from "@repanel/contracts/fixtures";
import { Client } from "pg";
import type { ConfigService } from "../config/config.service";
import { ConnectionProbeService } from "../connections/connection-probe.service";
import type { ConnectionRow, ConnectionsRepository } from "../connections/connections.repository";
import { CustomerPoolService } from "../connections/customer-pool.service";
import { CryptoService } from "../crypto/crypto.service";
import type { DefinitionsService } from "../definitions/definitions.service";
import { InvalidQueryError, NotFoundError, QueryTimeoutError } from "../errors/domain-errors";
import type { ProjectsService } from "../projects/projects.service";
import { prismaDefinition } from "./mixed-case.fixture";
import { QueryBuilderService } from "./query/query-builder.service";
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
  name: "SkyScout",
  key: "skyscout-a3k9x2",
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

create table ${SCHEMA}.users (
  id uuid primary key,
  email text not null,
  name text,
  status text not null,
  password_hash text not null,
  organization_id uuid references ${SCHEMA}.organizations(id),
  is_active boolean not null,
  notes text,
  created_at timestamptz not null
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

insert into ${SCHEMA}.users (id, email, name, status, password_hash, organization_id, is_active, notes, created_at) values
  ('${ADA}', 'ada@acme.test', 'Ada', 'active', 'scrypt$do-not-leak', '${ACME}', true, 'founding user', '2026-03-01T09:00:00Z'),
  ('${BOB}', 'bob@acme.test', 'Bob', 'suspended', 'scrypt$do-not-leak', '${ACME}', false, null, '2026-02-01T09:00:00Z'),
  ('${CY}', 'cy@beta.test', 'Cy', 'invited', 'scrypt$do-not-leak', null, true, '50% trial', '2026-01-01T09:00:00Z');

insert into ${SCHEMA}.orders (id, reference, user_id, status, total_cents, metadata, placed_at) values
  ('dddddddd-1111-4111-8111-dddddddddddd', 'REF-1', '${ADA}', 'paid', 1050, '{"channel":"web"}', '2026-03-02T09:00:00Z'),
  ('dddddddd-2222-4222-8222-dddddddddddd', 'REF-2', '${ADA}', 'pending', 2000, null, '2026-03-03T09:00:00Z'),
  ('dddddddd-3333-4333-8333-dddddddddddd', 'REF-3', '${BOB}', 'refunded', 300, null, '2026-03-04T09:00:00Z');

insert into ${SCHEMA}."Team" (id, "displayName", "seatCount") values ('team-1', 'Platform', 12);

insert into ${SCHEMA}."User" (id, email, "avatarUrl", "teamId", "signedUpOn", "createdAt") values
  ('user-1', 'ada@acme.test', 'https://cdn.acme.test/ada.png', 'team-1', '2026-01-01', '2026-08-19 10:00:00');
`;

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

    runtime = new RuntimeService(
      { requireOwnedByKey: () => Promise.resolve(PROJECT) } as unknown as ProjectsService,
      {
        getDraft: () =>
          Promise.resolve({ payload: draft, valid: true, errors: null, updatedAt: "2026-08-19T09:00:00.000Z" }),
      } as unknown as DefinitionsService,
      pools,
      new QueryBuilderService(),
    );
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

  describe("the connection probe", () => {
    it("says a working database is working", async () => {
      const probe = new ConnectionProbeService();

      expect(await probe.check(dsn)).toEqual({ ok: true });
    });
  });
});
