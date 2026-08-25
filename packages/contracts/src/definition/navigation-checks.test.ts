import assert from "node:assert/strict";
import { test } from "node:test";
import { errorAt, errorsFor, resourceIn } from "./draft.test-helpers.js";

/**
 * Navigation and resources, checked against each other in both directions.
 * The fixture's two groups name all three of its resources, once each, so
 * every case here breaks exactly one half of that.
 */

test("navigation may only reference resources that exist", () => {
  const errors = errorsFor((draft) => {
    draft.navigation[1]?.resources.push("invoices");
  });

  const error = errorAt(errors, "navigation[1].resources[1]");
  assert.equal(error.message, "Navigation references unknown resource `invoices`.");
  assert.equal(error.hint, "Change `navigation[1].resources[1]` to one of: organizations, users, orders.");
  assert.equal(errors.length, 1);
});

test("a resource no navigation group lists is reported at the resource", () => {
  const errors = errorsFor((draft) => {
    draft.navigation = [{ label: "Customers", resources: ["organizations", "users"] }];
  });

  const error = errorAt(errors, "resources[2]");
  assert.equal(error.message, "Resource `orders` is defined but no navigation group lists it.");
  assert.equal(error.expected, "a resource listed once in `navigation`");
  assert.match(error.hint, /^Add `orders` to a `navigation` group's `resources`, or remove `resources\[2\]`/);
  assert.equal(errors.length, 1, "an unlisted resource is one problem, told once");
});

test("the hint offers navigation first, and removal only as the deliberate choice", () => {
  const [error] = errorsFor((draft) => {
    draft.navigation = [{ label: "Customers", resources: ["organizations", "users"] }];
  });

  assert.ok(error);
  assert.ok(
    error.hint.indexOf("Add `orders`") < error.hint.indexOf("remove `resources[2]`"),
    "the repair comes before the removal",
  );
  assert.match(error.hint, /if the admin should not offer it at all/);
});

test("a resource two groups list is refused, and told where it already is", () => {
  const errors = errorsFor((draft) => {
    draft.navigation.push({ label: "Everything", resources: ["users"] });
  });

  const error = errorAt(errors, "navigation[2].resources[0]");
  assert.equal(error.message, "Navigation lists resource `users` more than once.");
  assert.equal(error.expected, "a resource key listed once in `navigation`");
  assert.match(error.hint, /already listed at `navigation\[0\]\.resources\[1\]`/);
  assert.equal(errors.length, 1);
});

test("a resource listed twice inside one group is refused too", () => {
  const errors = errorsFor((draft) => {
    draft.navigation[1]?.resources.push("orders");
  });

  const error = errorAt(errors, "navigation[1].resources[1]");
  assert.equal(error.message, "Navigation lists resource `orders` more than once.");
  assert.equal(errors.length, 1);
});

test("an entry that names nothing is reported once, never again as a repeat", () => {
  const errors = errorsFor((draft) => {
    draft.navigation[1]?.resources.push("invoices", "invoices");
  });

  assert.deepEqual(
    errors.map((error) => error.message),
    [
      "Navigation references unknown resource `invoices`.",
      "Navigation references unknown resource `invoices`.",
    ],
  );
});

/**
 * A misspelled entry is two true statements — the entry names nothing, and the
 * resource it meant is listed nowhere — and the first one's hint clears both.
 * Asserted so the pair is a decision rather than a surprise.
 */
test("a misspelled entry leaves the resource it meant unlisted, and both are said", () => {
  const errors = errorsFor((draft) => {
    draft.navigation = [
      { label: "Customers", resources: ["organizations", "users"] },
      { label: "Commerce", resources: ["order"] },
    ];
  });

  assert.deepEqual(errors.map((error) => error.path), [
    "navigation[1].resources[0]",
    "resources[2]",
  ]);
});

/**
 * A key claimed twice is one duplicate-key problem, not also two unlisted ones.
 * The second resource is not a resource: the first entry keeps the key.
 */
test("a duplicated resource key is not reported unlisted twice", () => {
  const errors = errorsFor((draft) => {
    resourceIn(draft, "orders").key = "users";
    draft.navigation = [{ label: "Customers", resources: ["organizations"] }];
  });

  errorAt(errors, "resources[2].key");
  assert.deepEqual(
    errors.filter((error) => /^resources\[\d+\]$/.test(error.path)),
    [errorAt(errors, "resources[1]")],
  );
  assert.equal(
    errorAt(errors, "resources[1]").message,
    "Resource `users` is defined but no navigation group lists it.",
  );
});
