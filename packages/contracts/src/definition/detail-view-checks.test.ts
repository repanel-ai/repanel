import assert from "node:assert/strict";
import { test } from "node:test";
import { errorAt, errorsFor, fieldIn, resourceIn, validFor } from "./draft.test-helpers.js";

/** What a detail view may name — and what it may name that a list may not. */

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
