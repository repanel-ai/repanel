import assert from "node:assert/strict";
import { test } from "node:test";
import { UnreadableQueryError, readListQuery } from "./query-params.js";

function asked(query: string) {
  return readListQuery(new URLSearchParams(query));
}

test("an empty query is the first page of everything", () => {
  assert.deepEqual(asked(""), { page: 1, pageSize: 25 });
});

test("a filter arrives as the field it filters", () => {
  assert.deepEqual(asked("filter[status]=active").filter, { status: "active" });
});

test("a date range is one filter with two ends, however they arrive", () => {
  assert.deepEqual(asked("filter[created_at][to]=2026-02-01&filter[created_at][from]=2026-01-01").filter, {
    created_at: { from: "2026-01-01", to: "2026-02-01" },
  });
});

test("one end of a range is a range", () => {
  assert.deepEqual(asked("filter[created_at][from]=2026-01-01").filter, {
    created_at: { from: "2026-01-01" },
  });
});

test("several filters are read together", () => {
  assert.deepEqual(asked("filter[status]=active&filter[plan]=pro").filter, {
    status: "active",
    plan: "pro",
  });
});

test("the page and its size are numbers, not the text they arrived as", () => {
  const query = asked("page=3&pageSize=50");

  assert.equal(query.page, 3);
  assert.equal(query.pageSize, 50);
});

test("an empty search box is not a search", () => {
  assert.equal(asked("search=%20%20").search, undefined);
});

test("a parameter nobody recognizes is refused, not ignored", () => {
  assert.throws(() => asked("pgae=2"), UnreadableQueryError);
});

test("a bracket shape the table never writes is refused rather than guessed at", () => {
  assert.throws(() => asked("filter[status][maybe]=active"), UnreadableQueryError);
});

test("more rows than a page may carry is a refusal, not a trim", () => {
  assert.throws(() => asked("pageSize=5000"), UnreadableQueryError);
});
