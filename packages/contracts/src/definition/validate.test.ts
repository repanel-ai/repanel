import assert from "node:assert/strict";
import { test } from "node:test";
import type { ValidationError } from "./errors.js";
import { saasDefinition } from "./fixtures/index.js";
import type { Definition } from "./schema.js";
import { validateDefinition } from "./validate.js";

function validDefinition(input: unknown): Definition {
  const result = validateDefinition(input);
  if (!result.valid) {
    throw new Error(`expected a valid definition, got:\n${JSON.stringify(result.errors, null, 2)}`);
  }
  return result.definition;
}

function errorsOf(input: unknown): ValidationError[] {
  const result = validateDefinition(input);
  if (result.valid) throw new Error("expected the definition to be invalid");
  return result.errors;
}

function onlyErrorOf(input: unknown): ValidationError {
  const errors = errorsOf(input);
  assert.equal(errors.length, 1, `expected exactly one error, got:\n${JSON.stringify(errors, null, 2)}`);
  return errors[0] as ValidationError;
}

function draft(): Record<string, unknown> {
  return structuredClone(saasDefinition) as unknown as Record<string, unknown>;
}

test("the reference fixture validates with zero errors", () => {
  const definition = validDefinition(saasDefinition);
  assert.deepEqual(
    definition.resources.map((resource) => resource.key),
    ["organizations", "users", "orders"],
  );
});

test("validation applies the v0 defaults", () => {
  const definition = validDefinition(saasDefinition);

  const orders = definition.resources.find((resource) => resource.key === "orders");
  assert.ok(orders);
  assert.equal(orders.readOnly, true, "resources are read-only unless stated");
  assert.deepEqual(orders.views.detail.relatedLists, [], "an omitted related list becomes empty");

  const id = orders.fields.find((field) => field.key === "id");
  assert.ok(id);
  assert.equal(id.sensitive, false);
  assert.equal(id.hidden, false);
});

test("a missing required key is reported as missing, not as a type error", () => {
  const input = draft();
  delete input.app;

  const error = onlyErrorOf(input);
  assert.equal(error.path, "app");
  assert.equal(error.message, "Required key `app` is missing.");
  assert.equal(error.hint, "Add `app` to `(root)`; it must be an object.");
});

test("a wrongly typed value reports what was expected and what arrived", () => {
  const input = draft();
  input.navigation = "customers";

  const error = onlyErrorOf(input);
  assert.equal(error.path, "navigation");
  assert.equal(error.message, "Expected an array, received a string.");
  assert.equal(error.expected, "an array");
  assert.equal(error.hint, "Change `navigation` to an array.");
});

test("an unknown key is reported at its own path", () => {
  const input = draft();
  const users = (input.resources as Record<string, unknown>[])[1] as Record<string, unknown>;
  users.softDelete = true;

  const error = onlyErrorOf(input);
  assert.equal(error.path, "resources[1].softDelete");
  assert.equal(error.message, "Unrecognized key `softDelete`.");
  assert.match(error.hint, /Remove `softDelete` from `resources\[1\]`/);
});

test("an unknown value for a discriminator points at the discriminator itself", () => {
  const input = draft();
  const users = (input.resources as Record<string, unknown>[])[1] as Record<string, unknown>;
  const field = (users.fields as Record<string, unknown>[])[1] as Record<string, unknown>;
  field.type = "emailAddress";

  const error = onlyErrorOf(input);
  assert.equal(error.path, "resources[1].fields[1].type");
  assert.equal(error.message, "`emailAddress` is not a valid value for `type`.");
  assert.match(error.hint, /to one of: text, longText, number, boolean, date, dateTime, email, url, json, enum, relation\.$/);
});

test("an unknown schema version is rejected with the version this package speaks", () => {
  const input = draft();
  input.schemaVersion = "0.2";

  const error = onlyErrorOf(input);
  assert.equal(error.path, "schemaVersion");
  assert.equal(error.expected, "`0.1`");
  assert.equal(error.hint, "Change `schemaVersion` to `0.1`.");
});

test("a resource cannot opt out of read-only in v0", () => {
  const input = draft();
  const users = (input.resources as Record<string, unknown>[])[1] as Record<string, unknown>;
  users.readOnly = false;

  const error = onlyErrorOf(input);
  assert.equal(error.path, "resources[1].readOnly");
  assert.equal(error.hint, "Change `resources[1].readOnly` to `true`.");
});

test("a key that is not a usable column name is rejected", () => {
  const input = draft();
  const users = (input.resources as Record<string, unknown>[])[1] as Record<string, unknown>;
  const field = (users.fields as Record<string, unknown>[])[1] as Record<string, unknown>;
  field.key = "9 email";

  const errors = errorsOf(input);
  const error = errors.find((candidate) => candidate.path === "resources[1].fields[1].key");
  assert.ok(error, "expected an error on the malformed key");
  assert.equal(error.expected, "a key of letters, digits and underscores that does not start with a digit");
});

test("a definition that is not an object is reported at the root", () => {
  const error = onlyErrorOf("resources: users");
  assert.equal(error.path, "(root)");
  assert.equal(error.message, "Expected an object, received a string.");
  assert.equal(
    error.hint,
    "The definition must be a JSON object with the keys: schemaVersion, app, navigation, resources.",
  );
});

test("errors carry only RePanel's error shape, never raw zod issues", () => {
  const input = draft();
  input.schemaVersion = 1;
  input.app = { name: "" };

  for (const error of errorsOf(input)) {
    assert.deepEqual(Object.keys(error).sort(), ["expected", "hint", "message", "path"]);
  }
});

test("a structural failure skips the referential pass", () => {
  const input = draft();
  delete input.app;
  const users = (input.resources as Record<string, unknown>[])[1] as Record<string, unknown>;
  const views = users.views as { table: { columns: string[] } };
  views.table.columns[0] = "does_not_exist";

  const error = onlyErrorOf(input);
  assert.equal(error.path, "app", "referential errors must wait for a well-typed definition");
});

test("every error names a path that is either the root or a dotted JSON path", () => {
  const input = draft();
  const users = (input.resources as Record<string, unknown>[])[1] as Record<string, unknown>;
  users.views = { table: { columns: [] }, detail: {} };

  for (const error of errorsOf(input)) {
    assert.match(error.path, /^(\(root\)|[A-Za-z_][\w.[\]]*)$/);
    assert.notEqual(error.hint, "");
  }
});
