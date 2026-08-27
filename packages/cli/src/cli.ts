import { parseArgs } from "node:util";
import { connect } from "./commands/connect.js";
import { deploy } from "./commands/deploy.js";
import { DEFAULT_PORT, dev } from "./commands/dev.js";
import { link } from "./commands/link.js";
import { validate } from "./commands/validate.js";
import type { CommandResult } from "./command-result.js";
import type { Terminal } from "./terminal.js";
import { commandHelp, commandsTaking, isCommand, usage } from "./usage.js";

/** Every option any command takes, and the shape it takes it in. */
const OPTIONS = {
  help: { type: "boolean", short: "h" },
  port: { type: "string" },
  "database-url": { type: "string" },
  token: { type: "string" },
  yes: { type: "boolean", short: "y" },
  project: { type: "string" },
} as const;

/** What a command needs from the process it was started by. */
export interface CliContext {
  readonly io: Terminal;
  readonly env: NodeJS.ProcessEnv;
  /** The operator's home directory: where the CLI keeps its own session. */
  readonly home: string;
}

/**
 * Argument parsing and dispatch, and nothing else: one command per call, each
 * returning what to print. Node's own parser does the parsing, so an unknown
 * option is refused here rather than ignored by every command in turn.
 *
 * Two commands keep running, and they end differently. `dev` returns as soon as
 * it is up: the open server holds the process, and its own output has already
 * been written through `context.io`. `connect` returns when the connector stops
 * — it is the process, so there is something to say about how it ended.
 *
 * @param argv the arguments after the program name.
 * @param projectRoot the directory a command reads the definition from.
 * @param context the terminal to talk to, the environment to read, the home to
 *   keep a session in.
 */
export async function run(
  argv: readonly string[],
  projectRoot: string,
  context: CliContext,
): Promise<CommandResult> {
  let parsed;
  try {
    parsed = parseArgs({ args: [...argv], options: OPTIONS, allowPositionals: true });
  } catch (error) {
    return usageError((error as Error).message);
  }

  const [name, ...rest] = parsed.positionals;

  // Before anything else answers: an option no command is going to read is a
  // mistake, and printing the help over it would be ignoring it.
  const misplaced = misplacedOption(name, parsed.values);
  if (misplaced) return usageError(misplaced);

  if (name === undefined) return { exitCode: 0, lines: usage() };
  if (!isCommand(name)) return usageError(`Unknown command \`${name}\`.`);
  if (parsed.values.help) return { exitCode: 0, lines: commandHelp(name) };
  if (rest.length > 0) return usageError(`\`repanel ${name}\` takes no arguments.`);

  if (name === "validate") return validate(projectRoot);

  // The connector reaches no RePanel account: it carries a token of its own,
  // minted for one project, and the session `repanel link` keeps is nothing to
  // do with it.
  if (name === "connect") {
    return connect(
      projectRoot,
      { token: parsed.values.token, databaseUrl: parsed.values["database-url"], env: context.env },
      context.io,
    );
  }

  const project = parsed.values.project?.trim();
  if (parsed.values.project !== undefined && (project === undefined || project === "")) {
    return usageError("`--project` takes a project key.");
  }
  const account = { env: context.env, home: context.home, ...(project ? { project } : {}) };

  if (name === "link") return link(projectRoot, account, context.io);
  if (name === "deploy") return deploy(projectRoot, account);

  const port = readPort(parsed.values.port);
  if (port === undefined) {
    return usageError(`\`--port\` takes a port number, not \`${parsed.values.port ?? ""}\`.`);
  }

  const outcome = await dev(
    projectRoot,
    { port, databaseUrl: parsed.values["database-url"], yes: parsed.values.yes === true, env: context.env },
    context.io,
  );
  return outcome.started ? { exitCode: 0, lines: [] } : outcome.result;
}

/** What is wrong with an option that was given to a command that does not take it. */
function misplacedOption(
  name: string | undefined,
  values: Record<string, unknown>,
): string | undefined {
  for (const [option, value] of Object.entries(values)) {
    if (option === "help" || value === undefined) continue;
    const takers = commandsTaking(option);
    if (name !== undefined && takers.includes(name as (typeof takers)[number])) continue;

    return name === undefined
      ? `\`--${option}\` belongs to a command; ${list(takers.map((taker) => `\`repanel ${taker}\``))} take${takers.length === 1 ? "s" : ""} it.`
      : `\`repanel ${name}\` does not take \`--${option}\`.`;
  }
  return undefined;
}

function list(items: readonly string[]): string {
  if (items.length <= 1) return items[0] ?? "no command";
  return `${items.slice(0, -1).join(", ")} and ${items.at(-1) ?? ""}`;
}

function readPort(raw: string | undefined): number | undefined {
  if (raw === undefined) return DEFAULT_PORT;
  const port = Number(raw);
  return Number.isInteger(port) && port >= 1 && port <= 65535 ? port : undefined;
}

/** Exit 2 for "you asked for something that is not a command": the shell convention. */
function usageError(message: string): CommandResult {
  return { exitCode: 2, lines: [message, "", ...usage()] };
}
