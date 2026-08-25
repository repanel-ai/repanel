import { randomBytes } from "node:crypto";
import path from "node:path";
import { SCHEMA_VERSION, type UserDto } from "@repanel/contracts";
import {
  ActionRunner,
  CustomerPool,
  HttpCall,
  QueryBuilder,
  RecordReader,
  RecordWriter,
  indexResources,
  type ActionContext,
  type ReadContext,
} from "@repanel/engine";
import { DEFINITION_DIRECTORY } from "../assemble/assemble.js";
import type { CommandResult } from "../command-result.js";
import { createDevServer } from "../dev/dev-server.js";
import { describeDatabase, findDatabaseUrl, maskDatabaseUrl } from "../database-url.js";
import { WatchedDefinition, readDefinition } from "../dev/project.js";
import { EMBEDDED_RUNTIME, hasRuntime } from "../dev/spa.js";
import { watchDefinition } from "../dev/watch.js";
import { count, formatProblem, reportReloaded, reportWhileServing } from "../problems.js";
import { styling, type Style, type Terminal } from "../terminal.js";

export const DEFAULT_PORT = 5170;

/** Loopback and nothing else: an admin on your machine is not a service. */
const HOST = "127.0.0.1";

/**
 * The project key the local admin is served under. It is in every address and
 * shown under the app's name, and it says what this is: not a project, a
 * machine.
 */
const PROJECT_KEY = "local";

/**
 * Who is signed in. There is no account and no sign-in here, so the local
 * server answers the session question with the operator who started it — the
 * app's own auth path runs exactly as it does against the hosted API, and finds
 * somebody there.
 */
const LOCAL_OPERATOR: UserDto = { id: "local", email: "you@localhost", name: "Local operator" };

/** One pool key, because there is one database. */
const DATABASE = "local";

export interface DevOptions {
  readonly port: number;
  readonly databaseUrl?: string;
  /** Take the inferred database without asking. Required when nobody can be asked. */
  readonly yes: boolean;
  readonly env: NodeJS.ProcessEnv;
  /**
   * The built runtime to serve. Defaults to the copy embedded in this package,
   * which is the only one a customer has; a checkout can point at another.
   */
  readonly assets?: string;
}

export type DevOutcome =
  | { readonly started: true; readonly url: string; readonly close: () => Promise<void> }
  | { readonly started: false; readonly result: CommandResult };

/**
 * The whole product on your machine: the real runtime, the real engine, your
 * own database, and no account anywhere in the path.
 *
 * What is local about it lives on this side of the wire. The app that gets
 * served is the built bundle, unmodified — the local server answers the
 * addresses it already asks for, including the session question, and that is
 * the whole of the difference.
 */
export async function dev(
  projectRoot: string,
  options: DevOptions,
  io: Terminal,
): Promise<DevOutcome> {
  const style = styling(io.colors);
  const reading = await readDefinition(projectRoot);
  if (!reading.definition) {
    // There is no last good render to protect yet, so this is a `validate` run
    // with a port it did not open.
    const lines = reading.problems.flatMap((problem) => [...formatProblem(problem), ""]);
    lines.push(`${count(reading.problems.length, "problem")} found; nothing to serve yet.`);
    return { started: false, result: { exitCode: 1, lines } };
  }

  const definition = reading.definition;

  const assets = options.assets ?? EMBEDDED_RUNTIME;
  if (!(await hasRuntime(assets))) {
    return {
      started: false,
      result: {
        exitCode: 1,
        lines: [
          "This copy of the RePanel CLI carries no admin to serve.",
          `  hint: The built runtime should be at \`${assets}\`. Reinstall \`@repanel/cli\`, or run \`pnpm -r build\` if you are working in the RePanel repository.`,
        ],
      },
    };
  }

  const database = await findDatabaseUrl(projectRoot, options.databaseUrl, options.env);
  if (!database) {
    return refuse([
      "No DATABASE_URL found: it is not set in your environment and neither `.env.local` nor `.env` declares it.",
      "  hint: Run `repanel dev --database-url postgres://…`, or add `DATABASE_URL=` to this repository's `.env`.",
    ]);
  }

  io.write(
    `  ${style.ok}  ${definition.app.name} — ${count(definition.resources.length, "resource")} from ${DEFINITION_DIRECTORY}/, valid against definition schema ${SCHEMA_VERSION}.`,
  );

  if (!database.answered && !options.yes) {
    io.write("");
    for (const line of gutter(style, [
      ["Database", maskDatabaseUrl(database.url)],
      ["Found in", database.origin],
    ])) {
      io.write(line);
    }
    io.write("");

    if (!io.confirm) {
      return refuse([
        "Nobody to ask: the database was inferred but this is not an interactive terminal.",
        "  hint: Re-run with `--yes` to accept the database above, or name one with `--database-url postgres://…`.",
      ]);
    }
    if (!(await io.confirm(`  Use this database? ${style.label("[Y/n]")} `))) {
      return refuse([
        "Stopped: no database was confirmed.",
        "  hint: Name the one you want with `repanel dev --database-url postgres://…`.",
      ]);
    }
  }

  const watched = new WatchedDefinition(projectRoot, definition);
  const pool = new CustomerPool({
    resolveDsn: () => Promise.resolve(database.url),
    onError: (_key, message) => io.write(`  ${style.bad}  Database connection dropped: ${message}`),
  });

  const queries = new QueryBuilder();
  const reader = new RecordReader(queries);
  const writer = new RecordWriter(queries);
  const runner = new ActionRunner(reader, queries, new HttpCall());

  // A secret generated for this run and held in memory: there is no project to
  // read one from, and a dev secret that outlives the process is a dev secret
  // somebody eventually ships.
  const actionSecret = randomBytes(32).toString("base64url");

  const read = (): ReadContext => ({
    resources: indexResources(watched.current),
    pool: () => pool.poolFor(DATABASE),
  });
  const act = (): ActionContext => ({ ...read(), secret: () => Promise.resolve(actionSecret) });

  const server = createDevServer({
    watched,
    assets,
    // A failure nothing recognized reaches the browser as an opaque envelope,
    // exactly as it does hosted. Here there is also somebody at a terminal, and
    // telling them what it was is the whole reason to run this locally.
    onUnexpected: (error) => io.write(`  ${style.bad}  Unexpected failure: ${describe(error)}`),
    api: {
      projectKey: PROJECT_KEY,
      user: LOCAL_OPERATOR,
      reader,
      writer,
      runner,
      definition: () => watched.current,
      read,
      act,
    },
  });

  try {
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(options.port, HOST, () => {
        server.removeListener("error", reject);
        resolve();
      });
    });
  } catch (error) {
    await pool.close();
    if ((error as NodeJS.ErrnoException).code !== "EADDRINUSE") throw error;
    return refuse([
      `Port ${options.port} is already in use.`,
      "  hint: Run `repanel dev --port <number>` on a free port.",
    ]);
  }

  const unwatch = watchDefinition(path.join(projectRoot, DEFINITION_DIRECTORY), () => {
    void watched.reread().then((event) => {
      if (event.type === "reload") {
        io.write(reportReloaded(style, watched.current.resources.length));
        return;
      }
      for (const line of reportWhileServing(style, event.problems, DEFINITION_DIRECTORY)) {
        io.write(line);
      }
    });
  });

  // The port the server actually bound, not the one that was asked for: they
  // differ whenever 0 was asked for, and a banner that names the wrong address
  // is worse than no banner.
  const address = server.address();
  const port = typeof address === "object" && address !== null ? address.port : options.port;
  const url = `http://${HOST}:${port}/a/${PROJECT_KEY}/`;
  for (const line of banner(style, url, database.origin, describeDatabase(database.url), actionSecret)) {
    io.write(line);
  }

  const close = async (): Promise<void> => {
    process.off("SIGINT", shutdown);
    process.off("SIGTERM", shutdown);
    unwatch();
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await pool.close();
  };

  // The process is kept alive by the open server, so this is what ends it:
  // clients let go of, the watcher stopped, and the customer's database given
  // back every connection this took from it.
  function shutdown(): void {
    void close().then(() => process.exit(0));
  }
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);

  return { started: true, url, close };

  function refuse(lines: readonly string[]): DevOutcome {
    return { started: false, result: { exitCode: 1, lines } };
  }
}

/** What an unrecognized failure was, for the operator's terminal and nowhere else. */
function describe(error: unknown): string {
  return error instanceof Error ? (error.stack ?? error.message) : String(error);
}

/**
 * A label and its value in one column.
 *
 * The label is padded before it is dimmed, because an escape code is not a
 * character an eye can see but is very much a character `padEnd` counts. It is
 * the reason the gutter is built here rather than written out line by line.
 */
function gutter(style: Style, rows: readonly (readonly [string, string])[]): string[] {
  const width = Math.max(...rows.map(([label]) => label.length)) + 3;
  return rows.map(([label, value]) => `  ${style.label(label.padEnd(width))}${value}`);
}

/**
 * What is running, what it is reading, and the two things somebody has to know
 * about it — in that order, because that is the order they are needed in.
 *
 * The address is the one loud line: it is why the command was run, and it is
 * the thing to be clicked or copied. Everything else is a label and a value in
 * the same gutter, and the two statements at the bottom are marked rather than
 * written as prose — one wants an action, one is a promise being kept, and a
 * glance should tell them apart before a word is read.
 *
 * The secret itself is left plain, with nothing before or after it on its line.
 * It is going to be selected with a mouse and pasted into a file, and a colour
 * code either side of it is a thing to accidentally take along.
 */
function banner(
  style: Style,
  url: string,
  origin: string,
  database: string,
  actionSecret: string,
): string[] {
  return [
    "",
    ...gutter(style, [
      ["Admin", style.headline(url)],
      ["Database", `${database} ${style.label(`(from ${origin})`)}`],
      ["Watching", `${DEFINITION_DIRECTORY}/`],
    ]),
    "",
    `  ${style.warn}  Actions are signed with a secret generated for this run. Set it`,
    "     in your application's environment and restart it, or every signed",
    "     action is refused:",
    "",
    `     REPANEL_ACTION_SECRET=${actionSecret}`,
    "",
    `  ${style.ok}  No account and no RePanel network calls: the only connections`,
    "     this process opens are the database above and the endpoints your",
    "     actions declare.",
    "",
  ];
}
