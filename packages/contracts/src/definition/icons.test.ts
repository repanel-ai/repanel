import assert from "node:assert/strict";
import { test } from "node:test";
import { errorAt, errorsFor, resourceIn, validFor } from "./draft.test-helpers.js";
import { DEFAULT_ICON, ICON_NAMES } from "./icons.js";

/** What a resource may say it looks like. */

test("a resource that says nothing wears the generic mark", () => {
  const definition = validFor((draft) => {
    delete resourceIn(draft, "users").icon;
  });

  assert.equal(definition.resources[1]?.icon, DEFAULT_ICON);
});

test("a name outside the vocabulary is refused, with the whole vocabulary named", () => {
  const errors = errorsFor((draft) => {
    resourceIn(draft, "users").icon = "rocket" as never;
  });

  const error = errorAt(errors, "resources[1].icon");
  assert.equal(error.message, "`rocket` is not a valid value for `icon`.");
  // Never truncated: a hint that hides an option hides the answer (#020).
  for (const name of ICON_NAMES) assert.ok(error.hint.includes(name), `hint omits \`${name}\``);
});

test("the vocabulary is closed and every name in it is unique", () => {
  assert.equal(new Set(ICON_NAMES).size, ICON_NAMES.length);
  assert.ok(ICON_NAMES.includes(DEFAULT_ICON));
});
