import type { Action, RecordValue } from "@repanel/contracts";
import { describe, expect, it } from "vitest";
import { visibleActions } from "./action-visibility";

/** One action per case, named after the precondition it carries. */
function offering(visibleWhen?: Action["visibleWhen"]): Action {
  return {
    key: "approve",
    label: "Approve",
    confirm: "Approve this record?",
    kind: "httpCall",
    method: "POST",
    url: "https://api.acme.test/repanel/things/{id}/approve",
    visibleWhen,
  };
}

function offered(visibleWhen: Action["visibleWhen"], values: Record<string, RecordValue>): boolean {
  return visibleActions([offering(visibleWhen)], values).length === 1;
}

describe("which actions a record is offered", () => {
  it("offers an action that states no precondition", () => {
    expect(offered(undefined, {})).toBe(true);
  });

  it("keeps the definition's order, and drops only what does not hold", () => {
    const actions = [
      { ...offering(), key: "a", label: "A" },
      { ...offering({ field: "status", equals: "pending" }), key: "b", label: "B" },
      { ...offering(), key: "c", label: "C" },
    ];

    expect(visibleActions(actions, { status: "approved" }).map((action) => action.key)).toEqual([
      "a",
      "c",
    ]);
  });

  describe("`equals`", () => {
    it("offers the action when the record holds that value", () => {
      expect(offered({ field: "status", equals: "pending" }, { status: "pending" })).toBe(true);
    });

    it("withholds it when the record holds another", () => {
      expect(offered({ field: "status", equals: "pending" }, { status: "approved" })).toBe(false);
    });

    it("compares booleans and numbers as themselves", () => {
      expect(offered({ field: "is_active", equals: true }, { is_active: true })).toBe(true);
      expect(offered({ field: "is_active", equals: true }, { is_active: false })).toBe(false);
      expect(offered({ field: "seats", equals: 0 }, { seats: 0 })).toBe(true);
    });

    /**
     * A number too large to survive as one arrives as the text the database
     * gave (`RecordValue`). Nothing here guesses across that line: a comparison
     * that would have to coerce is a comparison that did not hold.
     */
    it("never coerces one type into another to make a match", () => {
      expect(offered({ field: "seats", equals: 12 }, { seats: "12" })).toBe(false);
      expect(offered({ field: "is_active", equals: true }, { is_active: "true" })).toBe(false);
    });

    it("withholds it when the record has nothing there", () => {
      expect(offered({ field: "status", equals: "pending" }, { status: null })).toBe(false);
      expect(offered({ field: "status", equals: "pending" }, {})).toBe(false);
    });
  });

  describe("`isSet`", () => {
    it("offers the action for any value the record actually holds", () => {
      expect(offered({ field: "note", isSet: true }, { note: "checked by hand" })).toBe(true);
      expect(offered({ field: "is_active", isSet: true }, { is_active: false })).toBe(true);
      expect(offered({ field: "seats", isSet: true }, { seats: 0 })).toBe(true);
    });

    it("withholds it for a null, and for a column that is not there at all", () => {
      expect(offered({ field: "note", isSet: true }, { note: null })).toBe(false);
      expect(offered({ field: "note", isSet: true }, {})).toBe(false);
    });

    /** A relation says its own nothing as `{ id: null }` (DetailValue draws it the same). */
    it("reads a relation pointing at nothing as nothing", () => {
      expect(offered({ field: "org", isSet: true }, { org: { id: "o_1", label: "Northwind" } })).toBe(
        true,
      );
      expect(offered({ field: "org", isSet: true }, { org: { id: null, label: null } })).toBe(false);
    });
  });
});
