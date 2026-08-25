import { describe, expect, it } from "vitest";
import { adminKeyedByClient, resourceIn, userRecord } from "./definition.fixture";
import { changedIn, draftFor, formFields } from "./form-draft";

const users = resourceIn("users");
/** The same users, over a table whose keys are chosen rather than generated. */
const keyedUsers = resourceIn("users", adminKeyedByClient("users"));

describe("a form's draft", () => {
  describe("seeding it", () => {
    /**
     * The form carries the opt-in subset and nothing else. A field the
     * definition did not open has no control, so it has no draft either — which
     * is what makes "a form cannot write what it cannot draw" true of the state
     * as well as of the screen.
     */
    it("holds the editable fields, in the order the resource declares them", () => {
      expect(Object.keys(draftFor(users, "update", userRecord))).toEqual([
        "email",
        "name",
        "organization_id",
        "notes",
        "avatar_url",
        "trial_ends_on",
        "login_count",
      ]);
    });

    it("gives a new record nothing, so the column's own default stands", () => {
      const draft = draftFor(users, "create", undefined);

      expect(Object.values(draft).every((value) => value === undefined)).toBe(true);
    });

    /**
     * A relation reads as a key and a label and is written as a key alone. The
     * label belongs to the other record and there is nothing to write it to.
     */
    it("seeds a relation from the key it points at, never from the label", () => {
      expect(draftFor(users, "update", userRecord).organization_id).toBe("o_1");
    });

    it("seeds a value the record does not carry as nothing", () => {
      const record = { ...userRecord, values: { ...userRecord.values, notes: null } };

      expect(draftFor(users, "update", record).notes).toBeNull();
    });
  });

  describe("what of it is sent", () => {
    it("sends only what was given, when the record is new", () => {
      const seed = draftFor(users, "create", undefined);

      expect(changedIn({ ...seed, email: "ada@example.com" }, seed)).toEqual({
        email: "ada@example.com",
      });
    });

    /**
     * An update carries what changed and leaves the rest of the record alone —
     * which is also the only thing that keeps last-write-wins (DECISIONS #056)
     * from meaning "whoever saved last wrote every column".
     */
    it("sends only what moved, when the record is being corrected", () => {
      const seed = draftFor(users, "update", userRecord);

      expect(changedIn({ ...seed, name: "Maya O." }, seed)).toEqual({ name: "Maya O." });
    });

    /**
     * A number control hands back the digits it was typed with; the record
     * kept the number they were read as. They are the same answer, and a form
     * that called them different would offer to write a value nobody changed —
     * and would ask before discarding a change nobody made.
     */
    it("does not count a value retyped as itself as a change", () => {
      const seed = draftFor(users, "update", userRecord);

      expect(changedIn({ ...seed, login_count: "1284" }, seed)).toEqual({});
      expect(changedIn({ ...seed, login_count: "1285" }, seed)).toEqual({ login_count: "1285" });
    });

    it("still tells nothing from an empty box", () => {
      const seed = draftFor(users, "update", {
        ...userRecord,
        values: { ...userRecord.values, notes: null },
      });

      expect(changedIn({ ...seed, notes: "" }, seed)).toEqual({ notes: "" });
    });

    it("sends nothing at all when nothing moved", () => {
      const seed = draftFor(users, "update", userRecord);

      expect(changedIn(seed, seed)).toEqual({});
    });

    /**
     * Emptying a field is a change, and it is the one change that has to be
     * said out loud: the write path never reads an absent key as `null`, and
     * never reads `""` as one either.
     */
    it("says so when a field was emptied", () => {
      const seed = draftFor(users, "update", userRecord);

      expect(changedIn({ ...seed, notes: null }, seed)).toEqual({ notes: null });
    });
  });
});

/**
 * The primary key is the one control whose presence is decided by the table
 * rather than by the field: a generated key is never on a form, and a chosen
 * one is on the form that chooses it and on no other.
 */
describe("the key, where the client issues it", () => {
  it("is not drawn where the database issues it, on either form", () => {
    expect(formFields(users, "create").map((field) => field.key)).not.toContain("id");
    expect(formFields(users, "update").map((field) => field.key)).not.toContain("id");
  });

  it("is the first control on a record being made", () => {
    expect(formFields(keyedUsers, "create")[0]?.key).toBe("id");
  });

  it("is not on a record being corrected, because a key is chosen once", () => {
    expect(formFields(keyedUsers, "update").map((field) => field.key)).not.toContain("id");
  });

  it("is in the draft a create opens with, and in no draft an edit opens with", () => {
    expect("id" in draftFor(keyedUsers, "create", undefined)).toBe(true);
    expect("id" in draftFor(keyedUsers, "update", userRecord)).toBe(false);
  });
});
