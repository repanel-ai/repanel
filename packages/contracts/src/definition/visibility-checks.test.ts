import assert from "node:assert/strict";
import { test } from "node:test";
import { errorAt, errorsFor, resourceIn, validFor } from "./draft.test-helpers.js";

/** When an action is offered, and what a precondition is allowed to read. */

const APPROVE = {
  key: "approve",
  label: "Approve",
  confirm: "Approve this user?",
  kind: "httpCall",
  method: "POST",
  url: "https://api.acme.test/repanel/users/{id}/approve",
} as const;

/** The same action, with whatever precondition a case is about. */
function approving(visibleWhen: unknown) {
  return { ...APPROVE, visibleWhen } as never;
}

test("an action without a precondition is offered on every record", () => {
  const definition = validFor((draft) => {
    resourceIn(draft, "users").actions = [{ ...APPROVE }];
  });

  const users = definition.resources.find((resource) => resource.key === "users");
  assert.ok(users);
  assert.equal(users.actions[0]?.visibleWhen, undefined);
});

test("a precondition may compare an enum field against one of its values", () => {
  const definition = validFor((draft) => {
    resourceIn(draft, "users").actions = [approving({ field: "status", equals: "invited" })];
  });

  const users = definition.resources.find((resource) => resource.key === "users");
  assert.ok(users);
  assert.deepEqual(users.actions[0]?.visibleWhen, { field: "status", equals: "invited" });
});

test("a precondition may ask only that a field is set", () => {
  const definition = validFor((draft) => {
    resourceIn(draft, "users").actions = [approving({ field: "trial_ends_on", isSet: true })];
  });

  const users = definition.resources.find((resource) => resource.key === "users");
  assert.ok(users);
  assert.deepEqual(users.actions[0]?.visibleWhen, { field: "trial_ends_on", isSet: true });
});

test("a precondition must name a field of the resource", () => {
  const errors = errorsFor((draft) => {
    resourceIn(draft, "users").actions = [approving({ field: "state", equals: "active" })];
  });

  const error = errorAt(errors, "resources[1].actions[0].visibleWhen.field");
  assert.equal(error.message, "Field `state` does not exist on resource `users`.");
  assert.match(error.hint, /Change `resources\[1\]\.actions\[0\]\.visibleWhen\.field` to one of: id, email, name/);
});

test("a precondition on an enum field must compare against one of its values", () => {
  const errors = errorsFor((draft) => {
    resourceIn(draft, "users").actions = [approving({ field: "status", equals: "pending" })];
  });

  const error = errorAt(errors, "resources[1].actions[0].visibleWhen.equals");
  assert.equal(error.message, "`pending` is not one of the values of enum field `status`.");
  assert.equal(error.expected, "one of: invited, active, suspended");
  assert.equal(
    error.hint,
    "Change `resources[1].actions[0].visibleWhen.equals` to one of: invited, active, suspended.",
  );
});

/**
 * Which fields an `equals` may name, one type at a time. The fixture's `users`
 * carries one field of every type on purpose, so each case names a real field
 * rather than inventing one (DECISIONS #039).
 */

const COMPARABLE: ReadonlyArray<readonly [string, string, string | number | boolean]> = [
  ["name", "text", "Ada"],
  ["email", "email", "ada@acme.test"],
  ["avatar_url", "url", "https://cdn.acme.test/ada.png"],
  ["login_count", "number", 3],
  ["is_active", "boolean", false],
];

for (const [field, type, value] of COMPARABLE) {
  test(`a precondition may compare a ${type} field against a matching literal`, () => {
    const definition = validFor((draft) => {
      resourceIn(draft, "users").actions = [approving({ field, equals: value })];
    });

    const users = definition.resources.find((resource) => resource.key === "users");
    assert.ok(users);
    assert.deepEqual(users.actions[0]?.visibleWhen, { field, equals: value });
  });
}

/**
 * The types no literal can name. Each of these comparisons parses, and each of
 * them would then never hold — a button an operator can never be offered and
 * nothing anywhere would say why.
 */

const UNCOMPARABLE: ReadonlyArray<readonly [string, string]> = [
  ["organization_id", "relation"],
  ["preferences", "json"],
  ["trial_ends_on", "date"],
  ["created_at", "dateTime"],
  ["notes", "longText"],
];

for (const [field, type] of UNCOMPARABLE) {
  test(`a precondition cannot compare a ${type} field with equals`, () => {
    const errors = errorsFor((draft) => {
      resourceIn(draft, "users").actions = [approving({ field, equals: "anything" })];
    });

    const error = errorAt(errors, "resources[1].actions[0].visibleWhen.field");
    assert.equal(
      error.message,
      `A \`visibleWhen\` cannot compare field \`${field}\` of type \`${type}\` with \`equals\`.`,
    );
    assert.equal(error.expected, "a field of type text, enum, boolean, number, email, url");
    assert.match(error.hint, /"isSet": true/);
    assert.match(error.hint, /the endpoint the action calls/);
  });
}

/** A comparable field still refuses a literal of the wrong kind: nothing coerces. */

const MISMATCHED: ReadonlyArray<readonly [string, string, string | number | boolean, string]> = [
  ["name", "text", 42, "`42` is not a string."],
  ["email", "email", true, "`true` is not a string."],
  ["avatar_url", "url", 1, "`1` is not a string."],
  ["login_count", "number", "3", "`3` is not a number."],
  ["is_active", "boolean", "true", "`true` is not a boolean."],
];

for (const [field, type, value, message] of MISMATCHED) {
  test(`a precondition on a ${type} field refuses a literal of another type`, () => {
    const errors = errorsFor((draft) => {
      resourceIn(draft, "users").actions = [approving({ field, equals: value })];
    });

    const error = errorAt(errors, "resources[1].actions[0].visibleWhen.equals");
    assert.equal(error.message, message);
    assert.match(error.hint, /nothing is coerced across types/);
  });
}

test("the hint for a boolean field names both literals it accepts", () => {
  const errors = errorsFor((draft) => {
    resourceIn(draft, "users").actions = [approving({ field: "is_active", equals: "true" })];
  });

  const error = errorAt(errors, "resources[1].actions[0].visibleWhen.equals");
  assert.equal(error.expected, "`true` or `false`");
  assert.match(error.hint, /Change `resources\[1\]\.actions\[0\]\.visibleWhen\.equals` to `true` or `false`/);
});

/** `isSet` reads whether the record holds anything, which every type answers. */
test("a precondition may ask that any non-sensitive field is set, whatever its type", () => {
  const readable = [
    "id",
    "email",
    "name",
    "status",
    "organization_id",
    "is_active",
    "notes",
    "created_at",
    "avatar_url",
    "trial_ends_on",
    "login_count",
    "preferences",
  ];

  for (const field of readable) {
    const definition = validFor((draft) => {
      resourceIn(draft, "users").actions = [approving({ field, isSet: true })];
    });

    const users = definition.resources.find((resource) => resource.key === "users");
    assert.ok(users);
    assert.deepEqual(users.actions[0]?.visibleWhen, { field, isSet: true });
  }
});

/**
 * The button's presence is the answer. A condition on a secret turns the detail
 * page into the same oracle a filter on one would be (DECISIONS #014), and the
 * hint offers only fixes that keep the secret contained (DECISIONS #015).
 */
test("a precondition may not read a sensitive field", () => {
  const errors = errorsFor((draft) => {
    resourceIn(draft, "users").actions = [approving({ field: "password_hash", isSet: true })];
  });

  const error = errorAt(errors, "resources[1].actions[0].visibleWhen.field");
  assert.equal(
    error.message,
    "Sensitive field `password_hash` cannot decide whether an action is offered.",
  );
  assert.equal(error.expected, "a field that is not marked `sensitive`");
  assert.match(error.hint, /one record at a time/);
  assert.match(error.hint, /let the endpoint refuse/);
  assert.doesNotMatch(error.hint, /unset|remove `sensitive`/i);
});

/** `hidden` is a display choice and a precondition displays nothing (#014). */
test("a precondition may read a hidden field", () => {
  const definition = validFor((draft) => {
    resourceIn(draft, "users").actions = [approving({ field: "preferences", isSet: true })];
  });

  const users = definition.resources.find((resource) => resource.key === "users");
  assert.ok(users);
  assert.deepEqual(users.actions[0]?.visibleWhen, { field: "preferences", isSet: true });
});

test("a precondition that says nothing about its field is refused", () => {
  const errors = errorsFor((draft) => {
    resourceIn(draft, "users").actions = [approving({ field: "status" })];
  });

  const error = errorAt(errors, "resources[1].actions[0].visibleWhen");
  assert.equal(error.message, "A `visibleWhen` states no condition.");
  assert.equal(error.expected, "exactly one of `equals` or `isSet`");
  assert.match(error.hint, /Add `equals` or `isSet: true`/);
});

/** Two conditions is where a precondition starts becoming a rule (#010). */
test("a precondition states one condition, not two", () => {
  const errors = errorsFor((draft) => {
    resourceIn(draft, "users").actions = [
      approving({ field: "status", equals: "active", isSet: true }),
    ];
  });

  const error = errorAt(errors, "resources[1].actions[0].visibleWhen");
  assert.equal(error.message, "A `visibleWhen` states 2 conditions: equals, isSet.");
  assert.equal(error.expected, "exactly one of `equals` or `isSet`");
  assert.match(error.hint, /belongs in the endpoint the action calls/);
});

test("`isSet` is only ever true — there is no negative form", () => {
  const errors = errorsFor((draft) => {
    resourceIn(draft, "users").actions = [approving({ field: "trial_ends_on", isSet: false })];
  });

  const error = errorAt(errors, "resources[1].actions[0].visibleWhen.isSet");
  assert.equal(error.message, "`false` is not a valid value for `isSet`.");
  assert.equal(error.expected, "`true`");
});

test("a precondition carries no keys beyond the one condition it states", () => {
  const errors = errorsFor((draft) => {
    resourceIn(draft, "users").actions = [
      approving({ field: "status", equals: "active", not: "suspended" }),
    ];
  });

  const error = errorAt(errors, "resources[1].actions[0].visibleWhen.not");
  assert.equal(error.message, "Unrecognized key `not`.");
});
