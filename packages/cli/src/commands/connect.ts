import {
  ActionRunner,
  CustomerPool,
  HttpCall,
  QueryBuilder,
  RecordReader,
  RecordWriter,
} from "@repanel/engine";
import { addressesFrom } from "../cloud/addresses.js";
import type { CommandResult } from "../command-result.js";
import { ConnectorClient, type ConnectorReport } from "../connector/client.js";
import { describeDatabase, findDatabaseUrl, maskDatabaseUrl } from "../database-url.js";
import { styling, type Style, type Terminal } from "../terminal.js";

/** Where the token may be given, for operators who would rather not type it. */
export const TOKEN_VARIABLE = "REPANEL_CONNECTOR_TOKEN";

/** One pool key, because there is one database. */
const DATABASE = "local";

export interface ConnectOptions {
  /** The token from `--token`, if it was given there. */
  readonly token?: string;
  readonly databaseUrl?: string;
  readonly env: NodeJS.ProcessEnv;
}

/**
 * RePanel's admin, served from beside your database instead of from Cloud.
 *
 * This process holds the connection string; RePanel never sees it. What comes
 * down the channel is a descriptor — which resource, which record, which action
 * — and what goes back is the records the engine read, exactly as the hosted
 * runtime would have read them. The engine here is the same package Cloud runs,
 * so there is no second query path to keep honest and no connector-only
 * capability to audit: a request RePanel cannot describe in the shared contract
 * is a request it cannot make (DECISIONS #064).
 *
 * Nothing is written to disk. The database comes from this machine's
 * environment, the definition and the signing secret come down the channel and
 * live in memory, and stopping the process leaves nothing behind.
 */
export async function connect(
  projectRoot: string,
  options: ConnectOptions,
  io: Terminal,
): Promise<CommandResult> {
  const style = styling(io.colors);

  const token = (options.token ?? options.env[TOKEN_VARIABLE] ?? "").trim();
  if (token === "") {
    return refuse([
      "No connector token given.",
      `  hint: Run \`repanel connect --token rpc_…\`, or set ${TOKEN_VARIABLE} in this machine's environment. The token is on your project's Connection page in the RePanel console.`,
    ]);
  }

  const database = await findDatabaseUrl(projectRoot, options.databaseUrl, options.env);
  if (!database) {
    return refuse([
      "No DATABASE_URL found: it is not set in your environment and neither `.env.local` nor `.env` declares it.",
      "  hint: Run `repanel connect --database-url postgres://…`, or add `DATABASE_URL=` to this machine's environment.",
    ]);
  }

  const pool = new CustomerPool({
    resolveDsn: () => Promise.resolve(database.url),
    onError: (_key, message) => io.write(`  ${style.bad}  Database connection dropped: ${message}`),
  });

  const queries = new QueryBuilder();
  const reader = new RecordReader(queries);
  const client = new ConnectorClient({
    url: channelUrl(options.env),
    token,
    engine: {
      reader,
      writer: new RecordWriter(queries),
      runner: new ActionRunner(reader, queries, new HttpCall()),
    },
    pool: () => pool.poolFor(DATABASE),
    report: reporting(io, style),
  });

  for (const line of banner(style, channelUrl(options.env), database.origin, describeDatabase(database.url), maskDatabaseUrl(database.url))) {
    io.write(line);
  }

  const stop = (): void => client.stop();
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);

  try {
    const refusal = await client.run();
    if (!refusal) return { exitCode: 0, lines: ["", "  Connector stopped. Nothing was left behind."] };
    return { exitCode: 1, lines: ["", refusal.message] };
  } finally {
    process.off("SIGINT", stop);
    process.off("SIGTERM", stop);
    // The customer's database gets every connection back, whichever way this ended.
    await pool.close();
  }
}

/** Everything this command says while it is running, and it says it here. */
function reporting(io: Terminal, style: Style): ConnectorReport {
  return {
    connected: (version) =>
      io.write(
        version === null
          ? `  ${style.ok}  Connected. This project has published nothing yet, so there is nothing to serve.`
          : `  ${style.ok}  Connected, serving definition version ${version}.`,
      ),
    published: (version) => io.write(`  ${style.ok}  Definition version ${version} published; now serving it.`),
    disconnected: (reason, retryInMs) =>
      io.write(`  ${style.warn}  Disconnected (${reason}). Reconnecting in ${Math.round(retryInMs / 1000)}s.`),
    problem: (message) => io.write(`  ${style.bad}  ${message}`),
  };
}

/** Where Cloud answers a connector, built off the address the CLI already reads. */
function channelUrl(env: NodeJS.ProcessEnv): string {
  const api = addressesFrom(env).api;
  return `${api.replace(/^http/, "ws")}/connector`;
}

/**
 * What is running, what it is reading, and the promise this rung is for.
 *
 * The database line is masked, because a terminal is a thing people screenshot.
 * The last statement is the point of the whole command and is marked as a
 * promise being kept rather than written as prose: RePanel is on the other end
 * of that socket and does not have the string above it.
 */
function banner(
  style: Style,
  channel: string,
  origin: string,
  database: string,
  masked: string,
): string[] {
  const width = 12;
  return [
    "",
    `  ${style.label("RePanel".padEnd(width))}${style.headline(channel)}`,
    `  ${style.label("Database".padEnd(width))}${database} ${style.label(`(from ${origin})`)}`,
    `  ${style.label("".padEnd(width))}${masked}`,
    "",
    `  ${style.ok}  The connection string above stays on this machine. RePanel sends`,
    "     this connector what to read, never how to read it, and it is served",
    "     by the same engine the hosted runtime uses.",
    "",
  ];
}

function refuse(lines: readonly string[]): CommandResult {
  return { exitCode: 1, lines: [...lines] };
}
