import "reflect-metadata";
import { RequestMethod, type CanActivate } from "@nestjs/common";
import { GUARDS_METADATA, METHOD_METADATA, PATH_METADATA } from "@nestjs/common/constants";
import { saasDefinition } from "@repanel/contracts/fixtures";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { ForbiddenError, NotFoundError, UnauthorizedError } from "../errors/domain-errors";
import {
  buildApi,
  contextFor,
  guardsFor,
  PASSWORD,
  type Actor,
  type Api,
} from "./authorization.test-helpers";
import { PROJECT_NOT_FOUND } from "./projects.service";

/**
 * Who may reach what, for every route the API serves.
 *
 * The matrix is exhaustive by construction rather than by review. The routes
 * are discovered from the controllers themselves — every `*.controller.ts` under
 * `src/`, read through Nest's own metadata — and a route that is not declared
 * below fails the first case in this file. So a new endpoint cannot be added
 * without somebody saying, in this table, who is allowed to reach it.
 *
 * Five callers go through every route: the project's owner, an operator on it,
 * somebody who is on a different project, an agent token, and nobody at all.
 * What each is expected to meet is a total function of the route's reach and
 * the caller — there is no cell left to an opinion.
 *
 * What a "reached" cell asserts is that authorization let the caller through,
 * not that the work behind it succeeded: the matrix's projects point at no
 * customer database, so a read that gets past the gate ends in the pool. That
 * is deliberate. This file is about the gate, and the work behind it is tested
 * where it lives.
 */

// Three accounts are hashed with bcrypt to stand the world up.
jest.setTimeout(30_000);

/** How far into the API a route lets somebody, at the least. */
type Reach =
  /** Anybody, signed in or not. */
  | "public"
  /** Any signed-in account, about itself rather than about a project. */
  | "session"
  /** Anybody on the project: the rendered admin, which is an operator's whole job. */
  | "operator"
  /** The project's owner alone: everything that configures RePanel. */
  | "owner"
  /** An agent token, and nothing a human carries. */
  | "agent";

/** What a caller met. Four outcomes, and only one of them is "in". */
type Outcome = "reached" | "forbidden" | "hidden" | "unauthenticated";

interface Expectation {
  reach: Reach;
  /** How the matrix rings this route's bell; absent when the guard is the whole gate. */
  run?: (api: Api, actor: Actor) => Promise<unknown>;
}

const PAGE = { page: 1, pageSize: 25 } as never;
const WRITE = { values: { email: "someone@example.com" } } as never;

/** The signed-in person behind an actor. A route that needs one cannot be public. */
function personOf(actor: Actor) {
  if (!actor.user) throw new Error(`${actor.label} carries no account`);
  return actor.user;
}

const MATRIX: Record<string, Expectation> = {
  "GET /health": { reach: "public", run: (api) => api.health.check() },

  "POST /auth/signup": {
    reach: "public",
    run: (api, actor) =>
      api.auth.signup(
        {
          email: `signup-${actor.label.replace(/\s+/g, "-")}@example.com`,
          name: "Newcomer",
          password: PASSWORD,
        } as never,
        { cookie: () => undefined } as never,
      ),
  },
  "POST /auth/login": {
    reach: "public",
    run: (api) =>
      api.auth.login({ email: "owner@example.com", password: PASSWORD } as never, {
        cookie: () => undefined,
      } as never),
  },
  // Exercised without a session on purpose: it is a public route, and logging
  // each caller out would take the credential the rows below it are about.
  "POST /auth/logout": {
    reach: "public",
    run: (api) =>
      api.auth.logout({ cookies: {} } as never, { clearCookie: () => undefined } as never),
  },
  "GET /auth/me": {
    reach: "session",
    run: (api, actor) => Promise.resolve(api.auth.me(personOf(actor))),
  },
  "POST /auth/cli": { reach: "session", run: (api, actor) => api.auth.cli(personOf(actor)) },

  "POST /projects": {
    reach: "session",
    run: (api, actor) => api.projects.create(personOf(actor), { name: "Matrix" } as never),
  },
  "GET /projects": { reach: "session", run: (api, actor) => api.projects.list(personOf(actor)) },
  "GET /projects/:id": {
    reach: "owner",
    run: (api, actor) => api.projects.get(personOf(actor), api.projectId),
  },
  "GET /projects/:id/action-secret": {
    reach: "owner",
    run: (api, actor) => api.projects.actionSecret(personOf(actor), api.projectId),
  },

  "GET /projects/:projectId/people": {
    reach: "owner",
    run: (api, actor) => api.people.list(personOf(actor), api.projectId),
  },
  "POST /projects/:projectId/people": {
    reach: "owner",
    run: (api, actor) =>
      api.people.add(personOf(actor), api.projectId, {
        email: `added-by-${actor.label.replace(/\s+/g, "-")}@example.com`,
        name: "Newcomer",
      } as never),
  },
  "DELETE /projects/:projectId/people/:userId": {
    reach: "owner",
    run: (api, actor) =>
      api.people.revoke(personOf(actor), api.projectId, api.disposable[actor.label] ?? ""),
  },

  "POST /projects/:projectId/agent-tokens": {
    reach: "owner",
    run: (api, actor) =>
      api.agentTokens.mint(personOf(actor), api.projectId, { label: "Theirs" } as never),
  },
  "GET /projects/:projectId/agent-tokens": {
    reach: "owner",
    run: (api, actor) => api.agentTokens.list(personOf(actor), api.projectId),
  },

  "GET /projects/:projectId/connection": {
    reach: "owner",
    run: (api, actor) => api.connections.get(personOf(actor), api.projectId),
  },
  "PUT /projects/:projectId/connection": {
    reach: "owner",
    run: (api, actor) =>
      api.connections.set(personOf(actor), api.projectId, {
        dsn: "postgres://reader:s3cret@db.example.com:5432/crewbase",
      } as never),
  },
  "POST /projects/:projectId/connection/connector": {
    reach: "owner",
    run: (api, actor) => api.connections.useConnector(personOf(actor), api.projectId),
  },
  "POST /projects/:projectId/connection/test": {
    reach: "owner",
    run: (api, actor) => api.connections.test(personOf(actor), api.projectId),
  },

  "GET /projects/:projectId/definition/status": {
    reach: "owner",
    run: (api, actor) => api.definitions.status(personOf(actor), api.projectId),
  },
  "PUT /projects/:projectId/definition": {
    reach: "owner",
    run: (api, actor) => api.definitions.submit(personOf(actor), api.projectId, saasDefinition),
  },
  "POST /projects/:projectId/definition/publish": {
    reach: "owner",
    run: (api, actor) => api.definitions.publish(personOf(actor), api.projectId),
  },

  "GET /runtime/:projectKey/definition": {
    reach: "operator",
    run: (api, actor) => api.runtime.definition(personOf(actor), api.projectKey),
  },
  "GET /runtime/:projectKey/resources/:key/records": {
    reach: "operator",
    run: (api, actor) => api.runtime.records(personOf(actor), api.projectKey, "users", PAGE),
  },
  "GET /runtime/:projectKey/resources/:key/records/:id": {
    reach: "operator",
    run: (api, actor) => api.runtime.record(personOf(actor), api.projectKey, "users", "1"),
  },
  "GET /runtime/:projectKey/resources/:key/options": {
    reach: "operator",
    run: (api, actor) =>
      api.runtime.options(personOf(actor), api.projectKey, "users", { search: "a" } as never),
  },
  "GET /runtime/:projectKey/resources/:key/records/:id/related/:relationshipKey": {
    reach: "operator",
    run: (api, actor) =>
      api.runtime.related(personOf(actor), api.projectKey, "organizations", "1", "users", PAGE),
  },

  "POST /runtime/:projectKey/resources/:resourceKey/records": {
    reach: "operator",
    run: (api, actor) => api.records.create(personOf(actor), api.projectKey, "users", WRITE),
  },
  "PATCH /runtime/:projectKey/resources/:resourceKey/records/:id": {
    reach: "operator",
    run: (api, actor) => api.records.update(personOf(actor), api.projectKey, "users", "1", WRITE),
  },
  "POST /runtime/:projectKey/resources/:resourceKey/records/:id/actions/:actionKey": {
    reach: "operator",
    run: (api, actor) =>
      api.actions.run(personOf(actor), api.projectKey, "users", "1", "deactivate"),
  },
  "GET /runtime/:projectKey/resources/:resourceKey/records/:id/activity": {
    reach: "operator",
    run: (api, actor) =>
      api.activity.list(personOf(actor), api.projectKey, "users", "1", PAGE),
  },

  // The tools behind it authorize one at a time, and `mcp-tools.spec.ts` is
  // where that is asserted; what this row is about is the door.
  "POST /mcp": { reach: "agent" },
};

/** What each kind of caller is owed at each kind of route. No cell is optional. */
function expected(reach: Reach, actor: keyof typeof CALLERS): Outcome {
  if (actor === "anonymous") return reach === "public" ? "reached" : "unauthenticated";
  // A token carries no cookie, so every human route reads it as nobody — and
  // the one route it does carry a credential for is closed to every human.
  if (actor === "agent") {
    return reach === "public" || reach === "agent" ? "reached" : "unauthenticated";
  }
  if (reach === "agent") return "unauthenticated";
  if (reach === "public" || reach === "session") return "reached";
  if (actor === "owner") return "reached";
  if (actor === "operator") return reach === "operator" ? "reached" : "forbidden";
  return "hidden";
}

/** Every caller, beside what this route owes them. Undeclared routes owe an error. */
function callersAndOutcomes(
  reach: Reach | undefined,
): Array<[keyof typeof CALLERS, Outcome | "declared in the matrix"]> {
  const callers = Object.keys(CALLERS) as Array<keyof typeof CALLERS>;
  if (!reach) return callers.map((caller) => [caller, "declared in the matrix"]);
  return callers.map((caller) => [caller, expected(reach, caller)]);
}

const CALLERS = {
  owner: (api: Api) => api.owner,
  operator: (api: Api) => api.operator,
  outsider: (api: Api) => api.outsider,
  agent: (api: Api) => api.agent,
  anonymous: (api: Api) => api.anonymous,
};

interface DiscoveredRoute {
  key: string;
  guards: string[];
}

/**
 * Every route the API serves, read out of the controllers rather than listed by
 * hand. Discovery walks the source tree, so a controller nobody remembered to
 * mention here is still discovered — which is the point.
 */
function discoverRoutes(): DiscoveredRoute[] {
  const source = join(__dirname, "..");
  const files = readdirSync(source, { recursive: true, encoding: "utf8" }).filter(
    (file) => file.endsWith(".controller.ts") && !file.endsWith(".spec.ts"),
  );

  return files.flatMap((file) => {
    const module = require(join(source, file)) as Record<string, unknown>;
    return Object.values(module).flatMap((exported) =>
      typeof exported === "function" ? routesOf(exported as new (...args: never) => unknown) : [],
    );
  });
}

function routesOf(controller: new (...args: never) => unknown): DiscoveredRoute[] {
  const base: unknown = Reflect.getMetadata(PATH_METADATA, controller);
  if (typeof base !== "string") return [];

  const prototype: object = controller.prototype as object;
  const classGuards = guardNames(controller);

  return Object.getOwnPropertyNames(prototype)
    .filter((name) => name !== "constructor")
    .flatMap((name) => {
      const handler: unknown = (prototype as Record<string, unknown>)[name];
      const path: unknown = Reflect.getMetadata(PATH_METADATA, handler as object);
      if (typeof path !== "string") return [];

      const method: number = Reflect.getMetadata(METHOD_METADATA, handler as object) as number;
      const guards = [...classGuards, ...guardNames(handler as object)];
      return [{ key: `${RequestMethod[method]} ${pathOf(base, path)}`, guards }];
    });
}

function guardNames(target: object): string[] {
  const guards: unknown = Reflect.getMetadata(GUARDS_METADATA, target);
  if (!Array.isArray(guards)) return [];
  return guards.map((guard: unknown) =>
    typeof guard === "function" ? guard.name : (guard as CanActivate).constructor.name,
  );
}

function pathOf(base: string, path: string): string {
  return `/${[base, path].filter((part) => part !== "" && part !== "/").join("/")}`;
}

/** Which guard a reach implies. A route in the wrong place is a route wide open. */
function guardsExpectedFor(reach: Reach): string[] {
  if (reach === "public") return [];
  return reach === "agent" ? ["AgentTokenGuard"] : ["SessionAuthGuard"];
}

/** What a caller met, run through the route's real guards and its real service. */
async function attempt(api: Api, route: DiscoveredRoute, actor: Actor): Promise<Outcome> {
  try {
    for (const guard of guardsFor(api, route.guards)) {
      await guard.canActivate(contextFor(actor));
    }
    await MATRIX[route.key]?.run?.(api, actor);
    return "reached";
  } catch (error) {
    return outcomeOf(error);
  }
}

function outcomeOf(error: unknown): Outcome {
  if (error instanceof UnauthorizedError) return "unauthenticated";
  if (error instanceof ForbiddenError) return "forbidden";
  if (error instanceof NotFoundError && error.message === PROJECT_NOT_FOUND) return "hidden";
  // Everything else happened on the far side of the gate, which is the answer
  // this file is asking for: the caller was let through.
  return "reached";
}

describe("the API's authorization matrix", () => {
  const discovered = discoverRoutes();
  // One world for every row: what a route leaves behind — a token minted, a
  // connection replaced — is nothing the next route reads, and the two that
  // would change the world for the rows after them (adding somebody, revoking
  // somebody) are given a caller of their own to do it to.
  let api: Api;

  beforeAll(async () => {
    api = await buildApi();
  });

  it("declares every route the API serves, and serves every route it declares", () => {
    expect(discovered.map((route) => route.key).sort()).toEqual(Object.keys(MATRIX).sort());
  });

  it("puts every route behind the guard its reach asks for", () => {
    const behind = discovered.map((route) => [route.key, route.guards] as const);

    expect(behind).toEqual(
      discovered.map(
        (route) => [route.key, guardsExpectedFor(MATRIX[route.key]?.reach ?? "public")] as const,
      ),
    );
  });

  describe.each(discovered.map((route) => [route.key, route] as const))("%s", (key, route) => {
    const reach = MATRIX[key]?.reach;

    // An undeclared route has no expectations to check, and every row says so
    // rather than quietly passing under a default somebody would have to notice.
    it.each(callersAndOutcomes(reach))("is %s → %s", async (caller, outcome) => {
      const actor = CALLERS[caller](api);

      await expect(attempt(api, route, actor)).resolves.toBe(outcome);
    });
  });
});
