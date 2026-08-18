import assert from "node:assert/strict";
import { test } from "node:test";
import { loginRequestSchema, signupRequestSchema } from "./requests.js";

const VALID_SIGNUP = { email: "ada@example.com", password: "correct horse", name: "Ada" };

function signupErrors(overrides: Record<string, unknown>): string[] {
  const result = signupRequestSchema.safeParse({ ...VALID_SIGNUP, ...overrides });
  if (result.success) throw new Error("expected the request to be rejected");
  return result.error.issues.map((issue) => `${issue.path.join(".")} ${issue.message}`);
}

test("signup normalizes the email so one address cannot become two accounts", () => {
  const parsed = signupRequestSchema.parse({
    email: "  Ada@Example.COM ",
    password: "correct horse",
    name: "  Ada  ",
  });

  assert.equal(parsed.email, "ada@example.com");
  assert.equal(parsed.name, "Ada");
});

test("signup keeps the password exactly as typed", () => {
  const parsed = signupRequestSchema.parse({ ...VALID_SIGNUP, password: "  spaces matter  " });

  assert.equal(parsed.password, "  spaces matter  ");
});

test("signup drops unknown keys rather than trusting them", () => {
  const parsed = signupRequestSchema.parse({ ...VALID_SIGNUP, role: "admin" });

  assert.deepEqual(Object.keys(parsed).sort(), ["email", "name", "password"]);
});

test("signup rejects a malformed email", () => {
  assert.deepEqual(signupErrors({ email: "ada@" }), ["email must be a valid email address"]);
});

test("signup rejects a password shorter than eight characters", () => {
  assert.deepEqual(signupErrors({ password: "short" }), ["password must be at least 8 characters"]);
});

test("signup rejects a password bcrypt would silently truncate", () => {
  assert.deepEqual(signupErrors({ password: "p".repeat(73) }), [
    "password must be at most 72 characters",
  ]);
});

test("signup rejects a name that is only whitespace", () => {
  assert.deepEqual(signupErrors({ name: "   " }), ["name must not be empty"]);
});

test("signup reports every bad field at once", () => {
  assert.deepEqual(signupErrors({ email: "nope", password: "x", name: "" }).sort(), [
    "email must be a valid email address",
    "name must not be empty",
    "password must be at least 8 characters",
  ]);
});

test("login asks for credentials and nothing else", () => {
  const parsed = loginRequestSchema.parse({ email: "Ada@example.com", password: "correct horse" });

  assert.deepEqual(parsed, { email: "ada@example.com", password: "correct horse" });
});

test("login rejects a missing password", () => {
  const result = loginRequestSchema.safeParse({ email: "ada@example.com" });

  assert.equal(result.success, false);
});
