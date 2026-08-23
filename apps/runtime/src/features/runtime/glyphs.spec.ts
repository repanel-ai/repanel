import { ICON_NAMES } from "@repanel/contracts";
import { RESOURCE_ICON_NAMES } from "@repanel/ui";
import { describe, expect, it } from "vitest";

/**
 * The vocabulary lives in the contract and the marks live in the component
 * system, and neither package can see the other — `packages/ui` stays
 * presentational and `packages/contracts` stays framework-free. This app
 * depends on both, so this is the one place the two lists can be held up
 * against each other. A name the schema accepts and the runtime cannot draw
 * would fall back silently, which is the one outcome DECISIONS #008 has no
 * answer for.
 */
describe("the icon vocabulary", () => {
  it("draws every name a definition is allowed to ask for", () => {
    expect([...ICON_NAMES].filter((name) => !RESOURCE_ICON_NAMES.includes(name))).toEqual([]);
  });

  it("draws nothing a definition cannot ask for", () => {
    expect(RESOURCE_ICON_NAMES.filter((name) => !ICON_NAMES.includes(name as never))).toEqual([]);
  });
});
