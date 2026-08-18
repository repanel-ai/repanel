import assert from "node:assert/strict";
import { test } from "node:test";
import { createProjectRequestSchema } from "./requests.js";

function projectErrors(overrides: Record<string, unknown>): string[] {
  const result = createProjectRequestSchema.safeParse({ name: "SkyScout", ...overrides });
  if (result.success) throw new Error("expected the request to be rejected");
  return result.error.issues.map((issue) => `${issue.path.join(".")} ${issue.message}`);
}

test("createProject trims the name", () => {
  assert.equal(createProjectRequestSchema.parse({ name: "  SkyScout  " }).name, "SkyScout");
});

test("createProject refuses to take a key from the caller", () => {
  const parsed = createProjectRequestSchema.parse({ name: "SkyScout", key: "someone-elses" });

  assert.deepEqual(Object.keys(parsed), ["name"]);
});

test("createProject rejects a name that is only whitespace", () => {
  assert.deepEqual(projectErrors({ name: "   " }), ["name must not be empty"]);
});

test("createProject rejects a name past a hundred characters", () => {
  assert.deepEqual(projectErrors({ name: "s".repeat(101) }), [
    "name must be at most 100 characters",
  ]);
});
