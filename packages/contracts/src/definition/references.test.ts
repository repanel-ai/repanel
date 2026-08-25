import assert from "node:assert/strict";
import { test } from "node:test";
import { errorAt, errorsFor, resourceIn } from "./draft.test-helpers.js";

/** The references the definition owns as a whole, and the pass's own promise. */

test("resource keys must be unique", () => {
  const errors = errorsFor((draft) => {
    resourceIn(draft, "orders").key = "users";
  });

  const error = errorAt(errors, "resources[2].key");
  assert.equal(error.message, "Duplicate resource key `users`.");
  assert.match(error.hint, /Rename `resources\[2\]\.key` or remove the duplicate resource/);
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
