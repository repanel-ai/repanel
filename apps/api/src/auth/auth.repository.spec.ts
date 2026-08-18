import { DrizzleQueryError } from "drizzle-orm/errors";
import type { DbService } from "../db/db.service";
import { ConflictError } from "../errors/domain-errors";
import { AuthRepository, type NewUserRow } from "./auth.repository";

const NEW_USER: NewUserRow = {
  email: "ada@example.com",
  passwordHash: "hashed:correct horse",
  name: "Ada",
};

/** A repository over a database that refuses the insert. */
function repositoryRefusing(failure: unknown): AuthRepository {
  const db = { insert: () => ({ values: () => ({ returning: () => Promise.reject(failure) }) }) };
  return new AuthRepository({ db } as unknown as DbService);
}

/** How a duplicate email arrives: the driver's SQLSTATE, wrapped by Drizzle. */
function duplicateEmail(): DrizzleQueryError {
  const refusal = Object.assign(
    new Error('duplicate key value violates unique constraint "users_email_unique"'),
    { code: "23505" },
  );
  return new DrizzleQueryError("insert into users", [], refusal);
}

describe("AuthRepository", () => {
  describe("createUser", () => {
    it("reads a duplicate email as a conflict, so the lost race is not a failure", async () => {
      const refusal = repositoryRefusing(duplicateEmail()).createUser(NEW_USER);

      await expect(refusal).rejects.toBeInstanceOf(ConflictError);
      await expect(refusal).rejects.toThrow("Email already registered");
    });

    it("keeps the database's own words out of the conflict it reports", async () => {
      const refusal: unknown = await repositoryRefusing(duplicateEmail())
        .createUser(NEW_USER)
        .catch((error: unknown) => error);

      expect((refusal as Error).message).not.toMatch(/constraint|users_email_unique|23505/);
    });

    it("lets any other failure through untouched", async () => {
      const outage = new DrizzleQueryError("insert into users", [], new Error("connection lost"));

      await expect(repositoryRefusing(outage).createUser(NEW_USER)).rejects.toBe(outage);
    });
  });
});
