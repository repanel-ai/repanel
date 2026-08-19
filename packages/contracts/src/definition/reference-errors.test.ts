import assert from "node:assert/strict";
import { test } from "node:test";
import { errorsFor, fieldIn, resourceIn } from "./draft.test-helpers.js";
import type { DefinitionInput } from "./schema.js";

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
  (draft) => {
    resourceIn(draft, "users").labelField = "password_hash";
  },
  (draft) => {
    resourceIn(draft, "users").primaryKey = "password_hash";
  },
  (draft) => {
    resourceIn(draft, "orders").labelField = "metadata";
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
