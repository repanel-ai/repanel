import assert from "node:assert/strict";
import { test } from "node:test";
import { errorAt, errorsFor, fieldIn, resourceIn, validFor } from "./draft.test-helpers.js";
import { labelFieldOf } from "./schema.js";

/** One resource's own references: its keys are unique, and everything it names exists. */

test("field keys must be unique within a resource", () => {
  const errors = errorsFor((draft) => {
    const users = resourceIn(draft, "users");
    const name = users.fields.find((field) => field.key === "name");
    assert.ok(name);
    name.key = "email";
  });

  const error = errorAt(errors, "resources[1].fields[2].key");
  assert.equal(error.message, "Duplicate field key `email`.");
  assert.match(error.hint, /every field key must appear once in resource `users`/);
});

test("relationship keys must be unique within a resource", () => {
  const errors = errorsFor((draft) => {
    resourceIn(draft, "users").relationships = [
      { key: "organization", kind: "belongsTo", target: "organizations", foreignKey: "organization_id" },
      { key: "organization", kind: "hasMany", target: "orders", foreignKey: "user_id" },
    ];
  });

  const error = errorAt(errors, "resources[1].relationships[1].key");
  assert.equal(error.message, "Duplicate relationship key `organization`.");
  assert.match(error.hint, /every relationship key must appear once in resource `users`/);
});

test("action keys must be unique within a resource", () => {
  const errors = errorsFor((draft) => {
    resourceIn(draft, "users").actions = [
      { key: "suspend", label: "Suspend", confirm: "Suspend?", kind: "dbUpdate", field: "status", value: "suspended" },
      { key: "suspend", label: "Reactivate", confirm: "Reactivate?", kind: "dbUpdate", field: "status", value: "active" },
    ];
  });

  const error = errorAt(errors, "resources[1].actions[1].key");
  assert.equal(error.message, "Duplicate action key `suspend`.");
  assert.match(error.hint, /every action key must appear once in resource `users`/);
});

test("the primary key must name a field of the resource", () => {
  const errors = errorsFor((draft) => {
    resourceIn(draft, "users").primaryKey = "uuid";
  });

  const error = errorAt(errors, "resources[1].primaryKey");
  assert.equal(error.message, "Field `uuid` does not exist on resource `users`.");
  assert.match(error.hint, /Change `resources\[1\]\.primaryKey` to one of: id, email, name/);
});

test("the primary key may not be a sensitive field", () => {
  const errors = errorsFor((draft) => {
    resourceIn(draft, "users").primaryKey = "password_hash";
  });

  const error = errorAt(errors, "resources[1].primaryKey");
  assert.equal(error.message, "Sensitive field `password_hash` cannot be the primary key.");
  assert.match(error.hint, /every URL and every log line that reaches the record/);
  // The candidates offered are addressable ones; the secret is not among them.
  assert.match(error.hint, /one of: id, email, name, status, organization_id/);
  assert.equal(error.hint.includes("password_hash`"), false);
});

test("the label field must name a field of the resource", () => {
  const errors = errorsFor((draft) => {
    resourceIn(draft, "users").labelField = "display_name";
  });

  const error = errorAt(errors, "resources[1].labelField");
  assert.equal(error.message, "Field `display_name` does not exist on resource `users`.");
  assert.match(error.hint, /Change `resources\[1\]\.labelField` to one of: id, email, name/);
});

test("the label field may not be a sensitive field", () => {
  const errors = errorsFor((draft) => {
    resourceIn(draft, "users").labelField = "password_hash";
  });

  const error = errorAt(errors, "resources[1].labelField");
  assert.equal(error.message, "Sensitive field `password_hash` cannot be the label field.");
  assert.match(error.hint, /lists that belong to other resources/);
});

test("the label field may not be a hidden field", () => {
  const errors = errorsFor((draft) => {
    const organizations = resourceIn(draft, "organizations");
    fieldIn(organizations, "billing_email").hidden = true;
    organizations.labelField = "billing_email";
    organizations.views.table.columns = ["name", "plan", "created_at"];
    organizations.views.table.search = ["name"];
  });

  const error = errorAt(errors, "resources[0].labelField");
  assert.equal(error.message, "Hidden field `billing_email` cannot be the label field.");
  assert.match(error.hint, /name `organizations` with a field the admin shows/);
});

test("the label field must be a type that reads as a name", () => {
  const errors = errorsFor((draft) => {
    resourceIn(draft, "orders").labelField = "metadata";
  });

  const error = errorAt(errors, "resources[2].labelField");
  assert.equal(error.message, "Field `metadata` has type `json` and cannot be a label.");
  assert.equal(error.expected, "a field whose value reads as a name");
  assert.match(error.hint, /one of: id, reference, status, total_cents, placed_at/);
});

test("a resource with no label field is labelled by its primary key", () => {
  const definition = validFor((draft) => {
    delete resourceIn(draft, "users").labelField;
  });

  const users = definition.resources.find((resource) => resource.key === "users");
  assert.ok(users);
  assert.equal(users.labelField, undefined);
  assert.equal(labelFieldOf(users), "id");
});

test("a relation field must target a resource that exists", () => {
  const errors = errorsFor((draft) => {
    const field = resourceIn(draft, "users").fields.find((candidate) => candidate.key === "organization_id");
    assert.ok(field);
    if (field.type !== "relation") throw new Error("the fixture's `organization_id` is no longer a relation field");
    field.target = "companies";
  });

  const error = errorAt(errors, "resources[1].fields[5].target");
  assert.equal(error.message, "Relation field `organization_id` targets unknown resource `companies`.");
  assert.equal(error.hint, "Change `resources[1].fields[5].target` to one of: organizations, users, orders.");
});

test("a relationship must target a resource that exists", () => {
  const errors = errorsFor((draft) => {
    resourceIn(draft, "users").relationships = [
      { key: "invoices", kind: "hasMany", target: "invoices", foreignKey: "user_id" },
    ];
  });

  const error = errorAt(errors, "resources[1].relationships[0].target");
  assert.equal(error.message, "Relationship `invoices` targets unknown resource `invoices`.");
  assert.equal(error.hint, "Change `resources[1].relationships[0].target` to one of: organizations, users, orders.");
});

test("a belongsTo foreign key must exist on the resource that declares it", () => {
  const errors = errorsFor((draft) => {
    resourceIn(draft, "users").relationships = [
      { key: "organization", kind: "belongsTo", target: "organizations", foreignKey: "org_id" },
    ];
  });

  const error = errorAt(errors, "resources[1].relationships[0].foreignKey");
  assert.equal(error.message, "Foreign key `org_id` does not exist on resource `users`.");
  assert.match(error.hint, /A `belongsTo` relationship reads its foreign key from `users`.*organization_id/);
});

test("a hasMany foreign key must exist on the target resource", () => {
  const errors = errorsFor((draft) => {
    resourceIn(draft, "users").relationships = [
      { key: "orders", kind: "hasMany", target: "orders", foreignKey: "owner_id" },
    ];
  });

  const error = errorAt(errors, "resources[1].relationships[0].foreignKey");
  assert.equal(error.message, "Foreign key `owner_id` does not exist on resource `orders`.");
  assert.match(error.hint, /A `hasMany` relationship reads its foreign key from `orders`.*user_id/);
});
