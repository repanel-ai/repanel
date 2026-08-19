import assert from "node:assert/strict";
import { test } from "node:test";
import { errorAt, errorsFor, fieldIn, resourceIn, validFor } from "./draft.test-helpers.js";
import type { Tone } from "./fields.js";
import type { Definition } from "./schema.js";

/** What a `tones` map may speak about, and what it may not be told to do. */

/** The tones the validated definition ends up carrying for `users.status`. */
function statusTones(definition: Definition): Record<string, Tone> | undefined {
  const status = definition.resources
    .find((resource) => resource.key === "users")
    ?.fields.find((field) => field.key === "status");
  return status?.type === "enum" ? status.tones : undefined;
}

test("a tone must be given to a value the enum declares", () => {
  const errors = errorsFor((draft) => {
    const status = fieldIn(resourceIn(draft, "users"), "status");
    if (status.type === "enum") status.tones = { banned: "critical" };
  });

  const error = errorAt(errors, "resources[1].fields[3].tones.banned");
  assert.equal(error.message, "Field `status` has no value `banned` to give a tone to.");
  assert.equal(error.expected, "one of the values declared by `status`");
  assert.equal(
    error.hint,
    "Change `resources[1].fields[3].tones.banned` to one of: invited, active, suspended, or remove the entry; a value with no tone is legal and renders quiet.",
  );
});

/**
 * The bypass here is widening `values`: it clears the error in one line, and it
 * writes a state into the customer's vocabulary that their database may not
 * hold — which the enum filter would then offer and a `dbUpdate` would then be
 * allowed to write. Hints name safe fixes only (#015).
 */
test("the hint never offers widening the enum's vocabulary", () => {
  const errors = errorsFor((draft) => {
    const status = fieldIn(resourceIn(draft, "users"), "status");
    if (status.type === "enum") status.tones = { banned: "critical" };
  });

  assert.doesNotMatch(errorAt(errors, "resources[1].fields[3].tones.banned").hint, /values/);
});

test("every unknown value in a map is reported, not just the first", () => {
  const errors = errorsFor((draft) => {
    const status = fieldIn(resourceIn(draft, "users"), "status");
    if (status.type === "enum") status.tones = { banned: "critical", archived: "neutral" };
  });

  assert.ok(errorAt(errors, "resources[1].fields[3].tones.banned"));
  assert.ok(errorAt(errors, "resources[1].fields[3].tones.archived"));
});

test("a value the map leaves out is legal", () => {
  const definition = validFor((draft) => {
    const status = fieldIn(resourceIn(draft, "users"), "status");
    if (status.type === "enum") status.tones = { suspended: "critical" };
  });

  assert.deepEqual(statusTones(definition), { suspended: "critical" });
});

test("an enum with no map at all is one where every value is quiet", () => {
  const definition = validFor((draft) => {
    const status = fieldIn(resourceIn(draft, "users"), "status");
    if (status.type === "enum") delete status.tones;
  });

  assert.deepEqual(statusTones(definition), {});
});

test("a tone outside the vocabulary is refused", () => {
  const errors = errorsFor((draft) => {
    const status = fieldIn(resourceIn(draft, "users"), "status");
    if (status.type === "enum") status.tones = { active: "urgent" as Tone };
  });

  const error = errorAt(errors, "resources[1].fields[3].tones.active");
  assert.equal(error.expected, "one of: positive, neutral, attention, critical");
});

test("only an enum field may be given tones", () => {
  const errors = errorsFor((draft) => {
    const notes = fieldIn(resourceIn(draft, "users"), "notes");
    Object.assign(notes, { tones: { anything: "critical" } });
  });

  const error = errorAt(errors, "resources[1].fields[7].tones");
  assert.equal(error.message, "Unrecognized key `tones`.");
});
