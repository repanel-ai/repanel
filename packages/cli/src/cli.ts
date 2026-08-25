import { parseArgs } from "node:util";
import { comingNext } from "./commands/coming-next.js";
import { DEFAULT_PORT, dev, type DevIo } from "./commands/dev.js";
import { validate } from "./commands/validate.js";
import type { CommandResult } from "./command-result.js";
import { commandHelp, isCommand, usage } from "./usage.js";

/** The options only `repanel dev` takes; every other command refuses them. */
const DEV_OPTIONS = ["port", "database-url", "yes"] as const;

/** What a command needs from the process it was started by. */
export interface CliContext {
  readonly io: DevIo;
  readonly env: NodeJS.ProcessEnv;
}

/**
 * Argument parsing and dispatch, and nothing else: one command per call, each
 * returning what to print. Node's own parser does the parsing, so an unknown
 * option is refused here rather than ignored by every command in turn.
 *
 * A command that keeps running — `dev` — returns as soon as it is up; the open
 * server is what holds the process, and its own output has already been
 * written through `context.io`.
 *
 * @param argv the arguments after the program name.
 * @param projectRoot the directory a command reads the definition from.
 * @param context the terminal to talk to and the environment to read.
 */
export async function run(
  argv: readonly string[],
  projectRoot: string,
  context: CliContext,
): Promise<CommandResult> {
  let parsed;
  try {
    parsed = parseArgs({
      args: [...argv],
      options: {
        help: { type: "boolean", short: "h" },
        port: { type: "string" },
        "database-url": { type: "string" },
        yes: { type: "boolean", short: "y" },
      },
      allowPositionals: true,
    });
  } catch (error) {
    return usageError((error as Error).message);
  }

  const [name, ...rest] = parsed.positionals;

  // Before anything else answers: an option no command is going to read is a
  // mistake, and printing the help over it would be ignoring it.
  const misplaced = DEV_OPTIONS.find((option) => parsed.values[option] !== undefined);
  if (name !== "dev" && misplaced !== undefined) {
    return usageError(
      name === undefined
        ? `\`--${misplaced}\` belongs to a command; \`repanel dev\` is the one that takes it.`
        : `\`repanel ${name}\` does not take \`--${misplaced}\`.`,
    );
  }

  if (name === undefined) return { exitCode: 0, lines: usage() };
  if (!isCommand(name)) return usageError(`Unknown command \`${name}\`.`);
  if (parsed.values.help) return { exitCode: 0, lines: commandHelp(name) };
  if (rest.length > 0) return usageError(`\`repanel ${name}\` takes no arguments.`);

  if (name === "validate") return validate(projectRoot);
  if (name !== "dev") return comingNext(name);

  const port = readPort(parsed.values.port);
  if (port === undefined) return usageError(`\`--port\` takes a port number, not \`${parsed.values.port ?? ""}\`.`);

  const outcome = await dev(
    projectRoot,
    { port, databaseUrl: parsed.values["database-url"], yes: parsed.values.yes === true, env: context.env },
    context.io,
  );
  return outcome.started ? { exitCode: 0, lines: [] } : outcome.result;
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
