import assert from "node:assert/strict";
import { test } from "node:test";
import type { ValidationError } from "./errors.js";
import { saasDefinition } from "./fixtures/index.js";
import type { Definition, DefinitionInput } from "./schema.js";
import { validateDefinition } from "./validate.js";

type DraftResource = DefinitionInput["resources"][number];
type DraftField = DraftResource["fields"][number];

function errorsFor(mutate: (draft: DefinitionInput) => void): ValidationError[] {
  const draft = structuredClone(saasDefinition);
  mutate(draft);
  const result = validateDefinition(draft);
  if (result.valid) throw new Error("expected the definition to be invalid");
  return result.errors;
}

function errorAt(errors: ValidationError[], path: string): ValidationError {
  const error = errors.find((candidate) => candidate.path === path);
  if (!error) throw new Error(`no error at \`${path}\`; got:\n${JSON.stringify(errors, null, 2)}`);
  return error;
}

function validFor(mutate: (draft: DefinitionInput) => void): Definition {
  const draft = structuredClone(saasDefinition);
  mutate(draft);
  const result = validateDefinition(draft);
  if (!result.valid) {
    throw new Error(`expected a valid definition, got:\n${JSON.stringify(result.errors, null, 2)}`);
  }
  return result.definition;
}

function fieldIn(resource: DraftResource, key: string): DraftField {
  const found = resource.fields.find((field) => field.key === key);
  if (!found) throw new Error(`the fixture's resource has no field \`${key}\``);
  return found;
}

function resourceIn(draft: DefinitionInput, key: string): DraftResource {
  const found = draft.resources.find((resource) => resource.key === key);
  if (!found) throw new Error(`the fixture has no resource \`${key}\``);
  return found;
}

test("resource keys must be unique", () => {
  const errors = errorsFor((draft) => {
    resourceIn(draft, "orders").key = "users";
  });

  const error = errorAt(errors, "resources[2].key");
  assert.equal(error.message, "Duplicate resource key `users`.");
  assert.match(error.hint, /Rename `resources\[2\]\.key` or remove the duplicate resource/);
});

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

test("navigation may only reference resources that exist", () => {
  const errors = errorsFor((draft) => {
    draft.navigation = [{ label: "Billing", resources: ["invoices"] }];
  });

  const error = errorAt(errors, "navigation[0].resources[0]");
  assert.equal(error.message, "Navigation references unknown resource `invoices`.");
  assert.equal(error.hint, "Change `navigation[0].resources[0]` to one of: organizations, users, orders.");
});

test("the primary key must name a field of the resource", () => {
  const errors = errorsFor((draft) => {
    resourceIn(draft, "users").primaryKey = "uuid";
  });

  const error = errorAt(errors, "resources[1].primaryKey");
  assert.equal(error.message, "Field `uuid` does not exist on resource `users`.");
  assert.match(error.hint, /Change `resources\[1\]\.primaryKey` to one of: id, email, name/);
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

test("a table column must name a field of the resource", () => {
  const errors = errorsFor((draft) => {
    resourceIn(draft, "users").views.table.columns[1] = "full_name";
  });

  const error = errorAt(errors, "resources[1].views.table.columns[1]");
  assert.equal(error.message, "Field `full_name` does not exist on resource `users`.");
  assert.match(error.hint, /Change `resources\[1\]\.views\.table\.columns\[1\]` to one of: id, email, name/);
});

test("a sensitive field may not be a table column", () => {
  const errors = errorsFor((draft) => {
    resourceIn(draft, "users").views.table.columns.push("password_hash");
  });

  const error = errorAt(errors, "resources[1].views.table.columns[5]");
  assert.equal(error.message, "Sensitive field `password_hash` cannot be a table column.");
  assert.equal(
    error.hint,
    "Remove `password_hash` from `resources[1].views.table.columns` and show a non-sensitive field instead; a sensitive value never leaves the API unmasked.",
  );
});

test("the default sort must name a field of the resource", () => {
  const errors = errorsFor((draft) => {
    resourceIn(draft, "users").views.table.defaultSort.field = "signup_date";
  });

  const error = errorAt(errors, "resources[1].views.table.defaultSort.field");
  assert.equal(error.message, "Field `signup_date` does not exist on resource `users`.");
  assert.match(error.hint, /to one of: id, email, name/);
});

test("a searchable field must name a field of the resource", () => {
  const errors = errorsFor((draft) => {
    resourceIn(draft, "users").views.table.search = ["nickname"];
  });

  const error = errorAt(errors, "resources[1].views.table.search[0]");
  assert.equal(error.message, "Field `nickname` does not exist on resource `users`.");
  assert.match(error.hint, /Change `resources\[1\]\.views\.table\.search\[0\]` to one of: id, email, name/);
});

test("only text-typed fields are searchable", () => {
  const errors = errorsFor((draft) => {
    resourceIn(draft, "users").views.table.search = ["email", "is_active"];
  });

  const error = errorAt(errors, "resources[1].views.table.search[1]");
  assert.equal(error.message, "Field `is_active` has type `boolean` and cannot be searched.");
  assert.equal(
    error.hint,
    "Remove `is_active` from `resources[1].views.table.search`; free-text search only covers text, longText, email, url fields.",
  );
});

test("a filter must bind to a field of the resource", () => {
  const errors = errorsFor((draft) => {
    resourceIn(draft, "users").views.table.filters = [{ field: "tier", kind: "enum" }];
  });

  const error = errorAt(errors, "resources[1].views.table.filters[0].field");
  assert.equal(error.message, "Field `tier` does not exist on resource `users`.");
  assert.match(error.hint, /to one of: id, email, name/);
});

test("a filter kind must match the type of the field it binds to", () => {
  const errors = errorsFor((draft) => {
    resourceIn(draft, "users").views.table.filters = [{ field: "status", kind: "boolean" }];
  });

  const error = errorAt(errors, "resources[1].views.table.filters[0].kind");
  assert.equal(error.message, "Filter kind `boolean` does not match field `status` of type `enum`.");
  assert.equal(error.expected, "kind `enum` for field type `enum`");
  assert.match(error.hint, /Change `resources\[1\]\.views\.table\.filters\[0\]\.kind` to `enum`/);
});

test("a field of a type v0 cannot filter is rejected outright", () => {
  const errors = errorsFor((draft) => {
    resourceIn(draft, "users").views.table.filters = [{ field: "notes", kind: "enum" }];
  });

  const error = errorAt(errors, "resources[1].views.table.filters[0]");
  assert.equal(error.message, "Field `notes` has type `longText` and cannot be filtered.");
  assert.match(error.hint, /Remove the filter at `resources\[1\]\.views\.table\.filters\[0\]`/);
});

test("a detail section field must name a field of the resource", () => {
  const errors = errorsFor((draft) => {
    resourceIn(draft, "users").views.detail.sections = [{ title: "Account", fields: ["email", "full_name"] }];
  });

  const error = errorAt(errors, "resources[1].views.detail.sections[0].fields[1]");
  assert.equal(error.message, "Field `full_name` does not exist on resource `users`.");
  assert.match(error.hint, /to one of: id, email, name/);
});

test("a related list must name a relationship of the resource", () => {
  const errors = errorsFor((draft) => {
    resourceIn(draft, "users").views.detail.relatedLists = ["invoices"];
  });

  const error = errorAt(errors, "resources[1].views.detail.relatedLists[0]");
  assert.equal(error.message, "Related list references unknown relationship `invoices`.");
  assert.equal(error.hint, "Change `resources[1].views.detail.relatedLists[0]` to one of: organization, orders.");
});

test("a related list on a resource with no relationships says so", () => {
  const errors = errorsFor((draft) => {
    const orders = resourceIn(draft, "orders");
    orders.relationships = [];
    orders.views.detail.relatedLists = ["customer"];
  });

  const error = errorAt(errors, "resources[2].views.detail.relatedLists[0]");
  assert.equal(
    error.hint,
    "Resource `orders` defines no relationships — add one to `resources[2].relationships` first.",
  );
});

test("a dbUpdate action must name a field of the resource", () => {
  const errors = errorsFor((draft) => {
    resourceIn(draft, "users").actions = [
      { key: "suspend", label: "Suspend", confirm: "Suspend?", kind: "dbUpdate", field: "state", value: "suspended" },
    ];
  });

  const error = errorAt(errors, "resources[1].actions[0].field");
  assert.equal(error.message, "Field `state` does not exist on resource `users`.");
  assert.match(error.hint, /Change `resources\[1\]\.actions\[0\]\.field` to one of: id, email, name/);
});

test("a dbUpdate action on an enum field must write one of its values", () => {
  const errors = errorsFor((draft) => {
    resourceIn(draft, "users").actions = [
      { key: "ban", label: "Ban", confirm: "Ban this user?", kind: "dbUpdate", field: "status", value: "banned" },
    ];
  });

  const error = errorAt(errors, "resources[1].actions[0].value");
  assert.equal(error.message, "`banned` is not one of the values of enum field `status`.");
  assert.equal(error.expected, "one of: invited, active, suspended");
  assert.equal(error.hint, "Change `resources[1].actions[0].value` to one of: invited, active, suspended.");
});

test("an httpCall URL may only interpolate fields of the resource", () => {
  const errors = errorsFor((draft) => {
    resourceIn(draft, "users").actions = [
      {
        key: "resend_invite",
        label: "Resend invite",
        confirm: "Resend?",
        kind: "httpCall",
        method: "POST",
        url: "https://api.acme.test/repanel/users/{user_id}/resend-invite",
      },
    ];
  });

  const error = errorAt(errors, "resources[1].actions[0].url");
  assert.equal(error.message, "URL template references unknown field `{user_id}`.");
  assert.match(error.hint, /Replace `\{user_id\}` in `resources\[1\]\.actions\[0\]\.url` with one of: id, email, name/);
});

test("independent referential problems are all reported at once", () => {
  const errors = errorsFor((draft) => {
    const users = resourceIn(draft, "users");
    users.primaryKey = "uuid";
    users.views.table.columns[0] = "mail";
    users.views.detail.relatedLists = ["invoices"];
  });

  assert.deepEqual(
    errors.map((error) => error.path).sort(),
    [
      "resources[1].primaryKey",
      "resources[1].views.detail.relatedLists[0]",
      "resources[1].views.table.columns[0]",
    ],
  );
});

test("an httpCall URL may not interpolate a sensitive field", () => {
  const errors = errorsFor((draft) => {
    resourceIn(draft, "users").actions = [
      {
        key: "verify",
        label: "Verify",
        confirm: "Verify this user?",
        kind: "httpCall",
        method: "POST",
        url: "https://api.acme.test/repanel/users/{password_hash}/verify",
      },
    ];
  });

  const error = errorAt(errors, "resources[1].actions[0].url");
  assert.equal(error.message, "URL template interpolates sensitive field `{password_hash}`.");
  assert.match(error.hint, /access logs, proxies and error trackers/);
  assert.match(error.hint, /primary key `\{id\}`/);
});

test("a hidden field may not be a table column", () => {
  const errors = errorsFor((draft) => {
    resourceIn(draft, "organizations").views.table.columns.push("settings");
  });

  const error = errorAt(errors, "resources[0].views.table.columns[4]");
  assert.equal(error.message, "Hidden field `settings` cannot be a table column.");
  assert.equal(
    error.hint,
    "`hidden` means detail-only: remove `settings` from `resources[0].views.table.columns`, or unset `hidden` on `resources[0].fields[4]`.",
  );
});

test("a hidden field may not be searched", () => {
  const errors = errorsFor((draft) => {
    const users = resourceIn(draft, "users");
    fieldIn(users, "notes").hidden = true;
  });

  const error = errorAt(errors, "resources[1].views.table.search[2]");
  assert.equal(error.message, "Hidden field `notes` cannot be searched.");
  assert.match(error.hint, /^`hidden` means detail-only: remove `notes` from `resources\[1\]\.views\.table\.search`/);
});

test("a hidden field may not back a filter", () => {
  const errors = errorsFor((draft) => {
    const users = resourceIn(draft, "users");
    fieldIn(users, "is_active").hidden = true;
  });

  const error = errorAt(errors, "resources[1].views.table.filters[1].field");
  assert.equal(error.message, "Hidden field `is_active` cannot be filtered.");
  assert.match(error.hint, /remove the filter at `resources\[1\]\.views\.table\.filters\[1\]`/);
});

test("a hidden field may not be the default sort", () => {
  const errors = errorsFor((draft) => {
    const users = resourceIn(draft, "users");
    users.views.table.columns = ["email"];
    users.views.table.filters = [];
    fieldIn(users, "created_at").hidden = true;
  });

  const error = errorAt(errors, "resources[1].views.table.defaultSort.field");
  assert.equal(error.message, "Hidden field `created_at` cannot be the default sort.");
  assert.match(error.hint, /sort by a field the table displays/);
});

test("a hidden field may still appear in a detail section", () => {
  const definition = validFor((draft) => {
    const users = resourceIn(draft, "users");
    fieldIn(users, "notes").hidden = true;
    users.views.table.search = ["email", "name"];
  });

  const users = definition.resources.find((resource) => resource.key === "users");
  assert.ok(users);
  assert.deepEqual(users.views.detail.sections.at(-1)?.fields, ["notes"], "hidden means detail-only, not invisible");
});

test("a dbUpdate action may set a boolean field", () => {
  const definition = validFor((draft) => {
    resourceIn(draft, "users").actions = [
      {
        key: "activate",
        label: "Activate",
        confirm: "Activate this user?",
        kind: "dbUpdate",
        field: "is_active",
        value: true,
      },
    ];
  });

  const users = definition.resources.find((resource) => resource.key === "users");
  assert.ok(users);
  const action = users.actions[0];
  assert.ok(action);
  assert.equal(action.kind === "dbUpdate" && action.value, true);
});

test("a dbUpdate action on a boolean field must write a boolean literal", () => {
  const errors = errorsFor((draft) => {
    resourceIn(draft, "users").actions = [
      {
        key: "activate",
        label: "Activate",
        confirm: "Activate this user?",
        kind: "dbUpdate",
        field: "is_active",
        value: "true",
      },
    ];
  });

  const error = errorAt(errors, "resources[1].actions[0].value");
  assert.equal(error.message, "`true` is not a boolean.");
  assert.equal(error.expected, "`true` or `false`");
  assert.match(error.hint, /Change `resources\[1\]\.actions\[0\]\.value` to `true` or `false`/);
});

test("a dbUpdate action may not target a sensitive field", () => {
  const errors = errorsFor((draft) => {
    resourceIn(draft, "users").actions = [
      {
        key: "reset_password",
        label: "Reset password",
        confirm: "Reset this password?",
        kind: "dbUpdate",
        field: "password_hash",
        value: "",
      },
    ];
  });

  const error = errorAt(errors, "resources[1].actions[0].field");
  assert.equal(error.message, "A `dbUpdate` action cannot target sensitive field `password_hash`.");
  assert.match(error.hint, /Secrets are never written from the admin/);
  assert.match(error.hint, /`httpCall` action \(see DECISIONS #010\)/);
});

const REJECTED_DBUPDATE_TARGETS: DraftField[] = [
  { key: "probe", label: "Probe", type: "text" },
  { key: "probe", label: "Probe", type: "longText" },
  { key: "probe", label: "Probe", type: "number" },
  { key: "probe", label: "Probe", type: "date" },
  { key: "probe", label: "Probe", type: "dateTime" },
  { key: "probe", label: "Probe", type: "email" },
  { key: "probe", label: "Probe", type: "url" },
  { key: "probe", label: "Probe", type: "json" },
  { key: "probe", label: "Probe", type: "relation", target: "organizations" },
];

for (const target of REJECTED_DBUPDATE_TARGETS) {
  test(`a dbUpdate action may not target a ${target.type} field`, () => {
    const errors = errorsFor((draft) => {
      const users = resourceIn(draft, "users");
      users.fields.push(structuredClone(target));
      users.actions = [
        {
          key: "set_probe",
          label: "Set probe",
          confirm: "Set the probe?",
          kind: "dbUpdate",
          field: "probe",
          value: "anything",
        },
      ];
    });

    const error = errorAt(errors, "resources[1].actions[0].field");
    assert.equal(error.message, `A \`dbUpdate\` action cannot target field \`probe\` of type \`${target.type}\`.`);
    assert.equal(error.expected, "a field of type `enum` or `boolean`");
    assert.match(error.hint, /belongs in an endpoint in your application, called with an `httpCall` action \(see DECISIONS #010\)/);
  });
}

test("a sensitive field may not be searched", () => {
  const errors = errorsFor((draft) => {
    resourceIn(draft, "users").views.table.search = ["email", "password_hash"];
  });

  const error = errorAt(errors, "resources[1].views.table.search[1]");
  assert.equal(error.message, "Sensitive field `password_hash` cannot be searched.");
  assert.equal(
    error.hint,
    "Remove `password_hash` from `resources[1].views.table.search` and search a non-sensitive field instead; a sensitive value must never be probeable.",
  );
});

test("a sensitive field may not back a filter", () => {
  const errors = errorsFor((draft) => {
    resourceIn(draft, "users").views.table.filters = [{ field: "password_hash", kind: "enum" }];
  });

  const error = errorAt(errors, "resources[1].views.table.filters[0].field");
  assert.equal(error.message, "Sensitive field `password_hash` cannot be filtered.");
  assert.equal(
    error.hint,
    "Remove the filter at `resources[1].views.table.filters[0]` and filter a non-sensitive field instead; a sensitive value must never be probeable.",
  );
});

test("a field that is both sensitive and hidden reports the sensitive problem", () => {
  const errors = errorsFor((draft) => {
    const users = resourceIn(draft, "users");
    fieldIn(users, "password_hash").hidden = true;
    users.views.table.search = ["password_hash"];
  });

  const matching = errors.filter((error) => error.path === "resources[1].views.table.search[0]");
  assert.equal(matching.length, 1, "one location reports one problem");
  assert.equal(matching[0]?.message, "Sensitive field `password_hash` cannot be searched.");
});

test("a dbUpdate action may target a hidden field", () => {
  const definition = validFor((draft) => {
    const users = resourceIn(draft, "users");
    fieldIn(users, "is_active").hidden = true;
    users.views.table.filters = [
      { field: "status", kind: "enum" },
      { field: "organization_id", kind: "relation" },
      { field: "created_at", kind: "dateRange" },
    ];
    users.actions = [
      {
        key: "activate",
        label: "Activate",
        confirm: "Activate this user?",
        kind: "dbUpdate",
        field: "is_active",
        value: true,
      },
    ];
  });

  const users = definition.resources.find((resource) => resource.key === "users");
  assert.ok(users);
  const action = users.actions[0];
  assert.ok(action);
  assert.equal(action.kind === "dbUpdate" && action.field, "is_active", "hidden is a display concern, not a write rule");
});

/**
 * Every way a definition can go wrong at a reference site. The tripwire below
 * reads every hint these produce, so a new hint is covered the moment its check
 * is added to one of these cases.
 */
const ERROR_CASES: ReadonlyArray<(draft: DefinitionInput) => void> = [
  (draft) => {
    resourceIn(draft, "users").views.table.columns.push("password_hash");
  },
  (draft) => {
    resourceIn(draft, "users").views.table.search = ["password_hash"];
  },
  (draft) => {
    resourceIn(draft, "users").views.table.filters = [{ field: "password_hash", kind: "enum" }];
  },
  (draft) => {
    resourceIn(draft, "users").actions = [
      {
        key: "verify",
        label: "Verify",
        confirm: "Verify?",
        kind: "httpCall",
        method: "POST",
        url: "https://api.acme.test/repanel/users/{password_hash}/verify",
      },
    ];
  },
  (draft) => {
    resourceIn(draft, "users").actions = [
      { key: "reset", label: "Reset", confirm: "Reset?", kind: "dbUpdate", field: "password_hash", value: "" },
    ];
  },
  (draft) => {
    const users = resourceIn(draft, "users");
    fieldIn(users, "password_hash").hidden = true;
    users.views.table.search = ["password_hash"];
  },
  (draft) => {
    resourceIn(draft, "organizations").views.table.columns.push("settings");
  },
  (draft) => {
    fieldIn(resourceIn(draft, "users"), "notes").hidden = true;
  },
  (draft) => {
    fieldIn(resourceIn(draft, "users"), "is_active").hidden = true;
  },
  (draft) => {
    fieldIn(resourceIn(draft, "users"), "created_at").hidden = true;
  },
  (draft) => {
    resourceIn(draft, "orders").actions = [
      { key: "touch", label: "Touch", confirm: "Touch?", kind: "dbUpdate", field: "metadata", value: "x" },
    ];
  },
  (draft) => {
    resourceIn(draft, "users").actions = [
      { key: "ban", label: "Ban", confirm: "Ban?", kind: "dbUpdate", field: "status", value: "banned" },
    ];
  },
  (draft) => {
    resourceIn(draft, "users").views.table.columns[0] = "mail";
  },
  (draft) => {
    draft.navigation = [{ label: "Billing", resources: ["invoices"] }];
  },
  (draft) => {
    fieldIn(resourceIn(draft, "users"), "name").key = "email";
  },
  (draft) => {
    resourceIn(draft, "users").views.detail.relatedLists = ["invoices"];
  },
  (draft) => {
    resourceIn(draft, "users").relationships = [
      { key: "organization", kind: "belongsTo", target: "organizations", foreignKey: "org_id" },
    ];
  },
];

/**
 * `sensitive` may appear in a hint only as a description of what to use
 * instead, never as something to change. Any other phrasing is a bypass: an
 * authoring agent told it could unset the flag takes that one-line path and
 * reopens the leak. A new phrase trips this deliberately — add it here only
 * after checking it points at a safe fix.
 */
const SAFE_SENSITIVE_PHRASES = [/non-sensitive/gi, /a sensitive value/gi];

test("no hint suggests unsetting or weakening `sensitive`", () => {
  const hints = ERROR_CASES.flatMap((mutate) => errorsFor(mutate).map((error) => error.hint));
  assert.ok(hints.length >= ERROR_CASES.length, "every case must produce at least one hint");

  for (const hint of hints) {
    const remaining = SAFE_SENSITIVE_PHRASES.reduce((text, phrase) => text.replace(phrase, ""), hint);
    assert.equal(/sensitive/i.test(remaining), false, `hint may not point at \`sensitive\` as a fix: ${hint}`);
  }
});
