import assert from "node:assert/strict";
import { test } from "node:test";
import { errorAt, errorsFor, fieldIn, resourceIn, validFor, type DraftField } from "./draft.test-helpers.js";

/** What an action may write, and what it may put in a URL. */

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
