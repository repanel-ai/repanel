import type { AgentTokenDto, ConnectionDto, DefinitionStatusDto } from "@repanel/contracts";
import { describe, expect, it } from "vitest";
import { setupSteps, type SetupFacts, type StepKey, type StepState } from "./setup-steps";

const CONNECTED: ConnectionDto = { kind: "postgres", host: "db.example.com", database: "crewbase" };
const UNUSED: AgentTokenDto = {
  id: "t_1",
  label: "Claude Code on my laptop",
  createdAt: "2026-08-20T10:00:00.000Z",
  lastUsedAt: null,
};
const USED: AgentTokenDto = { ...UNUSED, id: "t_2", lastUsedAt: "2026-08-23T08:41:00.000Z" };

const NOTHING: SetupFacts = {
  connection: null,
  tokens: [],
  definition: { draft: { status: "none" }, published: null, unpublishedChanges: false },
};

/** A definition that validated, submitted and published a minute later. */
const PUBLISHED: DefinitionStatusDto = {
  draft: { status: "valid", updatedAt: "2026-08-23T09:14:00.000Z" },
  published: { version: 1, publishedAt: "2026-08-23T09:15:00.000Z" },
  unpublishedChanges: false,
};

/** The same definition, submitted and left waiting for a human to publish it. */
const UNPUBLISHED: DefinitionStatusDto = {
  draft: { status: "valid", updatedAt: "2026-08-23T09:14:00.000Z" },
  published: null,
  unpublishedChanges: true,
};

/** The four states, in order, as one string — easier to read than four asserts. */
function states(facts: Partial<SetupFacts>): Record<StepKey, StepState> {
  const steps = setupSteps({ ...NOTHING, ...facts });
  return Object.fromEntries(steps.map((step) => [step.key, step.state])) as Record<
    StepKey,
    StepState
  >;
}

describe("setupSteps", () => {
  it("puts a brand-new project on the first step and nothing further", () => {
    expect(states({})).toEqual({
      database: "current",
      token: "todo",
      agent: "todo",
      admin: "todo",
    });
  });

  it("moves to the next thing as each one lands", () => {
    expect(states({ connection: CONNECTED })).toMatchObject({
      database: "done",
      token: "current",
    });
    expect(states({ connection: CONNECTED, tokens: [UNUSED] })).toMatchObject({
      token: "done",
      agent: "current",
    });
    expect(states({ connection: CONNECTED, tokens: [USED] })).toMatchObject({
      agent: "done",
      admin: "current",
    });
  });

  it("counts the agent as connected once a definition exists, whatever the tokens say", () => {
    // A definition cannot have arrived any other way, and a token's last-used
    // stamp can be read a moment late. Step four done over step three undone
    // would report something that never happened.
    const facts = { connection: CONNECTED, tokens: [UNUSED], definition: PUBLISHED };

    expect(states(facts)).toEqual({
      database: "done",
      token: "done",
      agent: "done",
      admin: "done",
    });
  });

  it("leaves the last step undone while nothing has been published, and names the way on", () => {
    // A valid draft is not an admin: nobody can open what has not gone live.
    const steps = setupSteps({ connection: CONNECTED, tokens: [USED], definition: UNPUBLISHED });
    const admin = steps.find((step) => step.key === "admin");

    expect(admin?.state).toBe("current");
    // Not "ask your agent to build one": it built one. What is left is the
    // reader's own to do, and telling them to wait would be telling them wrong.
    expect(admin?.note).toContain("Publish it on the Definition page");
    expect(admin?.note).not.toContain("changes on its own");
  });

  it("says the admin renders the published version, not the last thing submitted", () => {
    const steps = setupSteps({ connection: CONNECTED, tokens: [USED], definition: PUBLISHED });

    expect(steps.find((step) => step.key === "admin")?.note).toContain("the version you published");
  });

  it("leaves the last step undone while a definition is invalid, and says why", () => {
    const definition: DefinitionStatusDto = {
      draft: {
        status: "invalid",
        errorCount: 1,
        errors: [{ path: "navigation", message: "Required key `navigation` is missing.", expected: "an array", hint: "Add one." }],
      },
      published: null,
      unpublishedChanges: true,
    };

    const steps = setupSteps({ connection: CONNECTED, tokens: [USED], definition });
    const admin = steps.find((step) => step.key === "admin");

    expect(admin?.state).toBe("current");
    expect(admin?.note).toContain("did not validate");
  });

  it("has nothing current once every step is done", () => {
    const done = setupSteps({ connection: CONNECTED, tokens: [USED], definition: PUBLISHED });

    expect(done.every((step) => step.state === "done")).toBe(true);
  });
});
