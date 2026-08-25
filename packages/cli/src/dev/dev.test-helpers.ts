import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import net from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { validateDefinition, type Definition, type UserDto } from "@repanel/contracts";
import { saasDefinition } from "@repanel/contracts/fixtures";
import {
  ActionRunner,
  HttpCall,
  QueryBuilder,
  RecordReader,
  RecordWriter,
  indexResources,
  type ActionContext,
  type ReadContext,
  type WriteContext,
} from "@repanel/engine";
import type { Pool, QueryResult } from "pg";
import { ActivityLog } from "./activity-log.js";
import type { RuntimeApi } from "./api-routes.js";
import { readActivityQuery } from "./query-params.js";

export const PROJECT_KEY = "local";

export const OPERATOR: UserDto = { id: "local", email: "you@localhost", name: "Local operator" };

export function fixtureDefinition(): Definition {
  const result = validateDefinition(saasDefinition);
  if (!result.valid) throw new Error("the shared definition fixture no longer validates");
  return result.definition;
}

interface Statement {
  text: string;
  values: unknown[];
}

/**
 * Stands in for the customer's database. Every column the query builder asked
 * for comes back with a value of its own, which is all any of these cases needs
 * — what the SQL says is the engine's own specs' business, not this server's.
 */
export class FakePool {
  readonly statements: Statement[] = [];

  query(statement: Statement): Promise<QueryResult> {
    this.statements.push(statement);
    return Promise.resolve(answerFor(statement.text));
  }

  texts(): string[] {
    return this.statements.map((statement) => statement.text);
  }

  asPool(): Pool {
    return this as unknown as Pool;
  }
}

function answerFor(text: string): QueryResult {
  if (text.includes("count(*)")) return rows(["total"], [["1"]]);

  // Both alias spaces: `c0`, `c1`, … is the row a statement produced, and `b0`,
  // `b1`, … is what the columns it wrote held before it (DECISIONS #061).
  const aliases = [...text.matchAll(/as "([cb]\d+)"/g)].map((match) => match[1] ?? "");
  return rows(aliases, [aliases.map((alias) => `value-${alias}`)]);
}

function rows(names: string[], values: unknown[][], rowCount = values.length): QueryResult {
  return {
    rows: values.map((row) => Object.fromEntries(names.map((name, index) => [name, row[index]]))),
    fields: names.map((name) => ({ name, dataTypeID: 25 })),
    rowCount,
    command: "SELECT",
  } as unknown as QueryResult;
}

export interface TestApi extends RuntimeApi {
  readonly pool: FakePool;
  /** What the write path filed while a case was running. */
  readonly log: ActivityLog;
}

export function testApi(definition: () => Definition, secret = "dev-secret"): TestApi {
  const pool = new FakePool();
  const queries = new QueryBuilder();
  const reader = new RecordReader(queries);
  const writer = new RecordWriter(queries);
  const runner = new ActionRunner(reader, queries, new HttpCall());

  const log = new ActivityLog();

  const read = (): ReadContext => ({
    resources: indexResources(definition()),
    pool: () => Promise.resolve(pool.asPool()),
  });
  const write = (): WriteContext => ({ ...read(), audit: (event) => log.record(OPERATOR, event) });

  return {
    pool,
    log,
    projectKey: PROJECT_KEY,
    user: OPERATOR,
    reader,
    writer,
    runner,
    definition,
    read,
    write,
    act: (): ActionContext => ({ ...write(), secret: () => Promise.resolve(secret) }),
    activity: (resourceKey, id, params) => log.forRecord(resourceKey, id, readActivityQuery(params)),
  };
}

/** Lets go of a directory one of these helpers wrote. */
export async function removeAssets(root: string): Promise<void> {
  await rm(root, { recursive: true, force: true });
}

/** A directory standing in for the embedded runtime build. */
export async function writeAssets(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), "repanel-spa-"));
  await writeFile(path.join(root, "index.html"), "<!doctype html><html><body><div id=\"root\"></div></body></html>");
  await mkdir(path.join(root, "assets"));
  await writeFile(path.join(root, "assets", "index-abc.js"), "export default 1;\n");
  return root;
}

/** This machine, by every name a socket can be asked for it under. */
const LOOPBACK = new Set(["127.0.0.1", "::1", "localhost", "0.0.0.0"]);

/**
 * Cuts the process off from every host but this one, at the socket rather than
 * at a mock: a test that proves nothing leaves the machine has to be able to
 * fail when something does, and stubbing `fetch` would only prove `fetch` was
 * stubbed.
 *
 * A connection whose target cannot be read is refused rather than allowed. A
 * guard that answers "I cannot tell" with "go ahead" is not a guard, and it is
 * how the first version of this let every plain-HTTP request through.
 */
export function denyEgress(): () => void {
  const original = net.Socket.prototype.connect;

  net.Socket.prototype.connect = function connect(this: net.Socket, ...args: unknown[]) {
    const host = hostOf(args);
    if (host === undefined || !LOOPBACK.has(host)) {
      throw new Error(`egress denied: ${host ?? "a connection this guard could not read"}`);
    }
    return (original as (...called: unknown[]) => net.Socket).apply(this, args);
  } as typeof net.Socket.prototype.connect;

  return () => {
    net.Socket.prototype.connect = original;
  };
}

/**
 * Where a call to `connect` is pointed, or `undefined` if it cannot be told.
 *
 * `net.connect(...)` — which is what `fetch`, `http.request` and `pg` all reach
 * this through — normalizes its arguments into a single `[options, callback]`
 * array before calling this method. `socket.connect(options)` passes the
 * options straight. Reading only the second shape is reading the one shape no
 * client library produces.
 */
function hostOf(args: readonly unknown[]): string | undefined {
  const call = Array.isArray(args[0]) ? (args[0] as unknown[]) : args;
  const [first, second] = call;

  if (typeof first === "object" && first !== null) {
    const { host, hostname, path } = first as { host?: unknown; hostname?: unknown; path?: unknown };
    // A unix socket has no host to leave the machine by.
    if (typeof path === "string") return "localhost";
    const named = hostname ?? host;
    // Node connects an unnamed host to localhost.
    return named === undefined ? "localhost" : String(named);
  }

  if (typeof first === "number") return typeof second === "string" ? second : "localhost";

  return undefined;
}
