import type { ProjectDto } from "@repanel/contracts";
import { saasDefinition } from "@repanel/contracts/fixtures";
import { QueryBuilder, RecordReader, RecordWriter } from "@repanel/engine";
import type { Pool, QueryResult } from "pg";
import type { CustomerPoolService } from "../connections/customer-pool.service";
import type { PublishedDefinition } from "../definitions/definitions.mapper";
import type { DefinitionsService } from "../definitions/definitions.service";
import { NotFoundError, ValidationFailedError, WriteRefusedError } from "../errors/domain-errors";
import type { ProjectsService } from "../projects/projects.service";
import { RuntimeService } from "../runtime/runtime.service";
import { RecordsService } from "./records.service";

const PROJECT: ProjectDto = {
  id: "8c9a3f70-cf4a-48e5-9b85-b3b869c11a11",
  name: "Crewbase",
  key: "crewbase-a3k9x2",
  createdAt: "2026-08-18T12:00:00.000Z",
};
const OWNER = "0f1e2d3c-4b5a-4988-9776-6655443322aa";

interface Statement {
  text: string;
  values: unknown[];
}

/** One `users` row as a write selects it back: thirteen columns, `c0` first. */
function userRow(overrides: Record<number, unknown> = {}): QueryResult {
  const columns = Array.from({ length: 13 }, (_, index) => `c${index}`);
  const values: unknown[] = ["u_1", "ada@acme.test", "Ada", "active", null, null, null, null, null, null, null, null, null];
  for (const [index, value] of Object.entries(overrides)) values[Number(index)] = value;

  return {
    rows: [Object.fromEntries(columns.map((name, index) => [name, values[index]]))],
    fields: columns.map((name) => ({ name, dataTypeID: 25 })),
    rowCount: 1,
    command: "SELECT",
  } as unknown as QueryResult;
}

class FakePool {
  readonly statements: Statement[] = [];
  respond: () => QueryResult | Error = () => userRow();

  poolFor(): Promise<Pool> {
    return Promise.resolve(this as unknown as Pool);
  }

  query(statement: Statement): Promise<QueryResult> {
    this.statements.push(statement);
    const answer = this.respond();
    return answer instanceof Error ? Promise.reject(answer) : Promise.resolve(answer);
  }
}

function publishedOf(payload: unknown): PublishedDefinition {
  return { payload, version: 1, publishedAt: "2026-08-19T09:00:00.000Z" };
}

describe("RecordsService", () => {
  let pool: FakePool;
  let projects: { requireOwnedByKey: jest.Mock };
  let definitions: { getPublished: jest.Mock; getValidationResult: jest.Mock };
  let records: RecordsService;

  beforeEach(() => {
    pool = new FakePool();
    projects = { requireOwnedByKey: jest.fn().mockResolvedValue(PROJECT) };
    definitions = {
      getPublished: jest.fn().mockResolvedValue(publishedOf(saasDefinition)),
      getValidationResult: jest.fn().mockResolvedValue(null),
    };

    const queries = new QueryBuilder();
    const runtime = new RuntimeService(
      projects as unknown as ProjectsService,
      definitions as unknown as DefinitionsService,
      pool as unknown as CustomerPoolService,
      new RecordReader(queries),
    );
    records = new RecordsService(runtime, new RecordWriter(queries));
  });

  async function refusalFrom(call: Promise<unknown>): Promise<Error> {
    try {
      await call;
    } catch (error) {
      return error as Error;
    }
    throw new Error("expected the call to be refused");
  }

  it("writes the record and answers with what the write returned", async () => {
    const record = await records.createRecord(OWNER, PROJECT.key, "users", {
      values: { email: "ada@acme.test", name: "Ada" },
    });

    expect(record).toEqual({
      id: "u_1",
      values: expect.objectContaining({ email: "ada@acme.test", name: "Ada" }),
    });
    expect(pool.statements[0]?.text).toContain('insert into "users" ("email", "name")');
    expect(pool.statements[0]?.values).toEqual(["ada@acme.test", "Ada"]);
  });

  it("updates only the fields the request named", async () => {
    await records.updateRecord(OWNER, PROJECT.key, "users", "u_1", { values: { notes: "hi" } });

    expect(pool.statements[0]?.text).toContain('update "users" set "notes" = $1 where "id" = $2');
    expect(pool.statements[0]?.values).toEqual(["hi", "u_1"]);
  });

  it("asks whether this owner has the project before anything else", async () => {
    projects.requireOwnedByKey.mockRejectedValue(new NotFoundError("Project not found"));

    const refusal = await refusalFrom(
      records.createRecord(OWNER, PROJECT.key, "users", { values: { email: "a@b.test", name: "A" } }),
    );

    expect(refusal).toBeInstanceOf(NotFoundError);
    expect(pool.statements).toEqual([]);
  });

  /**
   * A write lands on the definition the form was drawn from. What an agent
   * submitted a moment ago is a draft, and a draft cannot change what an
   * operator is in the middle of saving (DECISIONS #025).
   */
  it("writes against the published definition, never the draft", async () => {
    definitions.getPublished.mockResolvedValue(null);

    const refusal = await refusalFrom(
      records.createRecord(OWNER, PROJECT.key, "users", { values: { email: "a@b.test", name: "A" } }),
    );

    expect(refusal).toBeInstanceOf(NotFoundError);
    expect(pool.statements).toEqual([]);
  });

  it("writes nothing when the published definition no longer validates", async () => {
    definitions.getPublished.mockResolvedValue(publishedOf({ schemaVersion: "0.1" }));

    const refusal = await refusalFrom(
      records.updateRecord(OWNER, PROJECT.key, "users", "u_1", { values: { name: "Ada" } }),
    );

    expect(refusal).toBeInstanceOf(NotFoundError);
    expect(pool.statements).toEqual([]);
  });

  it("refuses a write the definition does not offer, before any statement", async () => {
    const refusal = await refusalFrom(
      records.createRecord(OWNER, PROJECT.key, "orders", { values: { reference: "AC-2" } }),
    );

    expect(refusal).toBeInstanceOf(WriteRefusedError);
    expect(pool.statements).toEqual([]);
  });

  it("carries the field-level refusals out where the form can read them", async () => {
    const refusal = (await refusalFrom(
      records.updateRecord(OWNER, PROJECT.key, "users", "u_1", {
        values: { email: "not-an-address", password_hash: "x" },
      }),
    )) as ValidationFailedError;

    expect(refusal).toBeInstanceOf(ValidationFailedError);
    expect(refusal.details.map((detail) => detail.path)).toEqual([
      "values.email",
      "values.password_hash",
    ]);
    expect(pool.statements).toEqual([]);
  });
});
