import assert from "node:assert/strict";
import { test } from "node:test";
import { listRecordsQuerySchema, optionsQuerySchema } from "./requests.js";

/**
 * Every value here arrives the way express hands a query string over: as text,
 * with nested brackets already read into objects. So the cases are written the
 * same way.
 */
function parse(query: Record<string, unknown>): unknown {
  return listRecordsQuerySchema.parse(query);
}

function errorsFor(query: Record<string, unknown>): string[] {
  const result = listRecordsQuerySchema.safeParse(query);
  if (result.success) throw new Error("expected the query to be rejected");
  return result.error.issues.map((issue) => issue.message);
}

test("listRecords reads a page off a query string", () => {
  assert.deepEqual(parse({ page: "3", pageSize: "50", sort: "created_at", direction: "desc" }), {
    page: 3,
    pageSize: 50,
    sort: "created_at",
    direction: "desc",
  });
});

test("listRecords answers an empty query with the first page", () => {
  assert.deepEqual(parse({}), { page: 1, pageSize: 25 });
});

test("listRecords reads both shapes of filter", () => {
  assert.deepEqual(parse({ filter: { status: "active", created_at: { from: "2026-01-01" } } }), {
    page: 1,
    pageSize: 25,
    filter: { status: "active", created_at: { from: "2026-01-01" } },
  });
});

test("listRecords treats an empty search box as no search", () => {
  assert.equal(listRecordsQuerySchema.parse({ search: "   " }).search, undefined);
  assert.equal(listRecordsQuerySchema.parse({ search: " acme " }).search, "acme");
});

test("listRecords refuses more rows than a page may carry", () => {
  assert.equal(errorsFor({ pageSize: "101" }).length, 1);
  assert.equal(errorsFor({ page: "0" }).length, 1);
  assert.equal(errorsFor({ page: "2.5" }).length, 1);
  assert.equal(errorsFor({ page: "first" }).length, 1);
});

test("listRecords refuses a parameter nobody recognizes", () => {
  // Silently answering the first page of everything is the wrong reply to a typo.
  assert.match(errorsFor({ pagesize: "10" })[0] ?? "", /Unrecognized key/);
  assert.match(errorsFor({ filtre: { status: "active" } })[0] ?? "", /Unrecognized key/);
});

test("listRecords refuses a filter key that could not name a field", () => {
  assert.equal(errorsFor({ filter: { 'status" or "1': "active" } }).length, 1);
});

test("options reads the box somebody is typing into", () => {
  assert.deepEqual(optionsQuerySchema.parse({ q: " acme " }), { q: "acme" });
});

test("options treats an empty box as no search at all", () => {
  assert.equal(optionsQuerySchema.parse({ q: "   " }).q, undefined);
  assert.deepEqual(optionsQuerySchema.parse({}), {});
});

test("options refuses a parameter it does not recognize", () => {
  const result = optionsQuerySchema.safeParse({ q: "acme", limit: "500" });
  assert.equal(result.success, false);
});
