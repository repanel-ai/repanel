import assert from "node:assert/strict";
import { test } from "node:test";
import { errorAt, errorsFor, fieldIn, resourceIn } from "./draft.test-helpers.js";

/** What a table view may name, and what a list must never put on the wire. */

test("a table column must name a field of the resource", () => {
  const errors = errorsFor((draft) => {
    resourceIn(draft, "users").views.table.columns[1] = "full_name";
  });

  const error = errorAt(errors, "resources[1].views.table.columns[1]");
  assert.equal(error.message, "Field `full_name` does not exist on resource `users`.");
  assert.match(error.hint, /Change `resources\[1\]\.views\.table\.columns\[1\]` to one of: id, email, name/);
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

test("a sensitive field may not be the default sort", () => {
  const errors = errorsFor((draft) => {
    resourceIn(draft, "users").views.table.defaultSort.field = "password_hash";
  });

  const error = errorAt(errors, "resources[1].views.table.defaultSort.field");
  assert.equal(error.message, "Sensitive field `password_hash` cannot be the default sort.");
  assert.equal(error.expected, "a field that is not marked `sensitive`");
  assert.equal(
    error.hint,
    "Ordering by a field exposes the order it puts the rows in, which is readable from the pages even though the values are not — change `resources[1].views.table.defaultSort.field` to a non-sensitive field such as one of: id, email, name, status, organization_id, is_active, notes, created_at, avatar_url, trial_ends_on, login_count.",
  );
});

test("a sensitive default sort is never offered the bypass of unsetting the flag", () => {
  const errors = errorsFor((draft) => {
    resourceIn(draft, "users").views.table.defaultSort.field = "password_hash";
  });

  // DECISIONS #015: a `hidden` hint ends in "or unset `hidden` on …"; the
  // sensitive one must offer no equivalent way out.
  assert.doesNotMatch(errorAt(errors, "resources[1].views.table.defaultSort.field").hint, /unset/);
});

test("a field that is both sensitive and hidden reports the sensitive default sort", () => {
  const errors = errorsFor((draft) => {
    const users = resourceIn(draft, "users");
    fieldIn(users, "password_hash").hidden = true;
    users.views.table.defaultSort.field = "password_hash";
  });

  const matching = errors.filter(
    (error) => error.path === "resources[1].views.table.defaultSort.field",
  );
  assert.equal(matching.length, 1, "one location reports one problem");
  assert.equal(matching[0]?.message, "Sensitive field `password_hash` cannot be the default sort.");
});

