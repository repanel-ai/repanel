import type { ProjectDto, UserDto } from "@repanel/contracts";
import { saasDefinition } from "@repanel/contracts/fixtures";
import type { AuditEvent } from "@repanel/engine";
import type { Pool, PoolClient, QueryResult } from "pg";
import type { ActivityService } from "../activity/activity.service";
import type { CustomerPoolService } from "../connections/customer-pool.service";
import type { PublishedDefinition } from "../definitions/definitions.mapper";
import type { DefinitionsService } from "../definitions/definitions.service";
import { NotFoundError, ValidationFailedError, WriteRefusedError } from "../errors/domain-errors";
import type { ProjectsService } from "../projects/projects.service";
import { directRuntime } from "../runtime/runtime.test-helpers";
import { RecordsService } from "./records.service";

const PROJECT: ProjectDto = {
  id: "8c9a3f70-cf4a-48e5-9b85-b3b869c11a11",
  name: "Crewbase",
  key: "crewbase-a3k9x2",
  createdAt: "2026-08-18T12:00:00.000Z",
};
/** The operator every write here is made by, and recorded against. */
const OPERATOR: UserDto = {
  id: "0f1e2d3c-4b5a-4988-9776-6655443322aa",
  email: "ada@repanel.test",
  name: "Ada",
};

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

/** What `begin`, `commit` and `rollback` answer with: nothing anybody reads. */
const NOTHING = { rows: [], fields: [], rowCount: 0, command: "" } as unknown as QueryResult;

class FakePool {
  readonly statements: Statement[] = [];
  respond: () => QueryResult | Error = () => userRow();

  poolFor(): Promise<Pool> {
    return Promise.resolve(this as unknown as Pool);
  }

  /**
   * The engine runs every statement inside a transaction of its own
   * (`engine/src/pool/bounded-statement.ts`), so what it asks a pool for is a
   * client rather than an answer. This fake is its own client: it lends itself
   * and takes itself back.
   */
  connect(): Promise<PoolClient> {
    return Promise.resolve(this as unknown as PoolClient);
  }

  release(): void {}

  query(statement: Statement | string): Promise<QueryResult> {
    // The transaction's own statements travel as bare strings and carry nothing
    // this spec reads.
    if (typeof statement === "string") return Promise.resolve(NOTHING);

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
  let projects: { requireMemberByKey: jest.Mock };
  let definitions: { getPublished: jest.Mock; getValidationResult: jest.Mock };
  let activity: { record: jest.Mock };
  let records: RecordsService;

  /** Every event the write path filed, in the order it filed them. */
  function filed(): AuditEvent[] {
    return activity.record.mock.calls.map(([, , event]: [unknown, unknown, AuditEvent]) => event);
  }

  beforeEach(() => {
    pool = new FakePool();
    projects = { requireMemberByKey: jest.fn().mockResolvedValue(PROJECT) };
    definitions = {
      getPublished: jest.fn().mockResolvedValue(publishedOf(saasDefinition)),
      getValidationResult: jest.fn().mockResolvedValue(null),
    };
    activity = { record: jest.fn().mockResolvedValue(undefined) };

    const { runtime, executors } = directRuntime({
      projects: projects as unknown as ProjectsService,
      definitions: definitions as unknown as DefinitionsService,
      pools: pool as unknown as CustomerPoolService,
    });
    records = new RecordsService(runtime, activity as unknown as ActivityService, executors);
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
    const record = await records.createRecord(OPERATOR, PROJECT.key, "users", {
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
    await records.updateRecord(OPERATOR, PROJECT.key, "users", "u_1", { values: { notes: "hi" } });

    expect(pool.statements[0]?.text).toContain('update "users" set "notes" = $1 where "id" = $2');
    expect(pool.statements[0]?.values).toEqual(["hi", "u_1"]);
  });

  it("asks whether this owner has the project before anything else", async () => {
    projects.requireMemberByKey.mockRejectedValue(new NotFoundError("Project not found"));

    const refusal = await refusalFrom(
      records.createRecord(OPERATOR, PROJECT.key, "users", { values: { email: "a@b.test", name: "A" } }),
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
      records.createRecord(OPERATOR, PROJECT.key, "users", { values: { email: "a@b.test", name: "A" } }),
    );

    expect(refusal).toBeInstanceOf(NotFoundError);
    expect(pool.statements).toEqual([]);
  });

  it("writes nothing when the published definition no longer validates", async () => {
    definitions.getPublished.mockResolvedValue(publishedOf({ schemaVersion: "0.1" }));

    const refusal = await refusalFrom(
      records.updateRecord(OPERATOR, PROJECT.key, "users", "u_1", { values: { name: "Ada" } }),
    );

    expect(refusal).toBeInstanceOf(NotFoundError);
    expect(pool.statements).toEqual([]);
  });

  it("refuses a write the definition does not offer, before any statement", async () => {
    const refusal = await refusalFrom(
      records.createRecord(OPERATOR, PROJECT.key, "orders", { values: { reference: "AC-2" } }),
    );

    expect(refusal).toBeInstanceOf(WriteRefusedError);
    expect(pool.statements).toEqual([]);
  });

  it("carries the field-level refusals out where the form can read them", async () => {
    const refusal = (await refusalFrom(
      records.updateRecord(OPERATOR, PROJECT.key, "users", "u_1", {
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

  /**
   * The engine says what happened; this service says who it happened for. The
   * two halves meet here, and this is where the operator's own address reaches
   * the log (DECISIONS #061).
   */
  describe("what it records", () => {
    it("files the write against the operator who made it, and their project", async () => {
      await records.createRecord(OPERATOR, PROJECT.key, "users", {
        values: { email: "ada@acme.test", name: "Ada" },
      });

      expect(activity.record).toHaveBeenCalledWith(
        OPERATOR,
        PROJECT.id,
        expect.objectContaining({ kind: "create", resourceKey: "users", outcome: "ok" }),
      );
    });

    it("files an edit with the values on both sides of it", async () => {
      await records.updateRecord(OPERATOR, PROJECT.key, "users", "u_1", {
        values: { name: "Ada Lovelace" },
      });

      expect(filed()[0]).toMatchObject({
        kind: "update",
        recordId: "u_1",
        outcome: "ok",
        after: { name: "Ada" },
      });
    });

    /**
     * The one rule this feature may not bend (DECISIONS #014, #027). A
     * sensitive field cannot be written, so it cannot be one of the columns a
     * write names — and the log is built out of the columns a write names.
     */
    it("puts no sensitive field in the log, on either side of a write", async () => {
      await records.updateRecord(OPERATOR, PROJECT.key, "users", "u_1", {
        values: { name: "Ada Lovelace" },
      });

      const [event] = filed();
      expect(Object.keys(event?.after ?? {})).toEqual(["name"]);
      expect(JSON.stringify(event)).not.toContain("password_hash");
    });

    it("files a refusal, and none of the values that were refused", async () => {
      await refusalFrom(
        records.updateRecord(OPERATOR, PROJECT.key, "users", "u_1", {
          values: { password_hash: "scrypt$do-not-leak" },
        }),
      );

      expect(filed()).toEqual([
        expect.objectContaining({ outcome: "refused", reason: "validation_failed", after: null }),
      ]);
      expect(JSON.stringify(filed())).not.toContain("do-not-leak");
    });

    /**
     * There is no transaction across two databases, so what stands in for one
     * is this: the write is not reported until it has been accounted for.
     */
    it("does not answer a write it could not account for", async () => {
      activity.record.mockRejectedValue(new Error("the log is down"));

      const refusal = await refusalFrom(
        records.createRecord(OPERATOR, PROJECT.key, "users", {
          values: { email: "ada@acme.test", name: "Ada" },
        }),
      );

      expect(refusal.message).toBe("the log is down");
    });
  });
});
