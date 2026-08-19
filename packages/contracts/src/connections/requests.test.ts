import assert from "node:assert/strict";
import { test } from "node:test";
import { setConnectionRequestSchema } from "./requests.js";

const DSN = "postgres://admin:hunter2@db.example.com:5432/skyscout";

function dsnErrors(dsn: string): string[] {
  const result = setConnectionRequestSchema.safeParse({ dsn });
  if (result.success) throw new Error("expected the request to be rejected");
  return result.error.issues.map((issue) => `${issue.path.join(".")} ${issue.message}`);
}

test("setConnection accepts a postgres:// connection string", () => {
  assert.equal(setConnectionRequestSchema.parse({ dsn: DSN }).dsn, DSN);
});

test("setConnection accepts the postgresql:// spelling too", () => {
  const dsn = "postgresql://admin@db.example.com/skyscout";

  assert.equal(setConnectionRequestSchema.parse({ dsn }).dsn, dsn);
});

test("setConnection trims a pasted connection string", () => {
  assert.equal(setConnectionRequestSchema.parse({ dsn: `  ${DSN}\n` }).dsn, DSN);
});

test("setConnection rejects a database RePanel does not speak", () => {
  assert.deepEqual(dsnErrors("mysql://admin:hunter2@db.example.com:3306/skyscout"), [
    "dsn must be a postgres:// or postgresql:// connection string that names a database",
  ]);
});

test("setConnection rejects a connection string that names no database", () => {
  // Legal for the driver, which would fall back to a database named after the
  // role — a panel reading the wrong one, and nothing saying so.
  assert.equal(dsnErrors("postgres://admin:hunter2@db.example.com:5432").length, 1);
  assert.equal(dsnErrors("postgres://admin:hunter2@db.example.com:5432/").length, 1);
});

test("setConnection rejects a host that is not a connection string at all", () => {
  assert.equal(dsnErrors("db.example.com:5432").length, 1);
  assert.equal(dsnErrors("").length, 1);
});
