import { DrizzleQueryError } from "drizzle-orm/errors";
import { isUniqueViolation } from "./unique-violation";

/** The shape `pg` throws: a plain error carrying the SQLSTATE it was refused with. */
function driverError(code: string): Error {
  return Object.assign(new Error(`refused with ${code}`), { code });
}

describe("isUniqueViolation", () => {
  it("recognizes a driver error the query layer wrapped", () => {
    const wrapped = new DrizzleQueryError("insert into users", [], driverError("23505"));

    expect(isUniqueViolation(wrapped)).toBe(true);
  });

  it("recognizes the driver error on its own", () => {
    expect(isUniqueViolation(driverError("23505"))).toBe(true);
  });

  it("looks past every wrapper, however deep", () => {
    const buried = new Error("outer", { cause: new Error("inner", { cause: driverError("23505") }) });

    expect(isUniqueViolation(buried)).toBe(true);
  });

  it("leaves other failures alone", () => {
    const notNull = new DrizzleQueryError("insert into users", [], driverError("23502"));

    expect(isUniqueViolation(notNull)).toBe(false);
    expect(isUniqueViolation(new Error("connection lost"))).toBe(false);
    expect(isUniqueViolation("23505")).toBe(false);
    expect(isUniqueViolation(undefined)).toBe(false);
  });
});
