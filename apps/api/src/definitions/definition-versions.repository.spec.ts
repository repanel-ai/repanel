import { DrizzleQueryError } from "drizzle-orm/errors";
import type { DbService } from "../db/db.service";
import { ConflictError } from "../errors/domain-errors";
import {
  DefinitionVersionsRepository,
  type DefinitionVersionRow,
} from "./definition-versions.repository";

const PROJECT_ID = "8c9a3f70-cf4a-48e5-9b85-b3b869c11a11";
const PAYLOAD = { schemaVersion: "0.1", app: { name: "Acme Admin" } };

function versionRow(version: number): DefinitionVersionRow {
  return {
    id: `version-${version}`,
    projectId: PROJECT_ID,
    version,
    payload: PAYLOAD,
    publishedAt: new Date("2026-08-19T09:00:00.000Z"),
  };
}

interface Database {
  /** The versions the project already has, newest first. */
  latest: DefinitionVersionRow[];
  /** Every row handed to the insert, so a test can read what was written. */
  written: Record<string, unknown>[];
  /** What the insert answers, when it does not answer with the row. */
  refusal?: unknown;
}

function repositoryOver(database: Database): DefinitionVersionsRepository {
  const db = {
    select: () => ({
      from: () => ({
        where: () => ({ orderBy: () => ({ limit: () => Promise.resolve(database.latest) }) }),
      }),
    }),
    insert: () => ({
      values: (row: Record<string, unknown>) => {
        database.written.push(row);
        return {
          returning: () =>
            database.refusal
              ? Promise.reject(database.refusal)
              : Promise.resolve([{ ...versionRow(row.version as number), ...row }]),
        };
      },
    }),
  };
  return new DefinitionVersionsRepository({ db } as unknown as DbService);
}

/** How a version number already taken arrives: SQLSTATE, wrapped by Drizzle. */
function versionTaken(): DrizzleQueryError {
  const refusal = Object.assign(
    new Error(
      'duplicate key value violates unique constraint "definition_versions_project_id_version_unique"',
    ),
    { code: "23505" },
  );
  return new DrizzleQueryError("insert into definition_versions", [], refusal);
}

describe("DefinitionVersionsRepository", () => {
  /**
   * A published version is what somebody is looking at, so nothing here may
   * change one. That is a structural promise, and it is kept structurally: a
   * method that wrote over a row would have to be named in this list before it
   * could exist, and naming it is the conversation.
   */
  it("offers a way to publish and a way to read, and no way to change either", () => {
    const repository = repositoryOver({ latest: [], written: [] }) as unknown as Record<
      string,
      unknown
    >;
    // Both halves, because a method can be written either way: on the prototype
    // as a method, or on the instance as a field holding a function.
    const surface = [
      ...Object.getOwnPropertyNames(DefinitionVersionsRepository.prototype),
      ...Object.getOwnPropertyNames(repository),
    ]
      .filter((name) => name !== "constructor" && typeof repository[name] === "function")
      .sort();

    expect(surface).toEqual(["findLatest", "insertNext"]);
  });

  describe("insertNext", () => {
    it("numbers a project's first publication one", async () => {
      const database: Database = { latest: [], written: [] };

      const published = await repositoryOver(database).insertNext(PROJECT_ID, PAYLOAD);

      expect(database.written).toEqual([{ projectId: PROJECT_ID, payload: PAYLOAD, version: 1 }]);
      expect(published.version).toBe(1);
    });

    it("numbers every publication after it one higher, and writes the payload it was given", async () => {
      const database: Database = { latest: [versionRow(4)], written: [] };

      const published = await repositoryOver(database).insertNext(PROJECT_ID, PAYLOAD);

      expect(published.version).toBe(5);
      expect(database.written[0]?.payload).toBe(PAYLOAD);
    });

    it("reads a version number already taken as a conflict, so a lost race is not a failure", async () => {
      const database: Database = { latest: [], written: [], refusal: versionTaken() };

      const refusal = repositoryOver(database).insertNext(PROJECT_ID, PAYLOAD);

      await expect(refusal).rejects.toBeInstanceOf(ConflictError);
      await expect(refusal).rejects.toThrow("published by something else");
    });

    it("keeps the database's own words out of the conflict it reports", async () => {
      const database: Database = { latest: [], written: [], refusal: versionTaken() };

      const refusal: unknown = await repositoryOver(database)
        .insertNext(PROJECT_ID, PAYLOAD)
        .catch((error: unknown) => error);

      expect((refusal as Error).message).not.toMatch(/constraint|definition_versions|23505/);
    });

    it("lets any other failure through untouched", async () => {
      const outage = new DrizzleQueryError(
        "insert into definition_versions",
        [],
        new Error("connection lost"),
      );
      const database: Database = { latest: [], written: [], refusal: outage };

      await expect(repositoryOver(database).insertNext(PROJECT_ID, PAYLOAD)).rejects.toBe(outage);
    });
  });
});
