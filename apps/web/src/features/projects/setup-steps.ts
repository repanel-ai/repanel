import type { AgentTokenDto, ConnectionDto, DefinitionStatusDto } from "@repanel/contracts";

/** The four things that have to be true before an admin exists. */
export type StepKey = "database" | "token" | "agent" | "admin";

/** Done, the one to do next, or not yet reached. */
export type StepState = "done" | "current" | "todo";

export interface SetupStep {
  key: StepKey;
  title: string;
  /** One line, and it changes with the state: what was done, or what to do. */
  note: string;
  state: StepState;
  /** The page that owns this step, and what the way there is called. */
  goTo: { to: string; label: string };
}

export interface SetupFacts {
  connection: ConnectionDto | null;
  tokens: readonly AgentTokenDto[];
  definition: DefinitionStatusDto;
}

/**
 * The setup loop, read forwards. Task 014's project page said what *is* — a
 * connection, a token list, a definition status — and never what is *left*;
 * this is the same three facts in the order they have to happen.
 *
 * Every input is something the Overview page already fetches. Nothing here asks
 * the API a question of its own, and nothing here is stored: the checklist is
 * derived on every render from what the project's own endpoints answered, so it
 * cannot drift from them.
 */
export function setupSteps({ connection, tokens, definition }: SetupFacts): SetupStep[] {
  const connected = connection !== null;
  const minted = tokens.length > 0;
  /*
   * An agent has reached this project if a token has been used — or if a
   * definition has arrived, which it cannot have done any other way. The second
   * half matters: a definition can land between two token reads, and a
   * checklist that showed step four done above step three undone would be
   * reporting something that never happened.
   */
  const reached = tokens.some((token) => token.lastUsedAt !== null) || definition.status !== "none";
  const rendered = definition.status === "valid";

  const done: Record<StepKey, boolean> = {
    database: connected,
    token: minted,
    agent: reached,
    admin: rendered,
  };
  const current = ORDER.find((key) => !done[key]);

  return ORDER.map((key) => {
    const state: StepState = done[key] ? "done" : key === current ? "current" : "todo";
    return { key, state, title: TITLES[key], note: noteFor(key, state, definition), goTo: GO_TO[key] };
  });
}

const ORDER: StepKey[] = ["database", "token", "agent", "admin"];

const TITLES: Record<StepKey, string> = {
  database: "Connect your database",
  token: "Mint an agent token",
  agent: "Connect your agent",
  admin: "Ask it to create your admin",
};

const GO_TO: Record<StepKey, { to: string; label: string }> = {
  database: { to: "../connection", label: "Connection" },
  token: { to: "../agents", label: "Agent access" },
  agent: { to: "../agents", label: "Agent access" },
  admin: { to: "../definition", label: "Definition" },
};

/**
 * What a step says. A step that is done reports what is now true; a step that
 * is next says what to do about it. Only one line ever changes for a reason
 * other than its own state — the last one, when a definition arrived and did
 * not validate, which is the one case where "not done" needs explaining.
 */
function noteFor(key: StepKey, state: StepState, definition: DefinitionStatusDto): string {
  if (key === "database") {
    return state === "done"
      ? "Stored encrypted. It is never shown again and never sent to an agent."
      : "Point RePanel at the database this admin reads. It is stored encrypted, and never sent to an agent.";
  }
  if (key === "token") {
    return state === "done"
      ? "Shown once, at the moment it was minted. Mint another if it was lost."
      : "An agent reaches this project with a token, and a token is shown once — when it is minted.";
  }
  if (key === "agent") {
    return state === "done"
      ? "An agent has reached this project."
      : "Run the setup command where your agent runs. Every client configured by file is on the Agent access page.";
  }
  if (definition.status === "invalid") {
    return "The last definition your agent submitted did not validate. It is stored as it was sent, so the agent can read the problems back and repair it.";
  }
  return state === "done"
    ? "Your admin is rendered from the definition your agent submitted."
    : "“Read my database and build me an admin.” It writes the definition and submits it — this page changes on its own when it lands.";
}
