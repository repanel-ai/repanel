import assert from "node:assert/strict";
import { test } from "node:test";
import { recordWriteSchema } from "./writes.js";

function errorsFor(body: unknown): string[] {
  const result = recordWriteSchema.safeParse(body);
  if (result.success) throw new Error("expected the body to be rejected");
  return result.error.issues.map((issue) => issue.message);
}

test("a write carries values, and JSON of any shape inside them", () => {
  assert.deepEqual(recordWriteSchema.parse({ values: { name: "Ada", seats: 3, notes: null } }), {
    values: { name: "Ada", seats: 3, notes: null },
  });
});

test("a write carries nothing but its values", () => {
  assert.match(errorsFor({ values: {}, id: "u_1" })[0] ?? "", /Unrecognized key/);
});

test("a key that could not name a field is refused before anything looks it up", () => {
  assert.equal(errorsFor({ values: { 'name" = \'x\' --': 1 } }).length, 1);
  assert.equal(errorsFor({ values: { "9lives": 1 } }).length, 1);
});

test("values is required: an empty body is not an empty write", () => {
  assert.equal(errorsFor({}).length, 1);
});
