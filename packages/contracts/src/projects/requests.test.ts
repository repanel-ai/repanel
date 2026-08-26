import assert from "node:assert/strict";
import { test } from "node:test";
import { addOperatorRequestSchema, createProjectRequestSchema } from "./requests.js";

function projectErrors(overrides: Record<string, unknown>): string[] {
  const result = createProjectRequestSchema.safeParse({ name: "Crewbase", ...overrides });
  if (result.success) throw new Error("expected the request to be rejected");
  return result.error.issues.map((issue) => `${issue.path.join(".")} ${issue.message}`);
}

test("createProject trims the name", () => {
  assert.equal(createProjectRequestSchema.parse({ name: "  Crewbase  " }).name, "Crewbase");
});

test("createProject refuses to take a key from the caller", () => {
  const parsed = createProjectRequestSchema.parse({ name: "Crewbase", key: "someone-elses" });

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

function operatorErrors(overrides: Record<string, unknown>): string[] {
  const result = addOperatorRequestSchema.safeParse({
    email: "ops@example.com",
    name: "Ops",
    ...overrides,
  });
  if (result.success) throw new Error("expected the request to be rejected");
  return result.error.issues.map((issue) => `${issue.path.join(".")} ${issue.message}`);
}

test("addOperator normalizes the address the way signing up does", () => {
  const parsed = addOperatorRequestSchema.parse({ email: "  Ops@Example.COM ", name: "Ops" });

  assert.equal(parsed.email, "ops@example.com");
});

test("addOperator refuses to take a role from the caller", () => {
  const parsed = addOperatorRequestSchema.parse({
    email: "ops@example.com",
    name: "Ops",
    role: "owner",
  });

  assert.deepEqual(Object.keys(parsed).sort(), ["email", "name"]);
});

test("addOperator rejects an address that is not one", () => {
  assert.deepEqual(operatorErrors({ email: "ops-at-example" }), [
    "email must be a valid email address",
  ]);
});

test("addOperator rejects a name that is only whitespace", () => {
  assert.deepEqual(operatorErrors({ name: "   " }), ["name must not be empty"]);
});
