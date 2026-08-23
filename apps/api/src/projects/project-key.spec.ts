import { createProjectKey } from "./project-key";

/** Slug segments, then the suffix that makes the key the project's own. */
const KEY_FORMAT = /^[a-z0-9]+(?:-[a-z0-9]+)*-[a-z0-9]{6}$/;

describe("createProjectKey", () => {
  it("puts a slug of the name in front of a six-character suffix", () => {
    expect(createProjectKey("Crewbase")).toMatch(/^crewbase-[a-z0-9]{6}$/);
  });

  it("collapses whatever a name puts between its words", () => {
    expect(createProjectKey("  Ada's   Ledger!!  ")).toMatch(/^ada-s-ledger-[a-z0-9]{6}$/);
  });

  it("still yields a usable key when the name slugifies to nothing", () => {
    expect(createProjectKey("日本語")).toMatch(/^project-[a-z0-9]{6}$/);
    expect(createProjectKey("!!!")).toMatch(/^project-[a-z0-9]{6}$/);
  });

  it("keeps a long name from becoming a long key", () => {
    const key = createProjectKey("Scout ".repeat(30));

    expect(key).toMatch(KEY_FORMAT);
    expect(key.length).toBeLessThanOrEqual(47);
  });

  it("leaves no dangling separator where it truncated", () => {
    const key = createProjectKey(`${"a".repeat(39)} beyond`);

    expect(key).toMatch(KEY_FORMAT);
    expect(key).toMatch(/^a{39}-[a-z0-9]{6}$/);
  });

  it("draws a different suffix every time", () => {
    const keys = new Set(Array.from({ length: 20 }, () => createProjectKey("Crewbase")));

    expect(keys.size).toBe(20);
  });
});
