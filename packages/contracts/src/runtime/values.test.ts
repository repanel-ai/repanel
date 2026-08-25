import assert from "node:assert/strict";
import { test } from "node:test";
import { fieldIn, resourceIn, validFor } from "../definition/draft.test-helpers.js";
import type { Resource } from "../definition/schema.js";
import type { JsonValue } from "./records.js";
import { checkRecordValues, type WriteMode } from "./values.js";

/**
 * The reference definition's `users`, optionally with more of its fields opened
 * for writing — the fixture opens the ones a real admin would, and the type
 * table below needs the rest.
 */
function users(open: readonly string[] = []): Resource {
  const definition = validFor((draft) => {
    const resource = resourceIn(draft, "users");
    for (const key of open) fieldIn(resource, key).editable = true;
  });
  const resource = definition.resources.find((candidate) => candidate.key === "users");
  if (!resource) throw new Error("the fixture has no `users`");
  return resource;
}

function problems(
  values: Record<string, JsonValue>,
  mode: WriteMode = "update",
  open: readonly string[] = [],
): string[] {
  return checkRecordValues(users(open), mode, values).map((error) => error.path);
}

function accepts(key: string, value: JsonValue, open: readonly string[] = []): boolean {
  return checkRecordValues(users(open), "update", { [key]: value }).length === 0;
}

test("a write with no values is refused, and says what it could carry", () => {
  const [error, ...rest] = checkRecordValues(users(), "update", {});

  assert.equal(rest.length, 0);
  assert.equal(error?.path, "values");
  assert.match(error?.expected ?? "", /email, name, organization_id, notes, avatar_url/);
});

test("a key that names no field is refused with the keys that do", () => {
  const [error] = checkRecordValues(users(), "update", { emial: "a@b.test" });

  assert.equal(error?.path, "values.emial");
  assert.equal(error?.message, "Resource `users` has no field `emial`.");
  assert.match(error?.hint ?? "", /`users` accepts: email, name/);
});

test("a field nobody marked editable is refused", () => {
  const [error] = checkRecordValues(users(), "update", { status: "active" });

  assert.equal(error?.path, "values.status");
  assert.equal(error?.message, "Field `status` is not editable.");
  assert.match(error?.hint ?? "", /mark it `"editable": true`/);
});

test("a sensitive field is refused, and the hint sends the write to the application", () => {
  const [error] = checkRecordValues(users(), "update", { password_hash: "x" });

  assert.equal(error?.path, "values.password_hash");
  assert.match(error?.message ?? "", /is sensitive and is never written from the admin/);
  assert.match(error?.hint ?? "", /httpCall/);
  assert.doesNotMatch(error?.hint ?? "", /unset|"sensitive": false/i);
});

test("the primary key is refused even though the record is addressed by it", () => {
  const [error] = checkRecordValues(users(), "update", { id: "u_2" });

  assert.equal(error?.path, "values.id");
  assert.match(error?.message ?? "", /is the primary key of `users` and is never written/);
});

test("a json field is refused with the reason it is not writable", () => {
  const [error] = checkRecordValues(users(), "update", { preferences: { theme: "dark" } });

  assert.equal(error?.path, "values.preferences");
  assert.match(error?.message ?? "", /has type `json` and cannot be written/);
});

test("every problem is reported at once, one per field", () => {
  assert.deepEqual(problems({ name: 7, avatar_url: "example.com", nope: 1 }), [
    "values.name",
    "values.avatar_url",
    "values.nope",
  ]);
});

test("text takes a string and nothing else", () => {
  assert.ok(accepts("name", "Ada"));
  assert.ok(accepts("notes", ""));
  assert.ok(!accepts("name", 7));
  assert.ok(!accepts("name", true));
  assert.ok(!accepts("notes", ["a"]));
});

test("email takes an address, and an empty box is not an address to check", () => {
  assert.ok(accepts("email", "ada@example.test"));
  assert.ok(!accepts("email", "ada"));
  assert.ok(!accepts("email", 7));
});

test("url takes an absolute http(s) address", () => {
  assert.ok(accepts("avatar_url", "https://cdn.example.test/a.png"));
  assert.ok(accepts("avatar_url", ""));
  assert.ok(!accepts("avatar_url", "cdn.example.test/a.png"));
  assert.ok(!accepts("avatar_url", "javascript:alert(1)"));
});

test("number takes a number, or the digits of one — never a coercion", () => {
  assert.ok(accepts("login_count", 12));
  assert.ok(accepts("login_count", -3.5));
  // What the reader answers a `numeric` with when it cannot be a JS number
  // without losing digits goes back the way it came.
  assert.ok(accepts("login_count", "900719925474099123"));
  assert.ok(!accepts("login_count", "twelve"));
  assert.ok(!accepts("login_count", ""));
  assert.ok(!accepts("login_count", true));
  assert.ok(!accepts("login_count", Number.POSITIVE_INFINITY as unknown as JsonValue));
});

test("boolean takes a boolean, and never the word for one", () => {
  assert.ok(accepts("is_active", true, ["is_active"]));
  assert.ok(accepts("is_active", false, ["is_active"]));
  assert.ok(!accepts("is_active", "true", ["is_active"]));
  assert.ok(!accepts("is_active", 1, ["is_active"]));
});

test("date takes a day that is on the calendar", () => {
  assert.ok(accepts("trial_ends_on", "2026-02-28"));
  assert.ok(accepts("trial_ends_on", "2024-02-29"));
  assert.ok(!accepts("trial_ends_on", "2026-02-29"));
  assert.ok(!accepts("trial_ends_on", "2026-2-8"));
  assert.ok(!accepts("trial_ends_on", "2026-08-25T00:00:00Z"));
});

test("dateTime takes ISO 8601, with or without the zone the column keeps", () => {
  assert.ok(accepts("created_at", "2026-08-25T10:30:00Z", ["created_at"]));
  assert.ok(accepts("created_at", "2026-08-25T10:30", ["created_at"]));
  assert.ok(accepts("created_at", "2026-08-25T10:30:00.123+04:00", ["created_at"]));
  assert.ok(!accepts("created_at", "2026-08-25 10:30:00", ["created_at"]));
  assert.ok(!accepts("created_at", "2026-08-25T25:30:00Z", ["created_at"]));
});

test("enum takes one of its own values, and the hint lists them", () => {
  assert.ok(accepts("status", "suspended", ["status"]));

  const [error] = checkRecordValues(users(["status"]), "update", { status: "banned" });
  assert.equal(error?.path, "values.status");
  assert.equal(error?.expected, "one of: invited, active, suspended");
});

test("relation takes the key of the record to point at", () => {
  assert.ok(accepts("organization_id", "org_7"));
  assert.ok(accepts("organization_id", 7));
  assert.ok(accepts("organization_id", null));
  assert.ok(!accepts("organization_id", ""));
  assert.ok(!accepts("organization_id", { id: "org_7" }));
});

test("a field that is not required may be set to null", () => {
  assert.ok(accepts("notes", null));
  assert.ok(accepts("trial_ends_on", null));
});

test("a required field cannot be null, empty, or left out of a create", () => {
  assert.deepEqual(problems({ name: null, email: "a@b.test" }), ["values.name"]);
  assert.deepEqual(problems({ name: "", email: "a@b.test" }), ["values.name"]);
  assert.deepEqual(problems({ notes: "hello" }, "create"), [
    "values.email",
    "values.name",
  ]);
});

test("an update leaves out what it does not change, including required fields", () => {
  assert.deepEqual(problems({ notes: "hello" }, "update"), []);
});

test("a create that carries every required value is accepted", () => {
  assert.deepEqual(problems({ email: "ada@example.test", name: "Ada" }, "create"), []);
});

test("a missing required value names the field and says why it cannot be skipped", () => {
  const [error] = checkRecordValues(users(), "create", { name: "Ada" });

  assert.equal(error?.path, "values.email");
  assert.equal(error?.message, "Required field `email` has no value.");
  assert.match(error?.hint ?? "", /`Email` is required and has no value to fall back on/);
});
